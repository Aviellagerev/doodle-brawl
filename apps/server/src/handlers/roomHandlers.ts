import { Server, Socket } from "socket.io";
import { RoomStore } from "../roomStore.js";
import { DrawSegment, DrawOp, DrawEntry, ChatMessage, ChatEntry, MAX_CHAT_LEN, PayoutEntry } from "../../../../packages/shared/index.js";
import { RoomState, Player, RoomSettings, GameState, CHOOSE_TIME_MS, SCORING_DELAY_MS } from "../../../../packages/shared/index.js";
import { createNewRoom, createNewPlayer } from "./../services/roomServices.js";
import {
    chooseWord, createInitialGame, pickWords, publicRoom,
    toScoring, guessPoints, drawerBonus, allGuessed, advanceTurn, revealHintLetter,
    scaleByDifficulty,
} from "../game/skribbl.js";
import { WORD_LISTS } from "../game/words.js";
import { broadcastPlayerCount } from "../observability.js";

const TIMEOUT_TIMER = 60_000;

const disconectTimers = new Map<string,NodeJS.Timeout>();
const roundTimers = new Map<string, NodeJS.Timeout>();
// the CURRENT turn's drawing, per room, so we can replay it to anyone who joins
// or reconnects mid-draw. Reset each turn; grows with strokes, shrinks on undo/clear.
const drawHistory = new Map<string, DrawEntry[]>();
// the MATCH's chat, per room. Unlike drawHistory (reset each turn) this spans a
// whole match: reset when a game starts, persisted when it ends. Capped, because
// chat is attacker-controlled and now ends up on disk.
const MAX_CHAT_ENTRIES = 2000;
const chatHistory = new Map<string, ChatEntry[]>();

// Single funnel for every chat line: record it for the match history, then emit.
// ALL chat must go through here — there are five call sites, and one that skips
// this silently drops history with nothing to catch it at compile time.
function say(io: Server, roomId: string, msg: ChatMessage, game?: GameState | null) {
    const hist = chatHistory.get(roomId) ?? [];
    if (hist.length < MAX_CHAT_ENTRIES) {
        hist.push({
            msg,
            at: Date.now(),
            round: game?.round ?? null,
            drawerId: game?.currentDrawerId ?? null,
        });
        chatHistory.set(roomId, hist);
    }
    io.to(roomId).emit("chat_message", msg);
}

// a room with no players left is gone from Redis — drop its buffers too, or the
// Maps grow forever with dead rooms.
function forgetRoom(roomId: string) {
    chatHistory.delete(roomId);
    drawHistory.delete(roomId);
}

// record a freehand segment into the room's history, grouped into a stroke by strokeId
function recordSeg(roomId: string, seg: DrawSegment) {
    const hist = drawHistory.get(roomId) ?? [];
    const last = hist[hist.length - 1];
    if (last && last.kind === "stroke" && last.id === seg.strokeId) last.segs.push(seg);
    else hist.push({ kind: "stroke", id: seg.strokeId ?? 0, segs: [seg] });
    drawHistory.set(roomId, hist);
}
function stampT(game: GameState): number | undefined{
    return game.turnStartedAt ? Date.now() - game.turnStartedAt : undefined;
}
// separate from the phase timer: fires the gradual letter reveals during drawing
const hintTimers = new Map<string, NodeJS.Timeout>();



function clearRoundTimer(roomId: string) {
    const t = roundTimers.get(roomId);
    if (t) {
        clearTimeout(t);
        roundTimers.delete(roomId);
    }
}

function clearHintTimer(roomId: string) {
    const t = hintTimers.get(roomId);
    if (t) {
        clearTimeout(t);
        hintTimers.delete(roomId);
    }
}

