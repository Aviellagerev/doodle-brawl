import { Server, Socket } from "socket.io";
import { RoomStore } from "../roomStore.js";
import { DrawSegment, DrawOp, ChatMessage, PayoutEntry } from "../../../../packages/shared/index.js";
import { RoomState, Player, RoomSettings, GameState, CHOOSE_TIME_MS, SCORING_DELAY_MS } from "../../../../packages/shared/index.js";
import { createNewRoom, createNewPlayer } from "./../services/roomServices.js";
import {
    chooseWord, createInitialGame, pickWords, publicRoom,
    toScoring, guessPoints, drawerBonus, allGuessed, advanceTurn, revealHintLetter,
    scaleByDifficulty,
} from "../game/skribbl.js";
import { WORD_LISTS } from "../game/words.js";
import { broadcastPlayerCount } from "../observability.js";


const roundTimers = new Map<string, NodeJS.Timeout>();
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

// Close out the current turn's payout: append the drawer's total bonus, then a
// "ran out of time" line for every non-drawer who never guessed. The guesser
// lines are already present (pushed as they guessed), so payout ends up ordered
// guessers-first, then the drawer, then the players who missed.
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

        try {
            const existing = await roomStore.getRoom(roomId);
            if (existing) {
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
                io.to(roomId).emit("chat_message", { author: "System", text: `${newPlayer.name} joined the room`, kind: "system" } as ChatMessage);
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
                io.to(room.roomId).emit("chat_message", { author: "System", text: `${removed?.name ?? "A player"} left the room`, kind: "system" } as ChatMessage);
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

        try {
            const { room, removed } = await roomStore.leavePlayer(roomId, playerId);
            if (room) {
                broadcastRoom(io, room);
                io.to(roomId).emit("chat_message", { author: "System", text: `${removed?.name ?? "A player"} left the room`, kind: "system" } as ChatMessage);
            }
            broadcastPlayerCount(io, roomStore);
        } catch (error) {
            console.error(`Disconnect cleanup failed for room ${roomId}:`, error);
        }

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
    });
    // shape/fill tool ops (line/rect/ellipse/fill) — relayed exactly like "draw"
    socket.on("draw_op", async (op: DrawOp) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = await roomStore.getRoom(roomId);
        if (!room || !room.game) return;
        if (socket.data.playerId !== room.game.currentDrawerId) return; // drawer only
        socket.to(roomId).emit("draw_op", op);
    });
    socket.on("clear", async () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = await roomStore.getRoom(roomId);
        if (!room || !room.game) return;
        if (socket.data.playerId !== room.game.currentDrawerId) return; // only the drawer clears
        socket.to(roomId).emit("clear");
    });
    socket.on("undo", async () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = await roomStore.getRoom(roomId);
        if (!room || !room.game) return;
        if (socket.data.playerId !== room.game.currentDrawerId) return; // only the drawer undoes
        socket.to(roomId).emit("undo");
    });
    socket.on("send_message", async (data) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const raw = data.text;
        if (typeof raw !== "string" || raw.trim().length === 0) return;
        const text = raw.trim();

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
                const note: ChatMessage = { author: "System", text: `${player.name} guessed the word!`, kind: "correct" };
                io.to(roomId).emit("chat_message", note);
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

     
        const message: ChatMessage = { author: player.name, text, kind: "chat" };
        io.to(roomId).emit("chat_message", message);   // io.to = everyone INCLUDING sender
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