import { gunzipSync } from "node:zlib";
import { pool } from "../db.js";
import type {
  MatchSummary, MatchDetail, MatchParticipant, TurnDetail, PlayerStats, MatchChatLine,
} from "../../../../packages/shared/index.js";

function foldTurns(rows: any[]): TurnDetail[] {
  const byId = new Map<string, TurnDetail>();
  for (const r of rows) {
    let t = byId.get(r.turn_id);
    if (!t) {
      t = {
        turnId: r.turn_id, round: r.round, turnIndex: r.turn_index,
        word: r.word, difficulty: r.difficulty,
        drawerName: r.drawer_name, drawerPoints: r.drawer_points,
        hasReplay: r.has_replay, guesses: []
      };
      byId.set(r.turn_id, t);
    }
    if (r.player_id) {
      t.guesses.push({
        playerId: r.player_id, displayName: r.guesser_name,
        msToGuess: r.ms_to_guess, points: r.points,
      });
    }
  }
  return [...byId.values()];
}

export async function getMatchDetail(matchId: string): Promise<MatchDetail | null> {
  const { rows: [match] } = await pool.query(
    `SELECT match_id, room_code, started_at, ended_at, settings
     FROM matches WHERE match_id = $1`, [matchId]);
  if (!match) return null;

  const { rows: parts } = await pool.query(
    `SELECT player_id, display_name, final_score, placement
     FROM match_participants WHERE match_id = $1 ORDER BY placement`, [matchId]);

  const { rows: turnRows } = await pool.query(
    `SELECT t.turn_id, t.round, t.turn_index, t.word, t.difficulty, t.drawer_points,
       d.display_name AS drawer_name,
       (r.turn_id IS NOT NULL) AS has_replay,
       tg.player_id, g.display_name AS guesser_name, tg.ms_to_guess, tg.points
  FROM match_turns t
  JOIN      players       d  ON d.id = t.drawer_id
  LEFT JOIN match_replays r  ON r.turn_id = t.turn_id
  LEFT JOIN turn_guesses  tg ON tg.turn_id = t.turn_id
  LEFT JOIN players       g  ON g.id = tg.player_id
 WHERE t.match_id = $1
 ORDER BY t.turn_index, tg.points DESC NULLS LAST
`, [matchId]);
  const { rows: chatRows } = await pool.query(
    `SELECT turn_id, player_id, display_name, text, kind, at
       FROM match_chat WHERE match_id = $1
      ORDER BY at`,
    [matchId],
  );

  return {
    matchId: match.match_id,
    roomCode: match.room_code,
    startedAt: match.started_at.toISOString(),
    endedAt: match.ended_at.toISOString(),
    settings: match.settings,
    participants: parts.map((p) => ({
      playerId: p.player_id,
      displayName: p.display_name,
      finalScore: p.final_score,
      placement: p.placement,
    })),
    turns: foldTurns(turnRows),
    chat: chatRows.map((c): MatchChatLine => ({
      turnId: c.turn_id === null ? null : String(c.turn_id),
      playerId: c.player_id,
      displayName: c.display_name,
      text: c.text,
      kind: c.kind,
      at: c.at.toISOString(),
    })),
  };
}
export async function listMatches(playerIds: string[], limit = 20): Promise<MatchSummary[]> {
  const r = await pool.query(
    `SELECT m.match_id, m.room_code, m.ended_at,
            (m.settings->>'rounds')::int AS rounds,
            mp.display_name, mp.final_score, mp.placement,
            (SELECT count(*) FROM match_participants x
              WHERE x.match_id = m.match_id) AS player_count
       FROM match_participants mp
       JOIN matches m ON m.match_id = mp.match_id
      WHERE mp.player_id = ANY($1)
      ORDER BY m.ended_at DESC
      LIMIT $2`,
    [playerIds, limit],
  );
  return r.rows.map((x) => ({
    matchId: x.match_id,
    roomCode: x.room_code,
    endedAt: x.ended_at.toISOString(),
    rounds: Number(x.rounds ?? 0),
    displayName: x.display_name,
    finalScore: x.final_score,
    placement: x.placement,
    playerCount: Number(x.player_count),
  }));
}

export async function getStats(playerIds: string[]): Promise<PlayerStats> {
  const { rows: [g] } = await pool.query(
    `SELECT count(*)               AS chances,
            count(ms_to_guess)     AS guessed,
            round(avg(ms_to_guess)) AS avg_ms,
            min(ms_to_guess)       AS fastest_ms
       FROM turn_guesses
      WHERE player_id = ANY($1)`,
    [playerIds],
  );
  const { rows: [m] } = await pool.query(
    `SELECT count(DISTINCT match_id)                       AS played,
            count(*) FILTER (WHERE placement = 1)          AS won
       FROM match_participants
      WHERE player_id = ANY($1)`,
    [playerIds],
  );
  const chances = Number(g.chances);
  const guessed = Number(g.guessed);
  return {
    matchesPlayed: Number(m.played),
    matchesWon: Number(m.won),
    chances,
    guessed,
    hitRatePct: chances === 0 ? 0 : Math.round((100 * guessed) / chances),
    avgMs: g.avg_ms === null ? null : Number(g.avg_ms),
    fastestMs: g.fastest_ms === null ? null : Number(g.fastest_ms),
  };
}

export async function getReplay(turnId: string, playerIds: string[]): Promise<unknown[] | null> {
  const { rows: [row] } = await pool.query(
    `SELECT r.data
       FROM match_replays r
       JOIN match_turns t ON t.turn_id = r.turn_id
      WHERE r.turn_id = $1
        AND EXISTS (SELECT 1 FROM match_participants mp
                     WHERE mp.match_id = t.match_id
                       AND mp.player_id = ANY($2))`,
    [turnId, playerIds],
  );
  if (!row) return null;
  return JSON.parse(gunzipSync(row.data).toString());
}
