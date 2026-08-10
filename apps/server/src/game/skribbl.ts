// Skribbl game rules.
//
// Everything here is a PURE function: it takes the current state (plus any
// input) and returns the next state. No sockets, no Redis, no I/O, no `io.emit`.
// The transport layer (socket handlers) calls these, then persists the result
// via the store and emits it to clients.
//
// Why this shape:
//   - a future mode ("gartic") is "call a different set of pure functions",
//     selected by room.mode — the seam is here, not smeared across handlers.
//   - pure functions are trivial to unit-test: give a state, assert the result.
//   - the rules read top-to-bottom in one file instead of being hidden inside
//     event handlers.

import { GameState, GamePhase } from "../../../../packages/shared/index.js";

// --- The round state machine -------------------------------------------------
// The ONLY legal phase transitions in a skribbl round. Anything not listed here
// is a bug, a duplicate event, or a malicious client — and gets rejected by the
// `canAdvance` guard below rather than silently corrupting the game.
const PHASE_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  choosing: ["drawing"],          // the drawer picked a word
  drawing:  ["scoring"],          // time ran out, or everyone guessed
  scoring:  ["choosing", "done"], // start the next round, or end the game
  done:     [],                   // terminal
};

// Guard: is moving from `from` to `to` a legal transition?
// Call this before any phase change so illegal jumps can't happen.
export function canAdvance(from: GamePhase, to: GamePhase): boolean {
  return PHASE_TRANSITIONS[from].includes(to);
}

// --- Word selection ----------------------------------------------------------
const drawingWords: string[] = [
  "apple", "house", "car", "tree", "sun", "cat", "dog", "cloud", "chair",
  "book", "pizza", "clock", "guitar", "banana", "star", "pencil", "fish",
  "cup", "bird", "elephant",
];

// Three random words for the drawer to choose from.
// Note: spread into a NEW array first — sort() mutates in place, and sorting
// the shared `drawingWords` on every call would corrupt the source list.
export function pickWords(): string[] {
  return [...drawingWords].sort(() => 0.5 - Math.random()).slice(0, 3);
}

// --- Pure state builders / transitions ---------------------------------------

// The initial game state when a room starts playing: `drawerId` is the first
// drawer, round 1, phase "choosing" (they're about to pick a word).
export function createInitialGame(drawerId: string): GameState {
  return {
    currentDrawerId: drawerId,
    round: 1,
    phase: "choosing",
    word: null,
    wordLength: null,
  };
}

// The drawer chose a word: choosing → drawing. Records the word and its length.
// Throws if called from the wrong phase — the guard turns an illegal event into
// a loud error instead of a corrupted round.
export function chooseWord(game: GameState, word: string): GameState {
  if (!canAdvance(game.phase, "drawing")) {
    throw new Error(`chooseWord called in phase "${game.phase}"`);
  }
  return {
    ...game,
    phase: "drawing",
    word,
    wordLength: word.length,
  };
}
