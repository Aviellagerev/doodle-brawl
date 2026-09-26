import { Server, Socket } from "socket.io";
import { RoomStore } from "../stores/roomStore.js";
import { DrawSegment, DrawOp, DrawEntry, ChatMessage, ChatEntry, MAX_CHAT_LEN, MAX_NAME_LEN, PayoutEntry,cleanName, cleanAvatar } from "../../../../packages/shared/index.js";
import { RoomState, Player, RoomSettings, GameState, RoomResponse, CHOOSE_TIME_MS, SCORING_DELAY_MS } from "../../../../packages/shared/index.js";
import { createNewRoom, createNewPlayer } from "./../services/roomServices.js";
import {
    chooseWord, createInitialGame, pickWords, viewFor,
    toScoring, guessPoints, drawerBonus, allGuessed, advanceTurn, revealHintLetter,
    scaleByDifficulty,
} from "../game/skribbl.js";
import { judgeGuess, revealsWord, foldGuess } from "../game/guess.js";
import { startMatch, startTurn, logGuess, logChat, closeTurn, takeMatch, forgetMatch } from "../matchLog.js";
import { renamePlayer } from "../stores/playerStore.js";
import { WORD_LISTS, tidyWord } from "../game/words.js";
import { broadcastPlayerCount } from "../observability.js";
import { saveMatch } from "../stores/matchStore.js";

const TIMEOUT_TIMER = 60_000;

const disconectTimers = new Map<string, NodeJS.Timeout>();
const roundTimers = new Map<string, NodeJS.Timeout>();
const drawHistory = new Map<string, DrawEntry[]>();

// A stroke entry holds many segments, so cap on total SEGMENTS, not entries.
// Normal play never comes close; this bounds a client that streams draw events
// in a loop. Oldest entries are dropped first, so a late joiner on an abusive
// turn loses the start of the drawing rather than the server losing its heap.
const MAX_HISTORY_SEGS = 20_000;
const historyLen = new Map<string, number>();

function entrySize(e: DrawEntry): number {
    return e.kind === "stroke" ? e.segs.length : 1;
}
function resetHistory(roomId: string) {
    drawHistory.set(roomId, []);
    historyLen.set(roomId, 0);
}
// `added` may be negative (undo). Trims from the front while over the cap.
function trimHistory(roomId: string, hist: DrawEntry[], added: number) {
    let size = (historyLen.get(roomId) ?? 0) + added;
    while (size > MAX_HISTORY_SEGS && hist.length > 0) {
        size -= entrySize(hist.shift()!);
    }
    historyLen.set(roomId, Math.max(size, 0));
}

/**
 * One change to a room at a time.
 *
 * Every change is read → modify → write on the Redis copy, and two of them
 * interleaving lose one. Two diviners shouting the spell in the same instant
 * each read the room before the other's write: one guess — its points, its
 * credit, the early end of the turn — vanished, though its green pill had
 * already gone out. A wrong guess or a hint letter landing beside a right one
 * did the same. So everything that changes a room — the socket handlers and
 * the round timers — takes its turn in that room's queue.
 *
 * Inside a turn, call the round-loop helpers (finishRound, commitWord, …)
 * directly: queueing again from within would wait on itself. This is
 * in-process, which holds while there is one server; more than one would need
 * the lock in Redis instead.
 */
const roomQueues = new Map<string, Promise<unknown>>();

function withRoom<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
    const run = (roomQueues.get(roomId) ?? Promise.resolve()).then(fn);
    const settled = run.then(() => { }, () => { });   // one failure must not jam the queue
    roomQueues.set(roomId, settled);
    settled.then(() => { if (roomQueues.get(roomId) === settled) roomQueues.delete(roomId); });
    return run;
}

function say(io: Server, roomId: string, msg: ChatMessage, game?: GameState | null) {
    logChat(roomId, {
        msg,
        at: Date.now(),
        round: game?.round ?? null,
        drawerId: game?.currentDrawerId ?? null,
    });
    io.to(roomId).emit("chat_message", msg);
}

function forgetRoom(roomId: string) {
    drawHistory.delete(roomId);
    historyLen.delete(roomId);
    forgetMatch(roomId);
}

