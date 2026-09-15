import type { FastifyInstance, FastifyReply,FastifyRequest } from "fastify";
import {verifySession} from "../stores/sessionStore.js";
import {playerIdsFor} from "../stores/playerStore.js"
import { listMatches, getStats, getMatchDetail, getReplay } from "../stores/historyStore.js";

async function currentPlayerId(req: FastifyRequest): Promise<string | null> {
  const raw = req.cookies.sid;
  return raw ? await verifySession(raw) : null;
}

// Postgres refuses a malformed uuid or bigint with an error of its own, which
// Fastify then turns into a 500 carrying the driver's message — telling a
// stranger the column types and that there is a database behind this. Shapes
// are checked here instead, and a bad one is simply not found.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGITS = /^\d{1,19}$/;

export async function historyRoutes(app: FastifyInstance) { 
    app.get<{ Querystring: { limit?: string } }>("/api/history", async (req, reply) => {
        const me = await currentPlayerId(req);
        if (!me) return reply.status(401).send({ message: "no session" });
        const ids = await playerIdsFor(me);
        const limit = Math.min(Number(req.query.limit) || 20, 100);
        return listMatches(ids, limit);
    });
    app.get("/api/stats", async (req, reply) => {
        const me = await currentPlayerId(req);
        if (!me) return reply.status(401).send({ message: "no session" });
        return getStats(await playerIdsFor(me));
    });
    app.get<{ Params: { id: string } }>("/api/match/:id", async (req, reply) => {
        const me = await currentPlayerId(req);
        if (!me) return reply.status(401).send({ message: "no session" });
        const ids = await playerIdsFor(me);

        if (!UUID.test(req.params.id)) return reply.status(404).send({ message: "not found" });
        const detail = await getMatchDetail(req.params.id);
        if (!detail) return reply.status(404).send({ message: "not found" });
        if (!detail.participants.some((p) => ids.includes(p.playerId)))
            return reply.status(404).send({ message: "not found" });

        return detail;
    });

    app.get<{ Params: { turnId: string } }>("/api/replay/:turnId", async (req, reply) => {
        const me = await currentPlayerId(req);
        if (!me) return reply.status(401).send({ message: "no session" });
        const ids = await playerIdsFor(me);
        if (!DIGITS.test(req.params.turnId)) return reply.status(404).send({ message: "not found" });
        const entries = await getReplay(req.params.turnId, ids);
        if (!entries) return reply.status(404).send({ message: "not found" });
        return entries;
    });


 }

