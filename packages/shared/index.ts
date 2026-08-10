

export interface Player {
  id: string;
  socketId: string;
  name: string;
  score?: number;
  isHost?: boolean;
}

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
export type GamePhase = "choosing" | "drawing" | "scoring" | "done";

export interface GameState {
  currentDrawerId: string;
  round: number;
  phase: GamePhase;
  wordLength: number | null;
  word: string | null;
}
