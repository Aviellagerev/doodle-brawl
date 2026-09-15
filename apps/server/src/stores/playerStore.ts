import { pool } from "../db.js";
import { UserRow } from "./userStore.js";

export interface PlayerRow {
  id: string;
  displayName: string;
  userId: string | null;
}

function toPlayer(r: { id: string; display_name: string; user_id: string | null }): PlayerRow {
  return { id: r.id, displayName: r.display_name, userId: r.user_id };
}
export async function playerIdsFor(playerId: string): Promise<string[]>{
    const rows = await pool.query(`SELECT id FROM players
 WHERE id = $1
    OR (user_id IS NOT NULL
        AND user_id = (SELECT user_id FROM players WHERE id = $1))`,[playerId]);

return rows.rows.map(r => r.id);
}
export async function getPlayer(id: string): Promise<PlayerRow | null> {
  const r = await pool.query(
    `SELECT id, display_name, user_id FROM players WHERE id = $1`,
    [id],
  );
  return r.rows[0] ? toPlayer(r.rows[0]) : null;
}

export async function createGuest(displayName: string): Promise<PlayerRow> {
  const r = await pool.query(
    `INSERT INTO players (id, display_name) VALUES (gen_random_uuid(), $1)
     RETURNING id, display_name, user_id`,
    [displayName],
  );
  return toPlayer(r.rows[0]);
}

export async function renamePlayer(id: string, displayName: string): Promise<void> {
  await pool.query(
    `UPDATE players SET display_name = $2 WHERE id = $1`,
    [id, displayName],
  );
}
export async function claimPlayer(playerId:string,userId:string ): Promise<boolean>{
   const r = await pool.query(
    `UPDATE players SET user_id = $2 WHERE id = $1 AND user_id IS NULL`,
    [playerId, userId],
  );
   return r.rowCount === 1;
}
export async function findPlayerForUser(userId: string): Promise<PlayerRow | null> {
  const r = await pool.query(
    `SELECT id, display_name, user_id FROM players
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId],
  );
  return r.rows[0] ? toPlayer(r.rows[0]) : null;
}

/**
 * Delete guests who never played.
 *
 * A guest row is created the moment somebody joins a circle, and most of them
 * never come back. This removes the ones that are provably worthless: no
 * account, no match ever recorded, and old enough that they cannot be mid-rite.
 * Accounts and anyone with history are never touched, and sessions go with them
 * through ON DELETE CASCADE.
 */
export async function pruneIdleGuests(olderThanDays = 30): Promise<number> {
  const r = await pool.query(
    `DELETE FROM players p
      WHERE p.user_id IS NULL
        AND p.created_at < now() - ($1 || ' days')::interval
        AND NOT EXISTS (SELECT 1 FROM match_participants mp WHERE mp.player_id = p.id)`,
    [String(olderThanDays)],
  );
  return r.rowCount ?? 0;
}
