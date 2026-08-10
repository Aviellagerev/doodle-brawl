
import { GameState, GamePhase, RoomState } from "../../../../packages/shared/index.js";


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

export function pickWords(): string[] {
  return [...drawingWords].sort(() => 0.5 - Math.random()).slice(0, 3);
}

export function createInitialGame(drawerId: string): GameState {
  return {
    currentDrawerId: drawerId,
    round: 1,
    phase: "choosing",
    word: null,
    wordLength: null,
  };
}

export function publicRoom(room:RoomState):RoomState{
  if(!room.game) return room;
  return{
    ...room,
    game:{...room.game,word:null},
  };
}

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
