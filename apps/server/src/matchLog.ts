import {
  RoomState, GameState, Player, RoomSettings, DrawEntry, Difficulty,
} from "../../../packages/shared/index.js";

export interface GuessLog {
  playerId: string;
  msToGuess: number | null;
  points: number;
}

export interface TurnLog {
  round: number;
  turnIndex: number;
  drawerId: string;
  word: string;
  difficulty: Difficulty;
  drawerPoints: number;
  guesses: GuessLog[];
  replay: DrawEntry[];
}

export interface ParticipantLog {
  playerId: string;
  displayName: string;
  finalScore: number;
  placement: number;
}

export interface MatchLog {
  roomCode: string;
  startedAt: number;
  endedAt: number;
  settings: RoomSettings;
  turns: TurnLog[];
  participants: ParticipantLog[];
}

const matchLogs = new Map<string, MatchLog>();

function currentTurn(roomId: string): TurnLog | null {
  const log = matchLogs.get(roomId);
  if (!log || log.turns.length === 0) return null;
  return log.turns[log.turns.length - 1];
}

export function startMatch(roomId: string, room: RoomState): void {
  matchLogs.set(roomId, {
    roomCode: room.roomId,
    startedAt: Date.now(),
    endedAt: 0,
    settings: { ...room.settings },
    turns: [],
    participants: [],
  });
}

export function startTurn(roomId: string, game: GameState): void {
  const log = matchLogs.get(roomId);
  if (!log || !game.word) return;
  log.turns.push({
    round: game.round,
    turnIndex: log.turns.length,
    drawerId: game.currentDrawerId,
    word: game.word,
    difficulty: game.wordDifficulty ?? "normal",
    drawerPoints: 0,
    guesses: [],
    replay: [],
  });
}

export function logGuess(
  roomId: string,
  playerId: string,
  msToGuess: number,
  points: number,
  drawerBonus: number,
): void {
  const turn = currentTurn(roomId);
  if (!turn) return;
  if (turn.guesses.some((g) => g.playerId === playerId)) return;
  turn.guesses.push({ playerId, msToGuess, points });
  turn.drawerPoints += drawerBonus;
}

export function closeTurn(roomId: string, players: Player[], replay: DrawEntry[]): void {
  const turn = currentTurn(roomId);
  if (!turn) return;
  turn.replay = replay;
  for (const p of players) {
    if (p.id === turn.drawerId) continue;
    if (turn.guesses.some((g) => g.playerId === p.id)) continue;
    turn.guesses.push({ playerId: p.id, msToGuess: null, points: 0 });
  }
}

export function takeMatch(roomId: string, players: Player[], endedAt: number): MatchLog | null {
  const log = matchLogs.get(roomId);
  if (!log) return null;
  matchLogs.delete(roomId);
  log.endedAt = endedAt;
  log.participants = [...players]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((p, i) => ({
      playerId: p.id,
      displayName: p.name,
      finalScore: p.score ?? 0,
      placement: i + 1,
    }));
  return log;
}

export function forgetMatch(roomId: string): void {
  matchLogs.delete(roomId);
}
