import test, { before } from "node:test";
import assert from "node:assert/strict";
import { Redis } from "ioredis";
import { api, unique, Client, wait, playToFinish } from "./helpers.js";

/**
 * Identity, sessions and the authorisation boundary on the history routes.
 *
 * Signup is capped at 5/hour per IP and login at 8/15min, which a repeatable
 * suite would trip on its second run — so the limiter's counters are cleared
 * first. That is the only thing here that reaches past the public API.
 */
before(async () => {
  const redis = new Redis({ host: "127.0.0.1", port: 6379 });
  const keys = await redis.keys("*rate-limit*");
  if (keys.length) await redis.del(...keys);
  await redis.quit();
});

async function freshGuest() {
  const { body, cookie } = await api("/api/me");
  return { playerId: (body as { playerId: string }).playerId, cookie };
}

test("/api/me mints a guest, and the same cookie keeps them", async () => {
  const first = await freshGuest();
  assert.ok(first.playerId, "a player id came back");
  assert.ok(first.cookie.includes("sid="), "…with a session cookie");

  const again = await api("/api/me", { cookie: first.cookie });
  assert.equal((again.body as { playerId: string }).playerId, first.playerId, "the same wizard returns");
  assert.equal((again.body as { user: unknown }).user, null, "and is still a stranger");
});

test("signup claims the guest, keeping their player id", async () => {
  const guest = await freshGuest();
  const email = `${unique("gorbo")}@thefens.example`;

  const res = await api("/api/signup", {
    method: "POST",
    cookie: guest.cookie,
    body: JSON.stringify({ email, password: "correct horse battery", username: "Gorbo" }),
  });

  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal((res.body as { playerId: string }).playerId, guest.playerId, "the guest was claimed, not replaced");
  assert.equal((res.body as { user: { email: string } }).user.email, email.toLowerCase());
  assert.ok(res.cookie.includes("sid="), "the session was rotated");
});

test("signup refuses a thin password, and a second claim of the same sigil", async () => {
  const guest = await freshGuest();
  const weak = await api("/api/signup", {
    method: "POST",
    cookie: guest.cookie,
    body: JSON.stringify({ email: `${unique("weak")}@x.example`, password: "short", username: "Weak" }),
  });
  assert.equal(weak.status, 400, "a short secret is refused");

  const email = `${unique("twice")}@x.example`;
  const ok = await api("/api/signup", {
    method: "POST",
    cookie: guest.cookie,
    body: JSON.stringify({ email, password: "correct horse battery", username: "First" }),
  });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));

  const other = await freshGuest();
  const dupe = await api("/api/signup", {
    method: "POST",
    cookie: other.cookie,
    body: JSON.stringify({ email, password: "correct horse battery", username: "Second" }),
  });
  assert.equal(dupe.status, 409, "the sigil is already spoken for");
});

test("login needs the right secret, and logout leaves as a new stranger", async () => {
  const guest = await freshGuest();
  const email = `${unique("prunella")}@x.example`;
  const password = "correct horse battery";
  const signed = await api("/api/signup", {
    method: "POST", cookie: guest.cookie,
    body: JSON.stringify({ email, password, username: "Prunella" }),
  });
  assert.equal(signed.status, 201, JSON.stringify(signed.body));

  const out = await api("/api/logout", { method: "POST", cookie: signed.cookie });
  assert.equal(out.status, 200);
  const strangerId = (out.body as { playerId: string }).playerId;
  assert.notEqual(strangerId, guest.playerId, "logging out hands back a fresh guest");

  const wrong = await api("/api/login", {
    method: "POST", cookie: out.cookie,
    body: JSON.stringify({ email, password: "not the secret" }),
  });
  assert.equal(wrong.status, 401, "a wrong secret is refused");

  const back = await api("/api/login", {
    method: "POST", cookie: out.cookie,
    body: JSON.stringify({ email, password }),
  });
  assert.equal(back.status, 200, JSON.stringify(back.body));
  assert.equal((back.body as { playerId: string }).playerId, guest.playerId, "login returns to the account's wizard");
});

test("the chronicle is closed to anyone without a session", async () => {
  for (const path of ["/api/history", "/api/stats"]) {
    const res = await api(path);
    assert.equal(res.status, 401, `${path} needs a session`);
  }
});