// Reveal `total` letters spread evenly across the drawing time. Re-schedules
// itself after each reveal; stops when the phase ends or no letters remain.
function scheduleHints(io: Server, roomStore: RoomStore, roomId: string, total: number, drawTimeMs: number) {
    clearHintTimer(roomId);
    if (total <= 0) return;
    const interval = Math.max(1000, Math.floor(drawTimeMs / (total + 1)));
    let revealed = 0;
    const tick = async () => {
        const room = await roomStore.getRoom(roomId);
        if (!room || !room.game || room.game.phase !== "drawing") { clearHintTimer(roomId); return; }
        const did = revealHintLetter(room.game);
        if (did) {
            await roomStore.saveRoom(room);
            broadcastRoom(io, room);
            revealed++;
        }
        if (did && revealed < total) {
            hintTimers.set(roomId, setTimeout(tick, interval));
        } else {
            clearHintTimer(roomId);
        }
    };
    hintTimers.set(roomId, setTimeout(tick, interval));
}


function finalizePayout(game: GameState, players: Player[]) {
    const payout: PayoutEntry[] = game.payout ?? (game.payout = []);
    const drawerId = game.currentDrawerId;
    const guessers = game.guessedIds;
    const drawerBonusTotal = payout
        .filter((e) => guessers.includes(e.playerId))
        .reduce((sum, e) => sum + drawerBonus(e.points), 0);
    const n = guessers.length;
    payout.push({
        playerId: drawerId,
        points: n === 0 ? 0 : drawerBonusTotal,
        note: n === 0 ? "nobody guessed" : `drawer bonus · ${n} guessed`,
    });
    for (const p of players) {
        if (p.id === drawerId) continue;
        if (guessers.includes(p.id)) continue;
        payout.push({ playerId: p.id, points: 0, note: "ran out of time" });
    }
}

async function finishRound(io: Server, roomStore: RoomStore, roomId: string) {
    clearRoundTimer(roomId);
    clearHintTimer(roomId);
    const room = await roomStore.getRoom(roomId);
    if (!room || !room.game || room.game.phase !== "drawing") return;
    finalizePayout(room.game, room.players);
    const h = drawHistory.get(roomId) ?? [];
console.log("t:", h.flatMap(e => e.kind === "stroke" ? e.segs.map(s => s.t) : [e.op.t]));

    room.game = toScoring(room.game);
    room.game.endsAt = Date.now() + SCORING_DELAY_MS;   // deadline for the scoreboard countdown
    await roomStore.saveRoom(room);
    broadcastRoom(io, room); // scoring → word now revealed
    // after the scoreboard delay, move to the next turn (or end the game)
    roundTimers.set(roomId, setTimeout(() => advanceRound(io, roomStore, roomId), SCORING_DELAY_MS));
}

async function advanceRound(io: Server, roomStore: RoomStore, roomId: string) {
    clearRoundTimer(roomId);
    const room = await roomStore.getRoom(roomId);
    if (!room || !room.game || room.game.phase !== "scoring") return;
    const result = advanceTurn(room.game, room.players, room.settings.rounds);
    room.game = result.game;
    if (result.done) {
        room.status = "finished";            // → victory screen
        await roomStore.saveRoom(room);
        broadcastRoom(io, room);
        // TODO(match-history): the match is complete here — persist chatHistory
        // and the per-turn replays to Postgres, then clear the buffers. Until then
        // they're held until the next start_game resets them.
        return;
    }
    await roomStore.saveRoom(room);
    broadcastRoom(io, room);
    await offerWords(io, roomStore, room);    // set up the new drawer's choosing phase
}


async function offerWords(io: Server, roomStore: RoomStore, room: RoomState) {
    if (!room.game) return;
    room.game.wordOptions = pickWords(room.settings.wordChoices, room.settings);
    room.game.endsAt = Date.now() + CHOOSE_TIME_MS;
    await roomStore.saveRoom(room);
    broadcastRoom(io, room);
    clearRoundTimer(room.roomId);
    roundTimers.set(room.roomId, setTimeout(() => autoPickWord(io, roomStore, room.roomId), CHOOSE_TIME_MS));
}

