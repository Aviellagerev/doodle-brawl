
import {
  GameState, GamePhase, RoomState, Player, RoomSettings,
  WordOption, Difficulty, DIFFICULTY_POINTS, DIFFICULTY_MULTIPLIER,
} from "../../../../packages/shared/index.js";
import { WORD_BANK, difficultyForList } from "./words.js";
import { foldGuess } from "./guess.js";


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


// `count` distinct picks, uniformly (a partial Fisher–Yates).
function sample<T>(items: T[], count: number): T[] {
  const a = [...items];
  const n = Math.min(count, a.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

export function pickWords(count: number, settings: RoomSettings): WordOption[] {
  const custom = settings.customWords.map((w) => w.trim()).filter(Boolean);

  // one option per spell as a guesser would type it (so "Cat" and "cat" are
  // one), the first occurrence keeping its spelling and difficulty
  const byKey = new Map<string, WordOption>();
  const add = (word: string, difficulty: Difficulty) => {
    const key = foldGuess(word) || word;
    if (!byKey.has(key)) byKey.set(key, makeOption(word, difficulty));
  };

  // "only these" with nothing written would offer nothing — the grimoires stand in
  if (settings.customWordsOnly && custom.length) {
    for (const w of custom) add(w, "normal");
  } else {
    let bank = WORD_BANK.filter((e) => e.lang === settings.language);
    if (settings.lists.length) {
      const narrowed = bank.filter((e) => settings.lists.includes(e.list));
      if (narrowed.length) bank = narrowed; // don't let a bad filter empty the pool
    }
    for (const e of bank) add(e.word, difficultyForList(e.list));
    for (const w of custom) add(w, "normal");
  }

  if (byKey.size === 0) {
    // last resort — never leave the drawer with nothing to pick
    return sample(WORD_BANK, count).map((e) => makeOption(e.word, difficultyForList(e.list)));
  }
  return sample([...byKey.values()], count);
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
     turnStartedAt: null,
    guessedIds: [],
    drawnThisRound,
    wordOptions: null,
    wordDifficulty: null,
    wordPoints: null,
    rerollsLeft: 2,
    hint: null,
    wordDir: null,
    payout: null,
  };
}

// The spell as its blanks count it: letters only, one space between its
// words. An apostrophe or a geresh is not a letter — ג'ירפה is five blanks,
// not six, with nothing in the middle — and a hyphen parts words the way a
// space does. A guess ignores both, so nothing is lost by leaving them out.
// (A spell with no letters at all — a host's emoji — keeps its own form.)
export function hintForm(word: string): string {
  const letters = word
    .replace(/\p{Pd}/gu, " ")               // hyphens, dashes, the Hebrew maqaf
    .replace(/[^\p{L}\p{N}\s]/gu, "")       // apostrophes, geresh, dots, niqqud
    .replace(/\s+/g, " ")
    .trim();
  return letters || word;
}

// Which way a spell is written — decided by its first letter, as a browser
// would for dir="auto". Shared with everyone: it is no more of a clue than the
// room's tongue, and without it the blanks of a Hebrew spell read backwards.
export function writingDirection(word: string): "ltr" | "rtl" {
  const first = word.match(/\p{L}/u)?.[0] ?? "";
  return /\p{Script=Hebrew}|\p{Script=Arabic}/u.test(first) ? "rtl" : "ltr";
}

// Build the initial reveal mask for a word: one blank per letter of its
// hint form, and the spaces between its words.
export function initialHint(word: string): string[] {
  return [...hintForm(word)].map((c) => (c === " " ? " " : ""));
}

// Reveal one more random hidden letter, keeping at least one letter hidden.
// Mutates game.hint in place; returns true if a letter was revealed.
export function revealHintLetter(game: GameState): boolean {
  if (!game.word || !game.hint) return false;
  const hidden: number[] = [];
  for (let i = 0; i < game.hint.length; i++) if (game.hint[i] === "") hidden.push(i);
  if (hidden.length <= 1) return false;   // never uncover the last letter
  const i = hidden[Math.floor(Math.random() * hidden.length)];
  game.hint[i] = [...hintForm(game.word)][i];   // from the same form the mask was built on
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

// The room as one wizard may see it: the caster sees the spell, and so does
// anyone who has already divined it; everyone else gets the public view.
export function viewFor(room: RoomState, playerId: string): RoomState {
  const game = room.game;
  const knows = !!game && (game.currentDrawerId === playerId || game.guessedIds.includes(playerId));
  return knows ? room : publicRoom(room);
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
    wordLength: [...hintForm(word)].length,   // the blanks, not the characters
    endsAt: now + drawTimeMs,
    guessedIds: [],
    wordOptions: null,   // options consumed once a word is chosen
    wordDifficulty: difficulty,
    wordPoints: points,
    hint: initialHint(word),
    wordDir: writingDirection(word),
    payout: [],   // fresh per-turn score breakdown; filled as players guess
    turnStartedAt: now
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
