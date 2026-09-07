import type { FastifyInstance, FastifyReply,FastifyRequest } from "fastify";
import {verifySession} from "../stores/sessionStore.js";
import {playerIdsFor} from "../stores/playerStore.js"
import { listMatches ,getStats,getMatchDetail} from "../stores/historyStore.js";

async function currentPlayerId(req: FastifyRequest): Promise<string | null> {
  const raw = req.cookies.sid;
  return raw ? await verifySession(raw) : null;
}

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

        const detail = await getMatchDetail(req.params.id);
        if (!detail) return reply.status(404).send({ message: "not found" });
        if (!detail.participants.some((p) => ids.includes(p.playerId)))
            return reply.status(404).send({ message: "not found" });

        return detail;
    });


 }

