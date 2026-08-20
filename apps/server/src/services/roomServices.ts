import { RoomState, Player, GameMode } from "../../../../packages/shared/index.js";
import { DEFAULT_SETTINGS } from "../game/skribbl.js";


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

export function createNewRoom(host: Player, mode: GameMode = "skribbl"): RoomState {
    return {
        roomId: generateRoomCode(),
        mode,
        players: [host],
        status: "waiting",
        settings: { ...DEFAULT_SETTINGS },
    };
}
