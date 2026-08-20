
import { GameState, GamePhase, RoomState, Player, RoomSettings } from "../../../../packages/shared/index.js";


export const DEFAULT_SETTINGS: RoomSettings = {
  rounds: 3,
  drawTimeMs: 60_000,
  wordChoices: 3,
  maxPlayers: 8,
};


const PHASE_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  choosing: ["drawing"],          // the drawer picked a word
  drawing:  ["scoring"],          // time ran out, or everyone guessed
  scoring:  ["choosing", "done"], // start the next round, or end the game
  done:     [],                   // terminal
};


export function canAdvance(from: GamePhase, to: GamePhase): boolean {
  return PHASE_TRANSITIONS[from].includes(to);
}

// --- Word selection ----------------------------------------------------------
const drawingWords: string[] = [
  "apple", "house", "car", "tree", "sun", "cat", "dog", "cloud", "chair",
  "book", "pizza", "clock", "guitar", "banana", "star", "pencil", "fish",
  "cup", "bird", "elephant",
];

export function pickWords(count: number): string[] {
  return [...drawingWords].sort(() => 0.5 - Math.random()).slice(0, count);
}

// A fresh "choosing" turn for the given drawer.
function choosingTurn(drawerId: string, round: number, drawnThisRound: string[]): GameState {
  return {
    currentDrawerId: drawerId,
    round,
    phase: "choosing",
    word: null,
    wordLength: null,
    endsAt: null,
    guessedIds: [],
    drawnThisRound,
    wordOptions: null,
  };
}

export function createInitialGame(drawerId: string): GameState {
  return choosingTurn(drawerId, 1, []);
}


export function publicRoom(room: RoomState): RoomState {
  if (!room.game) return room;
  const hideWord = room.game.phase === "choosing" || room.game.phase === "drawing";
  if (!hideWord) return room;
  // hide both the answer and the candidate options from non-drawers
  return { ...room, game: { ...room.game, word: null, wordOptions: null } };
}


export function chooseWord(game: GameState, word: string, now: number, drawTimeMs: number): GameState {
  if (!canAdvance(game.phase, "drawing")) {
    throw new Error(`chooseWord called in phase "${game.phase}"`);
  }
  return {
    ...game,
    phase: "drawing",
    word,
    wordLength: word.length,
    endsAt: now + drawTimeMs,
    guessedIds: [],
    wordOptions: null,   // options consumed once a word is chosen
  };
}

// End the round: drawing → scoring, clock stopped. The word gets revealed by
// publicRoom once we're in "scoring".
export function toScoring(game: GameState): GameState {
  return { ...game, phase: "scoring", endsAt: null };
}

// --- Scoring (time-based) ----------------------------------------------------
// A guesser earns more the sooner they guess: 50 (last second) → 150 (instant).
export function guessPoints(timeLeftMs: number, drawTimeMs: number): number {
  const frac = Math.max(0, Math.min(1, timeLeftMs / drawTimeMs));
  return 50 + Math.round(100 * frac);
}

// The drawer earns a bonus per correct guesser — half of what that guesser got.
export function drawerBonus(guessPts: number): number {
  return Math.round(guessPts / 2);
}

// Have all the non-drawer players guessed correctly? (used to end the turn early)
export function allGuessed(game: GameState, players: Player[]): boolean {
  const guessers = players.filter((p) => p.id !== game.currentDrawerId);
  return guessers.length > 0 && guessers.every((p) => game.guessedIds.includes(p.id));
}

// --- Round loop --------------------------------------------------------------
export interface AdvanceResult {
  done: boolean;     // is the whole game over?
  game: GameState;   // the next game state (choosing) or the final one (done)
}


export function advanceTurn(game: GameState, players: Player[], rounds: number): AdvanceResult {
  const drawn = [...game.drawnThisRound, game.currentDrawerId];
  const remaining = players.filter((p) => !drawn.includes(p.id));

  if (remaining.length > 0) {
    // players still haven't drawn this round → the next of them goes
    return { done: false, game: choosingTurn(remaining[0].id, game.round, drawn) };
  }
  if (game.round >= rounds) {
    return { done: true, game: { ...game, phase: "done" } };  // whole game over
  }
  // next round: reset who's drawn, first player draws
  return { done: false, game: choosingTurn(players[0].id, game.round + 1, []) };
}
