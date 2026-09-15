import test from "node:test";
import assert from "node:assert/strict";
import { io } from "socket.io-client";
import { SERVER, api } from "./helpers.js";

/**
 * The browser sends an Origin header on both the HTTP calls and the socket
 * upgrade; the node tests do not, so this is the only place the CORS policy is
 * actually exercised. Run the server with its real CORS_ORIGIN to mean anything:
 *
 *     CORS_ORIGIN=http://localhost:3000 pnpm dev
 */
const ALLOWED = process.env.TEST_ORIGIN ?? "http://localhost:3000";

function connectFrom(origin: string, cookie: string) {
  return new Promise<"connected" | "refused">((resolve) => {
    const socket = io(SERVER, {
      transports: ["websocket"],
      extraHeaders: { origin, cookie },
      reconnection: false,
    });
    const done = (r: "connected" | "refused") => { socket.close(); resolve(r); };
    socket.once("connect", () => done("connected"));
    socket.once("connect_error", () => done("refused"));
    setTimeout(() => done("refused"), 4000);
  });
}

test("the web origin may open a socket", async () => {
  const { cookie } = await api("/api/me");
  assert.equal(await connectFrom(ALLOWED, cookie), "connected");
});

test("the HTTP routes answer the web origin with credentials allowed", async () => {
  const res = await fetch(`${SERVER}/api/me`, { headers: { origin: ALLOWED } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), ALLOWED, "the origin is echoed back");
  assert.equal(res.headers.get("access-control-allow-credentials"), "true", "…and cookies are allowed");
});
