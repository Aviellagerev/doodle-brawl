

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

export interface RoomSettings {
  rounds: number;          // a "round" = every player draws once
  drawTimeMs: number;      // time per drawing turn
  wordChoices: number;     // how many words the drawer picks from
  maxPlayers: number;      // cap on players in the room
}

export interface RoomState {
  roomId: string;
  mode: GameMode;
  players: Player[];
  status: RoomStatus;
  settings: RoomSettings;
  game?: GameState;
}

export interface RoomResponse {
  success: boolean;
  roomId?: string;
  room?:RoomState;
  error?: boolean | string;
}
export type GamePhase = "choosing" | "drawing" | "scoring" | "done";

// Fixed phase durations shared by client + server (per-turn draw time is a
// per-room setting; these two are not).
export const CHOOSE_TIME_MS = 15_000;   // drawer has 15s to pick, then auto-pick
export const SCORING_DELAY_MS = 5_000;  // scoreboard shows for 5s before advancing

export interface GameState {
  currentDrawerId: string;
  round: number;
  phase: GamePhase;
  wordLength: number | null;
  word: string | null;
  endsAt: number | null;      // epoch ms when the CURRENT phase ends (choosing/drawing/scoring)
  guessedIds: string[];       // players who've guessed correctly this turn
  drawnThisRound: string[];   // players who've already drawn in the current round
  wordOptions: string[] | null; // the choices offered to the drawer (redacted from others)
}

export interface Point {
  x:number;
  y:number;
}
export interface DrawSegment{
  from:Point;
  to:Point;
  color:string;
  width:number;
  erase?:boolean;   // eraser stroke — receivers clear instead of paint
}
export interface ChatMessage {
  author: string;
  text: string;
  kind: "chat" | "system" | "correct";   // correct = someone guessed the word
}