// record a freehand segment into the room's history, grouped into a stroke by strokeId
function recordSeg(roomId: string, seg: DrawSegment) {
    const hist = drawHistory.get(roomId) ?? [];
    const last = hist[hist.length - 1];
    if (last && last.kind === "stroke" && last.id === seg.strokeId) last.segs.push(seg);
    else hist.push({ kind: "stroke", id: seg.strokeId ?? 0, segs: [seg] });
    drawHistory.set(roomId, hist);
    trimHistory(roomId, hist, 1);
}
function stampT(game: GameState): number | undefined {
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
    const tick = () => withRoom(roomId, async () => {
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
    });
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
    closeTurn(roomId, room.players, h);
    room.game = toScoring(room.game);
    room.game.endsAt = Date.now() + SCORING_DELAY_MS;   // deadline for the scoreboard countdown
    await roomStore.saveRoom(room);
    broadcastRoom(io, room); // scoring → word now revealed
    // after the scoreboard delay, move to the next turn (or end the game)
    roundTimers.set(roomId, setTimeout(() => withRoom(roomId, () => advanceRound(io, roomStore, roomId)), SCORING_DELAY_MS));
}

async function advanceRound(io: Server, roomStore: RoomStore, roomId: string) {
    clearRoundTimer(roomId);
    const room = await roomStore.getRoom(roomId);
    if (!room || !room.game || room.game.phase !== "scoring") return;
    const result = advanceTurn(room.game, room.players, room.settings.rounds);
    room.game = result.game;
    if (result.done) {
        room.status = "finished";
        await roomStore.saveRoom(room);
        broadcastRoom(io, room);
        const log = takeMatch(roomId, room.players, Date.now());
        if (log) {
            try {
                const id = await saveMatch(log);
                console.log(`match ${id} saved`);
            } catch (err) {
                console.error("match history save failed", err);
            }
        }

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
    roundTimers.set(room.roomId, setTimeout(() => withRoom(room.roomId, () => autoPickWord(io, roomStore, room.roomId)), CHOOSE_TIME_MS));
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
    startTurn(roomId, room.game);
    resetHistory(roomId);   // fresh canvas for the new turn
    await roomStore.saveRoom(room);
    broadcastRoom(io, room); // drawer keeps the real word, guessers get blanks
    const delay = Math.max(0, (room.game.endsAt ?? now) - now);
    roundTimers.set(roomId, setTimeout(() => withRoom(roomId, () => finishRound(io, roomStore, roomId)), delay));
    scheduleHints(io, roomStore, roomId, room.settings.hints, room.settings.drawTimeMs);
}

// Clamp an incoming (untrusted) setting value into a sane range.
// names are attacker-controlled: bound the length, and never let a blank one through


function clamp(v: unknown, min: number, max: number, fallback: number): number {
    const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
}

// Which grimoires are open: only books this tongue actually has. Every book
// open is written [] ("no filter") — and so is none, since a rite with nothing
// to draw from falls back to all of them anyway.
function cleanLists(v: unknown, language: string, fallback: string[]): string[] {
    const known = WORD_LISTS[language] ?? [];
    const asked = Array.isArray(v) ? v : fallback;
    const open = [...new Set(asked.filter((x): x is string => typeof x === "string" && known.includes(x)))];
    return open.length === known.length ? [] : open;
}

const MAX_CUSTOM_WORDS = 500;
const MAX_WORD_LEN = 32;      // it has to fit on the plaque

// The host's own words: tidied, bounded, and one of each as a guesser would type it.
function cleanCustomWords(v: unknown[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const x of v) {
        if (typeof x !== "string") continue;
        const word = [...tidyWord(x)].slice(0, MAX_WORD_LEN).join("").trim();
        const key = foldGuess(word) || word;
        if (!word || seen.has(key)) continue;
        seen.add(key);
        out.push(word);
        if (out.length >= MAX_CUSTOM_WORDS) break;
    }
    return out;
}

const TONGUES: Record<string, string> = { en: "English", he: "Hebrew" };

function broadcastRoom(io: Server, room: RoomState) {
    for (const p of room.players) {
        io.to(p.socketId).emit("room_update", viewFor(room, p.id));
    }
}

/**
 * Socket acknowledgements are optional on the wire: a client can emit
 * "leave_room" with no callback at all. Calling an absent one threw inside the
 * handler's try, and the catch then threw again calling it a second time —
 * which took the whole server down with it. Everything acks through here now.
 */
type Ack<T> = ((res: T) => void) | undefined;
const ack = <T>(cb: Ack<T>) => (res: T) => { if (typeof cb === "function") cb(res); };


/**
 * Re-arm the clocks for rooms mid-rite.
 *
 * Every deadline is an in-process `setTimeout`, so a restart — a deploy, a
 * crash — used to leave rooms frozen for ever: the candle read zero and nothing
 * advanced, with no way out but leaving. Redis still holds the room and its
 * `endsAt`, so on boot (and on a slow sweep afterwards, for timers lost any
 * other way) we schedule whatever that phase was waiting for. A deadline that
 * has already passed fires immediately.
 */
export async function resumeRoundTimers(io: Server, roomStore: RoomStore, log?: { info: (o: object, m: string) => void }) {
    const rooms = await roomStore.listRooms();
    let resumed = 0;

    for (const room of rooms) {
        const game = room.game;
        if (room.status !== "playing" || !game?.endsAt) continue;
        if (roundTimers.has(room.roomId)) continue;        // this one is still ticking

        const due = Math.max(0, game.endsAt - Date.now());
        const roomId = room.roomId;
        if (game.phase === "choosing") {
            roundTimers.set(roomId, setTimeout(() => withRoom(roomId, () => autoPickWord(io, roomStore, roomId)), due));
        } else if (game.phase === "drawing") {
            roundTimers.set(roomId, setTimeout(() => withRoom(roomId, () => finishRound(io, roomStore, roomId)), due));
        } else if (game.phase === "scoring") {
            roundTimers.set(roomId, setTimeout(() => withRoom(roomId, () => advanceRound(io, roomStore, roomId)), due));
        } else {
            continue;
        }
        resumed += 1;
    }

    if (resumed) log?.info({ resumed }, "re-armed round timers");
    return resumed;
}

export function registerRoomHandlers(io: Server, socket: Socket, roomStore: RoomStore) {
    // A handler that changes the room this socket is in takes its turn in that
    // room's queue (see withRoom).
    const onRoom = (event: string, handler: (...args: any[]) => Promise<void>) =>
        socket.on(event, (...args) => {
            const roomId = socket.data.roomId;
            return roomId ? withRoom(roomId, () => handler(...args)) : handler(...args);
        });

    // tell the client which word lists exist per language (drives the lobby picker)
    socket.emit("word_meta", WORD_LISTS);
    // seed the newcomer with the current live player count (for the join screen)
    roomStore.countPlayers().then((n) => socket.emit("player_count", n)).catch(() => { });

    socket.on("create_room", async (data, callback) => {
        const reply = ack<RoomResponse>(callback);
        if (!socket.data.playerId) {
            // a visitor who has not asked to be anyone yet; the client mints an
            // identity and reconnects, then tries again
            reply({ success: false, error: "no_identity" });
            return;
        }
        const name = cleanName(data?.name);
        renamePlayer(socket.data.playerId, name).catch((err) =>
            console.error("renamePlayer failed", err));
        const hostPlayer: Player = createNewPlayer({
            id: socket.data.playerId,
            socketId: socket.id,
            name,
            isHost: true,
            avatar: cleanAvatar(data.avatar),
        });

        const newRoom: RoomState = createNewRoom(hostPlayer);

        try {
            await roomStore.saveRoom(newRoom);

            socket.join(newRoom.roomId);
            socket.data.roomId = newRoom.roomId;
            broadcastRoom(io, newRoom);
            broadcastPlayerCount(io, roomStore);
            console.log(`Room ${newRoom.roomId} created by ${hostPlayer.name}`);

            reply({ success: true, roomId: newRoom.roomId, room: newRoom });

        } catch (error) {
            console.error("Failed to create room:", error);
            reply({ success: false, error: true });
        }
    })


    socket.on('join_room', async (data, callback) => {
        const reply = ack<RoomResponse>(callback);
        if (!socket.data.playerId) {
            reply({ success: false, error: "no_identity" });
            return;
        }
        const roomId = data?.code;
        const name = cleanName(data?.name);
        if (typeof roomId !== "string" || !roomId) {
            reply({ success: false, error: "Room not found. Check the code and try again." });
            return;
        }
        renamePlayer(socket.data.playerId, name).catch((err) =>
            console.error("renamePlayer failed", err));
        const newPlayer: Player = createNewPlayer({
            id: socket.data.playerId,
            socketId: socket.id,
            name,
            isHost: false,
            avatar: cleanAvatar(data.avatar),
        })
        const timer = disconectTimers.get(socket.data.playerId);
        if (timer) { clearTimeout(timer); disconectTimers.delete(socket.data.playerId); }
        //stop and reconect (disconnect doesnt remove player (aka fixed no host bug))
        try {
            // the capacity check, the join and its announcement are one turn:
            // two wizards could otherwise both take the last seat
            const room = await withRoom(roomId, async () => {
                const existing = await roomStore.getRoom(roomId);
                if (existing) {
                    const rejoining = existing.players.some((p) => p.id === newPlayer.id);
                    if (!rejoining && existing.players.length >= existing.settings.maxPlayers) return "full" as const;
                }
                const joined = await roomStore.joinOrUpdatePlayer(roomId, newPlayer);
                if (joined) {
                    socket.join(roomId);
                    socket.data.roomId = joined.roomId;
                    broadcastRoom(io, joined);
                    say(io, roomId, { author: "System", text: `${newPlayer.name} has entered the circle`, kind: "system", playerId: newPlayer.id }, joined.game);
                }
                return joined;
            });
            if (room === "full") {
                reply({ success: false, error: "Room is full." });
                return;
            }

            if (room != null) {
                console.log(`user: ${newPlayer.name} joined id: ${newPlayer.id}`);
                broadcastPlayerCount(io, roomStore);
                // the ack is a room update too: someone walking in mid-spell
                // gets the same redacted view as everyone else
                reply({ success: true, roomId: roomId, room: viewFor(room, newPlayer.id) });
            }
            else {
                reply({
                    success: false,
                    error: "Room not found. Check the code and try again."
                });
            }
        }
        catch (error) {
            console.error(`Failed to join room ${roomId}:`, error);
            reply({
                success: false,
                error: "Server error while joining. Please try again."
            });
        }
    });

    socket.on("leave_room", async (data, callback) => {
        const reply = ack<{ success: boolean; error?: string }>(callback);
        const roomId = data?.roomId ?? socket.data.roomId;
        if (!roomId) { reply({ success: true }); return; }
        try {
            await withRoom(roomId, async () => {
                const { room, removed } = await roomStore.leavePlayer(roomId, socket.data.playerId);
                socket.leave(roomId);
                if (room) {
                    broadcastRoom(io, room);
                    say(io, room.roomId, { author: "System", text: `${removed?.name ?? "A wizard"} has left the circle`, kind: "system", playerId: removed?.id }, room.game);
                } else {
                    forgetRoom(roomId);   // room emptied and was deleted
                }
            });
            broadcastPlayerCount(io, roomStore);
            reply({ success: true });
        } catch (error) {
            console.error(`Failed to leave room ${roomId}:`, error);
            reply({ success: false, error: "Server error while leaving." });
        }
    });
    socket.on('disconnect', async () => {
        const roomId = socket.data.roomId;
        const playerId = socket.data.playerId;
        if (!roomId || !playerId) return;
        disconectTimers.set(playerId, setTimeout(async () => {

            try {
                await withRoom(roomId, async () => {
                    const { room, removed } = await roomStore.leavePlayer(roomId, playerId);
                    if (room) {
                        broadcastRoom(io, room);
                        say(io, roomId, { author: "System", text: `${removed?.name ?? "A wizard"} has left the circle`, kind: "system", playerId: removed?.id }, room.game);
                    } else {
                        forgetRoom(roomId);   // room emptied and was deleted
                    }
                });
                broadcastPlayerCount(io, roomStore);
            } catch (error) {
                console.error(`Disconnect cleanup failed for room ${roomId}:`, error);
            }
            finally {
                disconectTimers.delete(playerId);
            }
        }, TIMEOUT_TIMER))


    });

    //button start pressed
    onRoom('start_game', async () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;

        try {
            const room = await roomStore.getRoom(roomId);
            if (!room) return;
            const host = room.players.find((p) => p.isHost);
            if (!host || host.id !== socket.data.playerId) return; // host only
            if (room.status !== "waiting") return;                 // don't restart mid-game
            if (room.players.length < 2) return;                   // a rite of one is merely drawing

            // game logic (pure): first turn, host draws first
            const game = createInitialGame(host.id);
            const updated = await roomStore.startGame(roomId, game);
            if (!updated) return;
            startMatch(roomId, updated);
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

    onRoom("choose_word", async (data) => {
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


    onRoom("reroll_words", async () => {
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
        recordSeg(roomId, { ...segment, t: stampT(room.game) });   // keep the turn's canvas for late joiners
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
        h.push({ kind: "op", id: op.strokeId ?? 0, op: { ...op, t: stampT(room.game) } });
        drawHistory.set(roomId, h);
        trimHistory(roomId, h, 1);
    });
    socket.on("clear", async () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = await roomStore.getRoom(roomId);
        if (!room || !room.game) return;
        if (socket.data.playerId !== room.game.currentDrawerId) return; // only the drawer clears
        socket.to(roomId).emit("clear");
        resetHistory(roomId);
    });
    socket.on("undo", async () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = await roomStore.getRoom(roomId);
        if (!room || !room.game) return;
        if (socket.data.playerId !== room.game.currentDrawerId) return; // only the drawer undoes
        socket.to(roomId).emit("undo");
        const hist = drawHistory.get(roomId);
        const undone = hist?.pop();
        if (hist && undone) trimHistory(roomId, hist, -entrySize(undone));
    });
    // a client whose board just mounted (late join / reconnect) asks for the current
    // drawing; replay the whole turn's history to that one socket.
    socket.on("request_canvas", async () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        socket.emit("canvas_state", drawHistory.get(roomId) ?? []);
    });
    onRoom("send_message", async (data) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const raw = data?.text;
        if (typeof raw !== "string" || raw.trim().length === 0) return;
        const text = raw.trim().slice(0, MAX_CHAT_LEN);   // bound it: this gets stored

        const room = await roomStore.getRoom(roomId);
        if (!room) return;
        const player = room.players.find((p) => p.id === socket.data.playerId);
        if (!player) return;

        const game = room.game;

        // --- guess detection: only while drawing, and only against the secret word ---
        if (game && game.phase === "drawing" && game.word) {
            const knows = player.id === game.currentDrawerId || game.guessedIds.includes(player.id);
            if (knows) {
                // the caster, or someone who has divined it: a line that spells
                // the word — or all but a letter of it — would hand it to the
                // wizards still guessing, so it goes no further than its author
                if (revealsWord(text, game.word)) {
                    socket.emit("chat_message", { author: "System", text: "hush — the others are still divining", kind: "system" } satisfies ChatMessage);
                    return;
                }
                // anything else is ordinary chat
            }

            const verdict = knows ? "miss" : judgeGuess(text, game.word);
            if (verdict === "exact") {
                // correct guess → time-based points scaled by difficulty, plus drawer
                // bonus. The guess itself is NEVER echoed: it would leak to everyone.
                const timeLeft = (game.endsAt ?? Date.now()) - Date.now();
                const elapsedMs = Math.max(0, room.settings.drawTimeMs - Math.max(0, timeLeft));
                const pts = scaleByDifficulty(guessPoints(timeLeft, room.settings.drawTimeMs), game.wordDifficulty);
                player.score = (player.score ?? 0) + pts;
                const drawer = room.players.find((p) => p.id === game.currentDrawerId);
                const bonus = drawerBonus(pts);
                if (drawer) drawer.score = (drawer.score ?? 0) + bonus;
                logGuess(roomId, player.id, elapsedMs, pts, bonus);
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
                const note: ChatMessage = { author: "System", text: `${player.name} divined the spell!`, kind: "correct", playerId: player.id };
                say(io, roomId, note, game);
                broadcastRoom(io, room);

                // everyone guessed? end the round now instead of waiting for the clock
                if (allGuessed(game, room.players)) {
                    await finishRound(io, roomStore, roomId);
                }
                return;
            }

            if (!knows) {
                const stats = (room.stats ??= { guessMs: {}, wrong: {}, doodle: {} });
                stats.wrong[player.id] = (stats.wrong[player.id] ?? 0) + 1;
                await roomStore.saveRoom(room);
                // no broadcast needed — stats ride the next room_update

                if (verdict === "close") {
                    // one letter off. Only the guesser hears it: shown to the
                    // whole circle, a near-miss hands everyone else the answer.
                    // The chronicle keeps it as the plain chat it was.
                    const close: ChatMessage = { author: player.name, text, kind: "close", playerId: player.id };
                    logChat(roomId, { msg: { ...close, kind: "chat" }, at: Date.now(), round: game.round, drawerId: game.currentDrawerId });
                    socket.emit("chat_message", close);
                    return;
                }
                // a plain miss falls through to chat
            }
        }


        const message: ChatMessage = { author: player.name, text, kind: "chat", playerId: player.id };
        say(io, roomId, message, room.game);   // records for history, then emits to everyone
    });

    onRoom("update_settings", async (data) => {
        const roomId = socket.data.roomId;
        if (!roomId) return;
        const room = await roomStore.getRoom(roomId);
        if (!room) return;
        const host = room.players.find((p) => p.isHost);
        if (!host || host.id !== socket.data.playerId) return; // host only
        if (room.status !== "waiting") return;                 // settings lock once playing

        const prev = room.settings;
        const s = (data ?? {}) as Partial<RoomSettings>;
        const language = typeof s.language === "string" && WORD_LISTS[s.language] ? s.language : room.settings.language;
        room.settings = {
            rounds: clamp(s.rounds, 1, 10, room.settings.rounds),
            drawTimeMs: clamp(s.drawTimeMs, 15_000, 300_000, room.settings.drawTimeMs),
            wordChoices: clamp(s.wordChoices, 1, 5, room.settings.wordChoices),
            maxPlayers: clamp(s.maxPlayers, 2, 20, room.settings.maxPlayers),
            language,
            lists: cleanLists(s.lists, language, room.settings.lists),
            customWords: Array.isArray(s.customWords) ? cleanCustomWords(s.customWords) : room.settings.customWords,
            customWordsOnly: typeof s.customWordsOnly === "boolean" ? s.customWordsOnly : room.settings.customWordsOnly,
            hints: clamp(s.hints, 0, 5, room.settings.hints),
        };
        await roomStore.saveRoom(room);
        broadcastRoom(io, room);

        // the design's settings pill: one ⚙ line per changed rule
        const now = room.settings;
        const changes: string[] = [];
        if (now.rounds !== prev.rounds) changes.push(`the rite to ${now.rounds} rounds`);
        if (now.drawTimeMs !== prev.drawTimeMs) changes.push(`the candle to ${Math.round(now.drawTimeMs / 1000)}s`);
        if (now.maxPlayers !== prev.maxPlayers) changes.push(`the circle to ${now.maxPlayers} seats`);
        if (now.hints !== prev.hints) changes.push(now.hints === 0 ? "the hints out" : `the hints to ${now.hints}`);
        if (now.wordChoices !== prev.wordChoices) changes.push(`the offering to ${now.wordChoices} ${now.wordChoices === 1 ? "spell" : "spells"}`);
        if (now.language !== prev.language) changes.push(`the tongue to ${TONGUES[now.language] ?? now.language}`);
        if ([...now.lists].sort().join() !== [...prev.lists].sort().join()) {
            changes.push(now.lists.length ? `the grimoires to ${now.lists.join(" + ")}` : "every grimoire open");
        }
        if (now.customWordsOnly !== prev.customWordsOnly) {
            changes.push(now.customWordsOnly ? "the spells to their own words only" : "the grimoires back into play");
        }
        if (changes.length) {
            say(io, roomId, { author: "System", text: `⚙ ${host.name} set ${changes.join(", ")}`, kind: "system", playerId: host.id }, room.game);
        }
    });

    onRoom("play_again", async () => {
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