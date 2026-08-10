

export interface Player {
  id: string;
  socketId: string;
  name: string;
  score?: number;
  isHost?: boolean;
}

// Which game a room is playing. Today only skribbl exists; adding a new mode
// (e.g. "gartic") means adding it to this union and routing on `room.mode`.
// The lobby/room/player machinery below is deliberately mode-agnostic.
export type GameMode = "skribbl";

// Lobby-level state machine. A room moves: waiting → playing → finished.
export type RoomStatus = "waiting" | "playing" | "finished";

export interface RoomState {
  roomId: string;
  mode: GameMode;
  players: Player[];
  status: RoomStatus;
  game?: GameState;
}

export interface RoomResponse {
  success: boolean;
  roomId?: string;
  room?:RoomState;
  error?: boolean | string;
}

// Round-level state machine for skribbl. Only meaningful while status="playing".
//   choosing → drawing → scoring → choosing (next round) | done (last round)
// The legal transitions live in game/skribbl.ts (PHASE_TRANSITIONS).
export type GamePhase = "choosing" | "drawing" | "scoring" | "done";

export interface GameState {
  currentDrawerId: string;
  round: number;
  phase: GamePhase;
  wordLength: number | null;
  word: string | null;
}
