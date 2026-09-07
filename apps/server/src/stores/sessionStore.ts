import { randomBytes, createHash } from "node:crypto";
import { pool } from "../db.js";

const SESSION_DAYS = 180;
function newToken(): string{
    return randomBytes(32).toString("base64url");
}        // randomBytes(32).toString("base64url")
function hashToken(raw: string){
   return  createHash("sha256").update(raw).digest("hex");
} 
export async function issueSession(playerId:string):Promise<string>{
    const token = newToken();
    const hashed = hashToken(token);
    await pool.query(`
    INSERT INTO sessions (token_hash,player_id,expires_at)
    VALUES($1,$2, now() + ($3 || ' days')::interval)`
    ,[hashed,playerId,SESSION_DAYS]);
    return token;
}

export async function verifySession(raw:string):Promise<string|null>{
   const r=  await pool.query(`UPDATE sessions
   SET expires_at = now() + ($2 || ' days')::interval
 WHERE token_hash = $1 AND expires_at > now()
RETURNING player_id
`,[hashToken(raw),SESSION_DAYS]) ;
return r.rows[0]?.player_id ?? null;
}
export async function revokeSession(raw:string):Promise<void>{
    await pool.query(`
        DELETE FROM sessions where token_hash =$1`,[hashToken(raw)]);
}
export async function deleteExpiredSessions(): Promise<number> {
    const r = await pool.query(`DELETE FROM sessions WHERE expires_at < now()`);
    return r.rowCount ?? 0;
}
