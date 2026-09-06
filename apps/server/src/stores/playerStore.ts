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