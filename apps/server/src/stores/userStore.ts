import argon2 from "argon2";
import { pool } from "../db.js";
import { cleanName, PublicUser } from "../../../../packages/shared/index.js";
export type UserRow = PublicUser;
const DUMMY_HASH = "$argon2id$v=19$m=19456,p=1,t=2$F0aalYjXLHtH21wNwcJROQ$Ji8rAYbeK0LaXz8m81nzxwhT1PZs5WlBlrn7vp0ZWYg";

export async function createUser(email: string, username: string, password: string): Promise<UserRow | null> {
  //we need to normlize the email 
  //open connection
  const key = email.trim().toLowerCase();
  const hash = await argon2.hash(password, {
    type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1,
  });
  const nameClean = cleanName(username)

  try {
    const r = await pool.query(`
      INSERT INTO users (email,password_hash,username)  VALUES ($1,$2,$3) RETURNING id,email,username`, [key, hash, nameClean]);
    return r.rows[0];
  }
  catch (err: any) {
    if (err?.code === "23505") return null; //exsists

    throw err;
  }


  //we do a test here 
}
export async function verifyCredentials(email: string, password: string): Promise<UserRow | null> {
  const key = email.trim().toLowerCase();

  const r = await pool.query(
    `SELECT id, email, username, password_hash FROM users WHERE email = $1`,
    [key],
  );
  const row = r.rows[0];

  if (!row) { await argon2.verify(DUMMY_HASH, password); return null; }
  if (!(await argon2.verify(row.password_hash, password))) return null;

  return { id: row.id, email: row.email, username: row.username };

}

export async function findUserById(id: string): Promise<UserRow | null> {
  const r = await pool.query<UserRow>(
    `SELECT id, email, username FROM users WHERE id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}
