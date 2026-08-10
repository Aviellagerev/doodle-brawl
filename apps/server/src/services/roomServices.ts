import { RoomState, Player, GameMode } from "../../../../packages/shared/index.js";


export function generateRoomCode(): string {

    const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
export function createNewPlayer(
  { id, socketId, name, isHost }: { id: string; socketId: string; name: string; isHost: boolean }
): Player {
  return { id, socketId, name, score: 0, isHost };
}
// Builds a fresh lobby. `mode` defaults to skribbl but is a parameter so a new
// game mode only needs to pass its own name here — nothing else in room setup
// changes. Game-specific state (the drawer, word, phase) is NOT built here;
// that lives in each mode's rules file (see game/skribbl.ts createInitialGame).
export function createNewRoom(host: Player, mode: GameMode = "skribbl"): RoomState {
    return {
        roomId: generateRoomCode(),
        mode,
        players: [host],
        status: "waiting",
    };
}
