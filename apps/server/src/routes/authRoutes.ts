
import type { FastifyInstance, FastifyReply } from "fastify";
import { issueSession, verifySession, revokeSession } from "../stores/sessionStore.js";
import { getPlayer, createGuest, claimPlayer, renamePlayer, findPlayerForUser } from "../stores/playerStore.js";
import { createUser, verifyCredentials } from "../stores/userStore.js";

const COOKIE_OPTS = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
} as const;

function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
const MIN_PASSWORD_LEN = 10;

function isValidPassword(password: string): boolean {
    return password.length >= MIN_PASSWORD_LEN;
}
async function startSession(reply: FastifyReply, playerId: string) {
    const token = await issueSession(playerId);
    reply.setCookie("sid", token, COOKIE_OPTS);
}

export async function authRoutes(app: FastifyInstance) {
    app.get("/api/me", async (req, reply) => {
        const raw = req.cookies.sid;
        const playerId = raw ? await verifySession(raw) : null;
        const player = playerId ? await getPlayer(playerId) : null;
        if (player) return { playerId: player.id, displayName: player.displayName };
        const fresh = await createGuest("Guest");
        await startSession(reply, fresh.id);

        return { playerId: fresh.id, displayName: fresh.displayName };
    });



    app.post("/api/signup", {
        config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    }, async (req, reply) => {


        const raw = req.cookies.sid;
        const currentId = raw ? await verifySession(raw) : null;
        if (!currentId) return reply.status(401).send({ message: "no session" });

        const { email, password, username } = (req.body ?? {}) as Record<string, string | undefined>;
        const errors: Record<string, string> = {};


        if (!username || username.trim() === '') {
            errors.username = "Username is required.";
        }


        if (!email) {
            errors.email = "Email is required.";
        } else if (!isValidEmail(email)) {
            errors.email = "Invalid email format.";
        }


        if (!password) {
            errors.password = "Password is required.";
        } else if (!isValidPassword(password)) {
            errors.password = `Password must be at least ${MIN_PASSWORD_LEN} characters long.`;
        }

        if (Object.keys(errors).length > 0) {
            return reply.status(400).send({
                statusCode: 400,
                error: "Bad Request",
                message: "Validation failed for one or more fields.",
                details: errors // Map containing custom messages per property field
            });
            return;
        }
        //here all is good we try to add it 
        const k = await createUser(email as string, username as string, password as string);
        if (!k) {
            return reply.status(409).send({
                statusCode: 409,
                error: "Conflict",
                message: "That email is already registered.",
                details: { email: "That email is already registered." },
            });
        }
        const claimed = await claimPlayer(currentId, k.id);
        const playerId = claimed ? currentId : (await createGuest(k.username ?? "Player")).id;
        if (claimed && k.username) await renamePlayer(playerId, k.username);
        await startSession(reply, playerId);            // rotate: session fixation
        return reply.status(201).send({ playerId, user: k });
    })

    app.post("/api/login", {
        config: { rateLimit: { max: 8, timeWindow: "15 minutes" } },
    }, async (req, reply) => {
        const { email, password } = (req.body ?? {}) as Record<string, string | undefined>;
        if (!email || !password) {
            return reply.status(400).send({
                statusCode: 400,
                error: "Bad Request",
                message: "Email and password are required.",
            });
        }

        const user = await verifyCredentials(email, password);
        if (!user) {
            return reply.status(401).send({
                statusCode: 401,
                error: "Unauthorized",
                message: "Invalid email or password.",
            });
        }

        const existing = await findPlayerForUser(user.id);
        let playerId: string;
        if (existing) {
            playerId = existing.id;
        } else {
            const fresh = await createGuest(user.username ?? "Player");
            await claimPlayer(fresh.id, user.id);
            playerId = fresh.id;
        }

        await startSession(reply, playerId);
        return { playerId, user };
    });

    app.post("/api/logout", async (req, reply) => {
        const raw = req.cookies.sid;
        if (raw) await revokeSession(raw);

        const fresh = await createGuest("Guest");
        await startSession(reply, fresh.id);
        return { playerId: fresh.id, displayName: fresh.displayName };
    });
}