test("a wizard cannot read a rite they were not in", async () => {
  // two guests, one match between two *other* players: the reader is a stranger to it
  const reader = await freshGuest();

  const host = await new Client("host").connect();
  const guest = await new Client("guest").connect();
  const made = await host.ask("create_room", { name: "Gorbo" });
  host.socket.emit("update_settings", { ...made.room!.settings, rounds: 1, drawTimeMs: 8_000 });
  await host.waitForRoom((r) => r.settings.rounds === 1, "the shorter rite");
  await guest.ask("join_room", { name: "Miffwick", code: made.roomId });
  await host.waitForRoom((r) => r.players.length === 2, "two wizards");

  host.socket.emit("start_game", made.roomId);
  await playToFinish([host, guest]);
  await wait(900);   // the match is written as the rite closes
  host.close(); guest.close();

  // the players can see it; the stranger cannot
  const theirs = await api("/api/history?limit=5", { cookie: host.cookie });
  assert.equal(theirs.status, 200);
  const list = theirs.body as Array<{ matchId: string }>;
  assert.ok(list.length > 0, "the rite was written to the chronicle");

  const matchId = list[0].matchId;
  const asPlayer = await api(`/api/match/${matchId}`, { cookie: host.cookie });
  assert.equal(asPlayer.status, 200, "a participant may read it");

  const asStranger = await api(`/api/match/${matchId}`, { cookie: reader.cookie });
  assert.equal(asStranger.status, 404, "a stranger may not — and is not told it exists");
});

test("a socket cannot claim to be someone else", async (t) => {
  const host = await new Client("host").connect();
  const spy = await new Client("spy").connect();
  t.after(() => { host.close(); spy.close(); });

  const made = await host.ask("create_room", { name: "Gorbo" });
  await spy.ask("join_room", { name: "Spy", code: made.roomId });
  await host.waitForRoom((r) => r.players.length === 2, "two wizards");

  host.socket.emit("start_game", made.roomId);
  const choosing = await host.waitForRoom((r) => r.game?.phase === "choosing", "choosing");
  const casterId = choosing.game!.currentDrawerId;
  const caster = casterId === host.playerId ? host : spy;
  const other = caster === host ? spy : host;

  const view = await caster.waitForRoom((r) => !!r.game?.wordOptions?.length, "the offering");
  const word = view.game!.wordOptions![0].word;
  caster.socket.emit("choose_word", { word });
  await other.waitForRoom((r) => r.game?.phase === "drawing", "drawing");

  // the old exploit: rejoin claiming the caster's id, hoping to be sent the word
  await other.ask("join_room", { name: "Spy", code: made.roomId, id: casterId, playerId: casterId });
  await wait(500);

  assert.equal(other.room!.game!.word, null, "identity comes from the cookie, not the payload");
  assert.equal(other.playerId === casterId, false);
});

test("only the caster may choose the spell or draw", async (t) => {
  const host = await new Client("host").connect();
  const guest = await new Client("guest").connect();
  t.after(() => { host.close(); guest.close(); });

  const made = await host.ask("create_room", { name: "Gorbo" });
  await guest.ask("join_room", { name: "Miffwick", code: made.roomId });
  await host.waitForRoom((r) => r.players.length === 2, "two wizards");

  host.socket.emit("start_game", made.roomId);
  const choosing = await host.waitForRoom((r) => r.game?.phase === "choosing", "choosing");
  const caster = choosing.game!.currentDrawerId === host.playerId ? host : guest;
  const other = caster === host ? guest : host;

  const view = await caster.waitForRoom((r) => !!r.game?.wordOptions?.length, "the offering");
  const word = view.game!.wordOptions![0].word;

  // the wrong wizard tries to choose, then to draw
  other.socket.emit("choose_word", { word });
  await wait(400);
  assert.equal(other.room!.game!.phase, "choosing", "a bystander cannot choose the spell");

  caster.socket.emit("choose_word", { word });
  await other.waitForRoom((r) => r.game?.phase === "drawing", "drawing");

  let strokeSeen = false;
  caster.socket.on("draw", () => { strokeSeen = true; });
  other.socket.emit("draw", { from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, color: "#000", width: 5, strokeId: 1 });
  await wait(400);
  assert.equal(strokeSeen, false, "a bystander's strokes are not relayed");
});
