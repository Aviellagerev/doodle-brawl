import test, { before } from "node:test";
import assert from "node:assert/strict";
import { resetRateLimits } from "./helpers.js";
import { randomUUID } from "node:crypto";
import { pool } from "../src/db.js";
import { pruneIdleGuests } from "../src/stores/playerStore.js";

before(resetRateLimits);

/**
 * The janitor. It deletes rows, so the guards matter more than the sweeping:
 * an account is never touched, and neither is anyone recent enough to be
 * sitting in a circle right now.
 */

async function insertPlayer(ageDays: number, opts: { userId?: string | null } = {}) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO players (id, display_name, user_id, created_at)
     VALUES ($1, $2, $3, now() - ($4 || ' days')::interval)`,
    [id, "Prunable", opts.userId ?? null, String(ageDays)],
  );
  return id;
}

const exists = async (id: string) =>
  (await pool.query("SELECT 1 FROM players WHERE id = $1", [id])).rowCount === 1;

test("an old guest who never played is swept", async (t) => {
  const old = await insertPlayer(60);
  const recent = await insertPlayer(0);
  t.after(async () => {
    await pool.query("DELETE FROM players WHERE id = ANY($1)", [[old, recent]]);
  });

  const accountsBefore = (await pool.query("SELECT count(*) FROM players WHERE user_id IS NOT NULL")).rows[0].count;
  const gone = await pruneIdleGuests(30);

  assert.ok(gone >= 1, "it swept something");
  assert.equal(await exists(old), false, "the old idle guest is gone");
  assert.equal(await exists(recent), true, "today's guest is left alone — they may be mid-rite");

  const accountsAfter = (await pool.query("SELECT count(*) FROM players WHERE user_id IS NOT NULL")).rows[0].count;
  assert.equal(accountsAfter, accountsBefore, "no account was touched");
});

test("a guest who played is kept, however old", async (t) => {
  // borrow a real match so the foreign key holds
  const match = await pool.query("SELECT match_id FROM matches ORDER BY ended_at DESC LIMIT 1");
  if (match.rowCount === 0) return t.skip("no match in the database to attach to");

  const played = await insertPlayer(400);
  await pool.query(
    `INSERT INTO match_participants (match_id, player_id, display_name, final_score, placement)
     VALUES ($1, $2, $3, 0, 1)`,
    [match.rows[0].match_id, played, "Veteran"],
  );
  t.after(async () => {
    await pool.query("DELETE FROM match_participants WHERE player_id = $1", [played]);
    await pool.query("DELETE FROM players WHERE id = $1", [played]);
  });

  await pruneIdleGuests(30);
  assert.equal(await exists(played), true, "history is what makes a guest worth keeping");
});
