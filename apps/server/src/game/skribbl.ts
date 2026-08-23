
import {
  GameState, GamePhase, RoomState, Player, RoomSettings,
  WordOption, Difficulty, DIFFICULTY_POINTS, DIFFICULTY_MULTIPLIER,
} from "../../../../packages/shared/index.js";
import { WORD_BANK, difficultyForList } from "./words.js";


function makeOption(word: string, difficulty: Difficulty): WordOption {
  return { word, difficulty, points: DIFFICULTY_POINTS[difficulty] };
}


export const DEFAULT_SETTINGS: RoomSettings = {
  rounds: 3,
  drawTimeMs: 60_000,
  wordChoices: 3,
  maxPlayers: 8,
  language: "en",
  lists: [],            // [] = all lists for the language
  customWords: [],
  customWordsOnly: false,
  hints: 2,             // reveal up to 2 letters over the drawing time
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


export function pickWords(count: number, settings: RoomSettings): WordOption[] {
  const custom = settings.customWords.map((w) => w.trim()).filter(Boolean);

  // dedupe by word (first occurrence wins), tracking each word's difficulty
  const byWord = new Map<string, Difficulty>();

  if (settings.customWordsOnly) {
    for (const w of custom) if (!byWord.has(w)) byWord.set(w, "normal");
  } else {
    let bank = WORD_BANK.filter((e) => e.lang === settings.language);
    if (settings.lists.length) {
      const narrowed = bank.filter((e) => settings.lists.includes(e.list));
      if (narrowed.length) bank = narrowed; // don't let a bad filter empty the pool
    }
    for (const e of bank) if (!byWord.has(e.word)) byWord.set(e.word, difficultyForList(e.list));
    for (const w of custom) if (!byWord.has(w)) byWord.set(w, "normal");
  }

  if (byWord.size === 0) {
    // last resort — never leave the drawer with nothing to pick
    return WORD_BANK.slice(0, count).map((e) => makeOption(e.word, difficultyForList(e.list)));
  }

  const words = [...byWord.keys()].sort(() => 0.5 - Math.random()).slice(0, Math.min(count, byWord.size));
  return words.map((w) => makeOption(w, byWord.get(w)!));
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
    wordDifficulty: null,
    wordPoints: null,
    rerollsLeft: 2,
    hint: null,
    payout: null,
  };
}

// Build the initial reveal mask for a word: spaces shown, every letter hidden.
export function initialHint(word: string): string[] {
  return [...word].map((c) => (c === " " ? " " : ""));
}

// Reveal one more random hidden letter, keeping at least one letter hidden.
// Mutates game.hint in place; returns true if a letter was revealed.
export function revealHintLetter(game: GameState): boolean {
  if (!game.word || !game.hint) return false;
  const hidden: number[] = [];
  for (let i = 0; i < game.hint.length; i++) if (game.hint[i] === "") hidden.push(i);
  if (hidden.length <= 1) return false;   // never uncover the last letter
  const i = hidden[Math.floor(Math.random() * hidden.length)];
  game.hint[i] = game.word[i];
  return true;
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
  // resolve the chosen word's difficulty from the offered options (fallback normal/200)
  const opt = game.wordOptions?.find((o) => o.word === word);
  const difficulty: Difficulty = opt?.difficulty ?? "normal";
  const points = opt?.points ?? DIFFICULTY_POINTS[difficulty];
  return {
    ...game,
    phase: "drawing",
    word,
    wordLength: word.length,
    endsAt: now + drawTimeMs,
    guessedIds: [],
    wordOptions: null,   // options consumed once a word is chosen
    wordDifficulty: difficulty,
    wordPoints: points,
    hint: initialHint(word),
    payout: [],   // fresh per-turn score breakdown; filled as players guess
  };
}

// Multiply the raw time-based guess points by the difficulty tier and round.
export function scaleByDifficulty(pts: number, difficulty: Difficulty | null): number {
  return Math.round(pts * DIFFICULTY_MULTIPLIER[difficulty ?? "normal"]);
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