// Choose clock ran out → pick one of the drawer's options for them.
async function autoPickWord(io: Server, roomStore: RoomStore, roomId: string) {
    clearRoundTimer(roomId);
    const room = await roomStore.getRoom(roomId);
    if (!room || !room.game || room.game.phase !== "choosing") return;
    const opts = room.game.wordOptions ?? pickWords(room.settings.wordChoices, room.settings);
    const word = opts[0].word;
    await commitWord(io, roomStore, roomId, word);
}

// Lock in a word (from a click or an auto-pick): choosing → drawing, start the
// draw clock. Shared by the choose_word handler and autoPickWord.
async function commitWord(io: Server, roomStore: RoomStore, roomId: string, word: string) {
    clearRoundTimer(roomId);
    clearHintTimer(roomId);
    const room = await roomStore.getRoom(roomId);
    if (!room || !room.game || room.game.phase !== "choosing") return;
    const now = Date.now();
    room.game = chooseWord(room.game, word, now, room.settings.drawTimeMs);
    drawHistory.set(roomId, []);   // fresh canvas for the new turn
    await roomStore.saveRoom(room);
    broadcastRoom(io, room); // drawer keeps the real word, guessers get blanks
    const delay = Math.max(0, (room.game.endsAt ?? now) - now);
    roundTimers.set(roomId, setTimeout(() => finishRound(io, roomStore, roomId), delay));
    scheduleHints(io, roomStore, roomId, room.settings.hints, room.settings.drawTimeMs);
}

// Clamp an incoming (untrusted) setting value into a sane range.
function clamp(v: unknown, min: number, max: number, fallback: number): number {
    const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
}


function broadcastRoom(io: Server, room: RoomState) {
    const drawerId = room.game?.currentDrawerId;
    const publicView = publicRoom(room);
    for (const p of room.players) {
        io.to(p.socketId).emit("room_update", p.id === drawerId ? room : publicView);
    }
}

