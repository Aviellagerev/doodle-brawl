import { gzipSync } from "node:zlib";
import { pool } from "../db.js";
import { MatchLog } from "../matchLog.js";
function collectPlayers(log: MatchLog): Map<string, string> {
    const tempPlayer = new Map<string, string>(
        log.participants.map(p => [p.playerId, p.displayName])
    );

    for (const entry of log.chat) {
        if (entry.msg.kind === "chat" && entry.msg.playerId) {
            if (!tempPlayer.has(entry.msg.playerId)) {
                tempPlayer.set(entry.msg.playerId, entry.msg.author);
            }
        }
    }
    for (const turn of log.turns) {
        if (!tempPlayer.has(turn.drawerId)) {
            tempPlayer.set(turn.drawerId, "Player");
        }
        for (const guess of turn.guesses) {
            if (!tempPlayer.has(guess.playerId)) {
                tempPlayer.set(guess.playerId, "Player");
            }
        }
    }
    return tempPlayer;

}
export async function saveMatch(log: MatchLog): Promise<string> {
    const players = collectPlayers(log);
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        for (const [id, name] of players) {
            await client.query(
                `INSERT INTO players (id,display_name) VALUES ($1,$2)
                ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name`, [id, name]
            )
        }
        const m = await client.query(`
            INSERT INTO matches (room_code,started_at,ended_at,settings)
            VALUES ($1,$2,$3,$4)
            RETURNING match_id
            `, [log.roomCode, new Date(log.startedAt), new Date(log.endedAt)
            , JSON.stringify(log.settings),
        ]);
        //inserts match and takes the minted id 
        const matchId: string = m.rows[0].match_id;

        for (const p of log.participants) {
            await client.query(`
            INSERT INTO match_participants (match_id,player_id,display_name,final_score,placement)
            VALUES ($1,$2,$3,$4,$5)`,
                [matchId, p.playerId, p.displayName, p.finalScore, p.placement]);
        }

        const turnIds = new Map<string, string>();

        for (const t of log.turns) {
            const r = await client.query(
                `INSERT INTO match_turns (match_id, round, turn_index, drawer_id, word, difficulty, drawer_points)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING turn_id`,
                [matchId, t.round, t.turnIndex, t.drawerId, t.word, t.difficulty, t.drawerPoints],
            );
            const turnId: string = r.rows[0].turn_id;
            turnIds.set(`${t.round}:${t.drawerId}`, turnId);
            if (t.replay.length > 0) {
                const data = gzipSync(JSON.stringify(t.replay));
                await client.query(
                    `INSERT INTO match_replays (turn_id, format, data, byte_size)
     VALUES ($1, $2, $3, $4)`,
                    [turnId, 1, data, data.length],
                );
            }
            for (const g of t.guesses) {
                await client.query(
                    `INSERT INTO turn_guesses (turn_id, player_id, ms_to_guess, points)
     VALUES ($1, $2, $3, $4)`,
                    [turnId, g.playerId, g.msToGuess, g.points],
                );
            }


        }
        for (const e of log.chat) {
            const turnId =
                e.round === null ? null : turnIds.get(`${e.round}:${e.drawerId}`) ?? null;

            await client.query(
                `INSERT INTO match_chat (match_id, turn_id, player_id, display_name, text, kind, at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [matchId, turnId, e.msg.playerId ?? null, e.msg.author, e.msg.text, e.msg.kind, new Date(e.at)],
            );
        }


        await client.query("COMMIT");
        return matchId;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }

}

