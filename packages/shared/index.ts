

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
  language: string;        // which word files to use ("en" | "he")
  lists: string[];         // enabled word lists ([] = all lists for the language)
  customWords: string[];   // extra words added by the host
  customWordsOnly: boolean; // draw ONLY from customWords
  hints: number;           // letters gradually revealed to guessers (0 = off)
}

export interface RoomState {
  roomId: string;
  mode: GameMode;
  players: Player[];
  status: RoomStatus;
  settings: RoomSettings;
  game?: GameState;
  // Raw per-game tallies for the game-over "petty awards" (computed on the client).
  // Keyed by player id. Reset to empty maps at the start of each game.
  stats?: {
    guessMs: Record<string, number>;  // player's FASTEST correct-guess time in ms (smaller = better)
    wrong: Record<string, number>;    // count of that player's incorrect guesses across the game
    doodle: Record<string, number>;   // total correct guessers that drawer earned across the game
  };
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

// Word difficulty tiers. Each tier carries a fixed display point value and a
// scoring multiplier applied to the time-based guess points.
export type Difficulty = "easy" | "normal" | "hard";

// Base display points shown on the word-picker cards, keyed by difficulty.
export const DIFFICULTY_POINTS: Record<Difficulty, number> = {
  easy: 100,
  normal: 200,
  hard: 300,
};

// Multiplier applied to the time-based guess points, keyed by difficulty.
export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy: 0.75,
  normal: 1,
  hard: 1.5,
};

// One choice offered to the drawer in the "choosing" phase.
export interface WordOption {
  word: string;
  difficulty: Difficulty;
  points: number;   
}


export interface PayoutEntry {
  playerId: string;
  points: number;
  note: string;
}

export interface GameState {
  currentDrawerId: string;
  round: number;
  phase: GamePhase;
  wordLength: number | null;
  word: string | null;
  endsAt: number | null;      // epoch ms when the CURRENT phase ends (choosing/drawing/scoring)
  guessedIds: string[];       // players who've guessed correctly this turn
  drawnThisRound: string[];   // players who've already drawn in the current round
  wordOptions: WordOption[] | null; // the choices offered to the drawer (redacted from others)
  wordDifficulty: Difficulty | null; // difficulty of the CHOSEN word (null until chosen)
  wordPoints: number | null;         // display points of the CHOSEN word (null until chosen)
  rerollsLeft: number;               // reroll_words uses left this choosing turn (starts at 2)
  // per-letter reveal shown to guessers: "" = hidden, " " = space, else the letter.
  // Only ever holds revealed letters (safe to broadcast); null outside "drawing".
  hint: string[] | null;
  
  payout: PayoutEntry[] | null;
  turnStartedAt: number | null;  

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
  erase?:boolean; 
  strokeId?:number; 
  t?:number //ms since turn start (present in replayed only)
}

export interface DrawOp {
  kind: "line" | "rect" | "ellipse" | "fill";
  from: Point;
  to: Point;
  color: string;
  width: number;
  strokeId?: number;   // groups this op with the current stroke (for undo)
   t?:number
}

export type DrawEntry =
  | { kind: "stroke"; id: number; segs: DrawSegment[] }
  | { kind: "op"; id: number; op: DrawOp };
export interface ChatMessage {
  author: string;
  text: string;
  kind: "chat" | "system" | "correct";   // correct = someone guessed the word
  playerId?: string;
}

export const MAX_CHAT_LEN = 200;


export interface ChatEntry {
  msg: ChatMessage;
  at: number;                // epoch ms
  round: number | null;      // null outside a game
  drawerId: string | null;   // with `round`, identifies the turn
}