export function registerRoomHandlers(io: Server, socket: Socket, roomStore: RoomStore) {
    // tell the client which word lists exist per language (drives the lobby picker)
    socket.emit("word_meta", WORD_LISTS);
    // seed the newcomer with the current live player count (for the join screen)
    roomStore.countPlayers().then((n) => socket.emit("player_count", n)).catch(() => { });

    socket.on("create_room", async (data, callback) => {
        const hostPlayer: Player = createNewPlayer({
            id: data.id,
            socketId: socket.id,
            name: data.name,
            isHost: true,
        });

        const newRoom: RoomState = createNewRoom(hostPlayer);

        try {
            await roomStore.saveRoom(newRoom);

            socket.join(newRoom.roomId);
            socket.data.roomId = newRoom.roomId;
            socket.data.playerId = hostPlayer.id;
            broadcastRoom(io, newRoom);
            broadcastPlayerCount(io, roomStore);
            console.log(`Room ${newRoom.roomId} created by ${hostPlayer.name}`);

            callback({ success: true, roomId: newRoom.roomId, room: newRoom });

        } catch (error) {
            console.error("Failed to create room:", error);
            callback({ success: false, error: true });
        }
    })


    socket.on('join_room', async (data, callback) => {

        const roomId = data.code;
        const newPlayer: Player = createNewPlayer({
            id: data.id,
            socketId: socket.id,
            name: data.name,
            isHost: false,
        })
        const timer = disconectTimers.get(data.id);
         if (timer) { clearTimeout(timer); disconectTimers.delete(data.id); } 
         //stop and reconect (disconnect doesnt remove player (aka fixed no host bug))
        try {
            const existing = await roomStore.getRoom(roomId);
            if (existing) {
            //rmove the timer here ?
                const rejoining = existing.players.some((p) => p.id === newPlayer.id);
                if (!rejoining && existing.players.length >= existing.settings.maxPlayers) {
                    callback({ success: false, error: "Room is full." });
                    return;
                }
            }
            const room = await roomStore.joinOrUpdatePlayer(roomId, newPlayer);

            if (room != null) {

                socket.join(roomId);
                socket.data.roomId = room.roomId;
                socket.data.playerId = newPlayer.id;
                console.log(`user: ${newPlayer.name} joined id: ${newPlayer.id}`);
                broadcastRoom(io, room);
                broadcastPlayerCount(io, roomStore);
                say(io, roomId, { author: "System", text: `${newPlayer.name} joined the room`, kind: "system", playerId: newPlayer.id }, room.game);
                callback({ success: true, roomId: roomId, room });
            }
            else {
                callback({
                    success: false,
                    error: "Room not found. Check the code and try again."
                });
            }
        }
        catch (error) {
            console.error(`Failed to join room ${roomId}:`, error);
            callback({
                success: false,
                error: "Server error while joining. Please try again."
            });
        }
    });

    socket.on("leave_room", async (data, callback) => {
        try {
            const { room, removed } = await roomStore.leavePlayer(data.roomId, data.id);
            socket.leave(data.roomId);
            if (room) {
                broadcastRoom(io, room);
                say(io, room.roomId, { author: "System", text: `${removed?.name ?? "A player"} left the room`, kind: "system", playerId: removed?.id }, room.game);
            } else {
                forgetRoom(data.roomId);   // room emptied and was deleted
            }
            broadcastPlayerCount(io, roomStore);
            callback({ success: true });
        } catch (error) {
            console.error(`Failed to leave room ${data.roomId}:`, error);
            callback({ success: false, error: "Server error while leaving." });
        }
    });
    socket.on('disconnect', async () => {
        const roomId = socket.data.roomId;
        const playerId = socket.data.playerId;
        if (!roomId || !playerId) return;
        disconectTimers.set(playerId, setTimeout(async () => {

            try {
                const { room, removed } = await roomStore.leavePlayer(roomId, playerId);
                if (room) {
                    broadcastRoom(io, room);
                    say(io, roomId, { author: "System", text: `${removed?.name ?? "A player"} left the room`, kind: "system", playerId: removed?.id }, room.game);
                } else {
                    forgetRoom(roomId);   // room emptied and was deleted
                }
                broadcastPlayerCount(io, roomStore);
            } catch (error) {
                console.error(`Disconnect cleanup failed for room ${roomId}:`, error);
            }
            finally {
                disconectTimers.delete(playerId);
            }
        },TIMEOUT_TIMER))


    });

    //button start pressed
    socket.on('start_game', async () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;

        try {
            const room = await roomStore.getRoom(roomId);
            if (!room) return;
            const host = room.players.find((p) => p.isHost);
            if (!host || host.id !== socket.data.playerId) return; // host only
            if (room.status !== "waiting") return;                 // don't restart mid-game

            // game logic (pure): first turn, host draws first
            const game = createInitialGame(host.id);
            const updated = await roomStore.startGame(roomId, game);
            if (!updated) return;
            chatHistory.set(roomId, []);   // fresh chat log for this match

            // fresh petty-awards tallies for the new game
            updated.stats = { guessMs: {}, wrong: {}, doodle: {} };
            await roomStore.saveRoom(updated);

            broadcastRoom(io, updated);   // everyone switches to the game screen
            await offerWords(io, roomStore, updated); // set up the choosing phase + timer
        }
        catch (error) {
            console.error(`start_game failed for room ${roomId}:`, error);
        }

    });

    socket.on("choose_word", async (data) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        try {
            const room = await roomStore.getRoom(roomId);
            if (!room || !room.game) return;
            if (socket.data.playerId !== room.game.currentDrawerId) return; // not the drawer
            if (room.game.phase !== "choosing") return;                     // wrong phase
            const word = data.word;
            if (typeof word !== "string" || word.length === 0) return;
            // must be one of the offered options (can't inject an arbitrary word)
            if (room.game.wordOptions && !room.game.wordOptions.some((o) => o.word === word)) return;
            await commitWord(io, roomStore, roomId, word);
        }
        catch (error) {
            console.error(`choose_word failed for room ${roomId}`, error);
        }
    })


    socket.on("reroll_words", async () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        try {
            const room = await roomStore.getRoom(roomId);
            if (!room || !room.game) return;
            if (socket.data.playerId !== room.game.currentDrawerId) return; // drawer only
            if (room.game.phase !== "choosing") return;                     // choosing only
            if (room.game.rerollsLeft <= 0) return;                         // out of rerolls
            room.game.wordOptions = pickWords(room.settings.wordChoices, room.settings);
            room.game.rerollsLeft -= 1;
            await roomStore.saveRoom(room);
            broadcastRoom(io, room);   // drawer sees new options; others still redacted
        } catch (error) {
            console.error(`reroll_words failed for room ${roomId}`, error);
        }
    })

    socket.on("draw", async (segment: DrawSegment) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;

        const room = await roomStore.getRoom(roomId);
        if (!room || !room.game) return;

        // only the drawer may draw — stops a guesser from scribbling via devtools
        if (socket.data.playerId !== room.game.currentDrawerId) return;

        // relay to everyone else in the room (socket.to excludes the sender)
        socket.to(roomId).emit("draw", segment);
        recordSeg(roomId, { ...segment, t :stampT(room.game)});   // keep the turn's canvas for late joiners
    });
    // shape/fill tool ops (line/rect/ellipse/fill) — relayed exactly like "draw"
    socket.on("draw_op", async (op: DrawOp) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = await roomStore.getRoom(roomId);
        if (!room || !room.game) return;
        if (socket.data.playerId !== room.game.currentDrawerId) return; // drawer only
        socket.to(roomId).emit("draw_op", op);
        
        const h = drawHistory.get(roomId) ?? [];
        console.log(h.map(e => e.kind === "stroke"
  ? `stroke×${e.segs.length}@${e.segs[0]?.t}`
  : `op:${e.op.kind}@${e.op.t}`));

        h.push({ kind: "op", id: op.strokeId ?? 0, op:{...op,t:stampT(room.game)}});
        drawHistory.set(roomId, h);
    });
    socket.on("clear", async () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = await roomStore.getRoom(roomId);
        if (!room || !room.game) return;
        if (socket.data.playerId !== room.game.currentDrawerId) return; // only the drawer clears
        socket.to(roomId).emit("clear");
        drawHistory.set(roomId, []);
    });
    socket.on("undo", async () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = await roomStore.getRoom(roomId);
        if (!room || !room.game) return;
        if (socket.data.playerId !== room.game.currentDrawerId) return; // only the drawer undoes
        socket.to(roomId).emit("undo");
        drawHistory.get(roomId)?.pop();
    });
    // a client whose board just mounted (late join / reconnect) asks for the current
    // drawing; replay the whole turn's history to that one socket.
    socket.on("request_canvas", async () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        socket.emit("canvas_state", drawHistory.get(roomId) ?? []);
    });
    socket.on("send_message", async (data) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const raw = data.text;
        if (typeof raw !== "string" || raw.trim().length === 0) return;
        const text = raw.trim().slice(0, MAX_CHAT_LEN);   // bound it: this gets stored

        const room = await roomStore.getRoom(roomId);
        if (!room) return;
        const player = room.players.find((p) => p.id === socket.data.playerId);
        if (!player) return;

        const game = room.game;

        // --- guess detection: only while drawing, and only against the secret word ---
        if (game && game.phase === "drawing" && game.word) {
            const isDrawer = player.id === game.currentDrawerId;
            const already = game.guessedIds.includes(player.id);
            const isWord = text.toLowerCase() === game.word.toLowerCase();
            if (isWord) {
                // NEVER echo the actual word into chat — it would leak to everyone.
                // The drawer / an already-correct guesser typing it is just swallowed.
                if (isDrawer || already) return;

                // correct guess → time-based points scaled by difficulty, plus drawer bonus
                const timeLeft = (game.endsAt ?? Date.now()) - Date.now();
                const elapsedMs = Math.max(0, room.settings.drawTimeMs - Math.max(0, timeLeft));
                const pts = scaleByDifficulty(guessPoints(timeLeft, room.settings.drawTimeMs), game.wordDifficulty);
                player.score = (player.score ?? 0) + pts;
                const drawer = room.players.find((p) => p.id === game.currentDrawerId);
                if (drawer) drawer.score = (drawer.score ?? 0) + drawerBonus(pts);
                // record this guesser's payout line (first correct guesser is flagged)
                const isFirst = game.guessedIds.length === 0;
                (game.payout ??= []).push({
                    playerId: player.id,
                    points: pts,
                    note: isFirst ? "first to guess" : "guessed it",
                });
                game.guessedIds.push(player.id);

                // petty-awards stats: fastest correct guess + guessers earned by the drawer
                const stats = (room.stats ??= { guessMs: {}, wrong: {}, doodle: {} });
                const prevMs = stats.guessMs[player.id];
                stats.guessMs[player.id] = prevMs === undefined ? elapsedMs : Math.min(prevMs, elapsedMs);
                stats.doodle[game.currentDrawerId] = (stats.doodle[game.currentDrawerId] ?? 0) + 1;

                await roomStore.saveRoom(room);

                // announce WITHOUT the word, then push the updated scores
                // stays authored by System (the word must not leak), but carries the
                // guesser's id so the guess is queryable without parsing prose
                const note: ChatMessage = { author: "System", text: `${player.name} guessed the word!`, kind: "correct", playerId: player.id };
                say(io, roomId, note, game);
                broadcastRoom(io, room);

                // everyone guessed? end the round now instead of waiting for the clock
                if (allGuessed(game, room.players)) {
                    await finishRound(io, roomStore, roomId);
                }
                return;
            }
  
            if (!isDrawer && !already) {
                const stats = (room.stats ??= { guessMs: {}, wrong: {}, doodle: {} });
                stats.wrong[player.id] = (stats.wrong[player.id] ?? 0) + 1;
                await roomStore.saveRoom(room);
                // no broadcast needed — stats ride the next room_update; fall through to chat
            }
        }

     
        const message: ChatMessage = { author: player.name, text, kind: "chat", playerId: player.id };
        say(io, roomId, message, room.game);   // records for history, then emits to everyone
    });

    socket.on("update_settings", async (data) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = await roomStore.getRoom(roomId);
        if (!room) return;
        const host = room.players.find((p) => p.isHost);
        if (!host || host.id !== socket.data.playerId) return; // host only
        if (room.status !== "waiting") return;                 // settings lock once playing

        const s = (data ?? {}) as Partial<RoomSettings>;
        room.settings = {
            rounds: clamp(s.rounds, 1, 10, room.settings.rounds),
            drawTimeMs: clamp(s.drawTimeMs, 15_000, 300_000, room.settings.drawTimeMs),
            wordChoices: clamp(s.wordChoices, 1, 5, room.settings.wordChoices),
            maxPlayers: clamp(s.maxPlayers, 2, 20, room.settings.maxPlayers),
            language: typeof s.language === "string" && WORD_LISTS[s.language] ? s.language : room.settings.language,
            lists: Array.isArray(s.lists) ? s.lists.filter((x): x is string => typeof x === "string").slice(0, 50) : room.settings.lists,
            customWords: Array.isArray(s.customWords)
                ? s.customWords.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).slice(0, 500)
                : room.settings.customWords,
            customWordsOnly: typeof s.customWordsOnly === "boolean" ? s.customWordsOnly : room.settings.customWordsOnly,
            hints: clamp(s.hints, 0, 5, room.settings.hints),
        };
        await roomStore.saveRoom(room);
        broadcastRoom(io, room);
    });

    socket.on("play_again", async () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = await roomStore.getRoom(roomId);
        if (!room) return;
        const host = room.players.find((p) => p.isHost);
        if (!host || host.id !== socket.data.playerId) return; // host only
        room.status = "waiting";
        room.game = undefined;
        room.stats = { guessMs: {}, wrong: {}, doodle: {} };
        for (const p of room.players) p.score = 0;
        await roomStore.saveRoom(room);
        broadcastRoom(io, room);
    });


}