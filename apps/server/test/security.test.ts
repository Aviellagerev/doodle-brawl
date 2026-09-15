import test, { before } from "node:test";
import assert from "node:assert/strict";
import { api, unique, Client, wait, playToFinish, SERVER , resetRateLimits } from "./helpers.js";

/**
 * The things that only matter once strangers can reach the server: what leaks,
 * what a hostile payload can do, and whether the doors actually lock.
 */

before(resetRateLimits);

const guest = async () => (await api("/api/me", { method: "POST" })).cookie;

/** Play a whole rite so there is a match, a turn and a replay to ask for. */
async function aFinishedRite() {
  const host = await new Client("host").connect();
  const other = await new Client("other").connect();
  const made = await host.ask("create_room", { name: "Keeper" });
  host.socket.emit("update_settings", { ...made.room!.settings, rounds: 1, drawTimeMs: 15_000 });
  await host.waitForRoom((r) => r.settings.rounds === 1, "the shorter rite");
  await other.ask("join_room", { name: "Sharer", code: made.roomId });
  await host.waitForRoom((r) => r.players.length === 2, "two wizards");
  host.socket.emit("start_game", made.roomId);

  // leave a stroke behind so the turn has a replay worth protecting
  const choosing = await host.waitForRoom((r) => r.game?.phase === "choosing", "choosing");
  const caster = [host, other].find((c) => c.playerId === choosing.game!.currentDrawerId)!;
  const view = await caster.waitForRoom((r) => !!r.game?.wordOptions?.length, "the offering");
  caster.socket.emit("choose_word", { word: view.game!.wordOptions![0].word });
  await caster.waitForRoom((r) => r.game?.phase === "drawing", "drawing");
  caster.socket.emit("draw", { from: { x: 0.1, y: 0.1 }, to: { x: 0.5, y: 0.5 }, color: "#2b1c12", width: 6, strokeId: 1 });

  await playToFinish([host, other]);
  await wait(1000);
  host.close(); other.close();
  return host.cookie;
}

test("a stranger cannot pull another wizard's drawing", async () => {
  const owner = await aFinishedRite();
  const stranger = await guest();

  const list = await api("/api/history?limit=1", { cookie: owner });
  const matchId = (list.body as Array<{ matchId: string }>)[0].matchId;
  const detail = await api(`/api/match/${matchId}`, { cookie: owner });
  const turns = (detail.body as { turns: Array<{ turnId: string; hasReplay: boolean }> }).turns;
  const drawn = turns.find((t) => t.hasReplay) ?? turns[0];

  const mine = await api(`/api/replay/${drawn.turnId}`, { cookie: owner });
  assert.equal(mine.status, 200, "a participant may see the vellum again");

  const theirs = await api(`/api/replay/${drawn.turnId}`, { cookie: stranger });
  assert.equal(theirs.status, 404, "a stranger may not");

  const nobody = await api(`/api/replay/${drawn.turnId}`);
  assert.equal(nobody.status, 401, "and neither may someone with no session");
});

test("a revoked session is dead, not merely forgotten", async () => {
  const g = await guest();
  const before = await api("/api/me", { cookie: g });
  assert.equal(before.status, 200);

  await api("/api/logout", { method: "POST", cookie: g });

  // the old cookie must not still name the old wizard
  const after = await api("/api/me", { cookie: g });
  assert.notEqual(
    (after.body as { playerId: string }).playerId,
    (before.body as { playerId: string }).playerId,
    "the revoked token no longer identifies anyone",
  );
  const stillClosed = await api("/api/history", { cookie: g });
  assert.equal(stillClosed.status, 401, "and cannot reach the chronicle");
});

test("no session token is ever handed back in a response body", async () => {
  const res = await api("/api/me", { method: "POST" });
  const body = JSON.stringify(res.body);
  assert.equal(/sid|token|sessionToken/i.test(body), false, `/api/me body leaks a token: ${body}`);
  assert.match(res.cookie, /HttpOnly|sid=/i, "the token travels only as a cookie");

  const raw = await fetch(`${SERVER}/api/me`, { method: "POST" });
  const setCookie = raw.headers.getSetCookie?.()[0] ?? "";
  assert.match(setCookie, /HttpOnly/i, "the cookie is httpOnly");
  assert.match(setCookie, /SameSite=Lax/i, "…and same-site");
});

test("failures say what went wrong, not what we are made of", async () => {
  const cookie = await guest();
  const cases = [
    await api("/api/match/not-a-uuid", { cookie }),
    await api("/api/replay/not-a-number", { cookie }),
    await api("/api/login", { method: "POST", body: JSON.stringify({ email: "x", password: "y" }) }),
    await api("/api/history", { cookie: "sid=rubbish" }),
  ];
  for (const res of cases) {
    const body = JSON.stringify(res.body ?? "");
    assert.equal(/at \/|\.ts:\d|node_modules|stack/i.test(body), false, `a stack leaked: ${body.slice(0, 200)}`);
    // the database is ours to know about: no driver text, no SQLSTATE, no
    // column types. This is what a raw 500 used to hand over.
    assert.equal(
      /invalid input syntax|syntax for type|postgres|relation |column |22P02|\bbigint\b|\buuid\b/i.test(body),
      false,
      `the database described itself: ${body.slice(0, 200)}`,
    );
  }
});

test("an id of the wrong shape is simply not found", async () => {
  const cookie = await guest();
  for (const path of ["/api/match/not-a-uuid", "/api/match/../../etc/passwd", "/api/replay/not-a-number", "/api/replay/-1"]) {
    const res = await api(path, { cookie });
    assert.ok(res.status === 404 || res.status === 400, `${path} answered ${res.status}, not a refusal`);
    assert.notEqual(res.status, 500, `${path} fell over instead of refusing`);
  }
});

test("__proto__ in a payload does not poison the room", async (t) => {
  const host = await new Client("host").connect();
  t.after(() => host.close());
  const made = await host.ask("create_room", { name: "Gorbo" });

  host.socket.emit("update_settings", {
    ...made.room!.settings,
    ["__proto__"]: { polluted: true },
    constructor: { prototype: { polluted: true } },
  });
  await wait(500);

  assert.equal(({} as Record<string, unknown>).polluted, undefined, "Object.prototype is untouched");
  assert.equal((made.room!.settings as Record<string, unknown>).polluted, undefined);
});

test("absurd settings are clamped, not obeyed", async (t) => {
  const host = await new Client("host").connect();
  t.after(() => host.close());
  const made = await host.ask("create_room", { name: "Gorbo" });

  host.socket.emit("update_settings", {
    ...made.room!.settings,
    rounds: 9999,
    drawTimeMs: 1,
    maxPlayers: 100000,
    wordChoices: -5,
    hints: 999,
  });
  await wait(600);

  const s = host.room!.settings;
  assert.ok(s.rounds <= 10 && s.rounds >= 1, `rounds clamped, got ${s.rounds}`);
  assert.ok(s.drawTimeMs >= 15_000, `the candle cannot be instant, got ${s.drawTimeMs}`);
  assert.ok(s.maxPlayers <= 20, `the circle is capped, got ${s.maxPlayers}`);
  assert.ok(s.wordChoices >= 1, `at least one spell is offered, got ${s.wordChoices}`);
  assert.ok(s.hints <= 5, `hints capped, got ${s.hints}`);
});

test("a hostile name or shout is carried as text, never as markup", async (t) => {
  const xss = '<img src=x onerror=alert(1)>';
  const host = await new Client("host").connect();
  const guest2 = await new Client("guest").connect();
  t.after(() => { host.close(); guest2.close(); });

  const made = await host.ask("create_room", { name: xss });
  await guest2.ask("join_room", { name: "Guest", code: made.roomId });
  await host.waitForRoom((r) => r.players.length === 2, "two wizards");

  guest2.say(xss);
  await wait(400);

  // the server stores it verbatim — escaping is the renderer's job, and React
  // does it; what matters here is that nothing tried to "clean" it into
  // something executable, and that it round-trips as a plain string
  const said = host.chat.filter((m) => m.kind === "chat").pop();
  assert.equal(typeof said?.text, "string");
  assert.equal(said!.text, xss, "the shout survives as text");
  assert.equal(typeof host.room!.players[0].name, "string");
});

test("the login door closes after enough wrong keys", async () => {
  await resetRateLimits();   // this test's whole point is to exhaust a bucket
  const email = `${unique("bruteme")}@x.example`;
  const g = await guest();
  const made = await api("/api/signup", {
    method: "POST", cookie: g,
    body: JSON.stringify({ email, password: "correct horse battery", username: "Target" }),
  });
  assert.equal(made.status, 201, JSON.stringify(made.body));

  let sawLimit = false;
  for (let i = 0; i < 12; i++) {
    const res = await api("/api/login", {
      method: "POST", body: JSON.stringify({ email, password: `wrong-${i}` }),
    });
    if (res.status === 429) { sawLimit = true; break; }
    assert.equal(res.status, 401, "…until then, a plain refusal");
  }
  assert.ok(sawLimit, "repeated wrong secrets are eventually refused outright");
});

test("a room code cannot be brute-forced quietly", async (t) => {
  const c = await new Client("prober").connect();
  t.after(() => c.close());

  // the socket guard allows 80 control events per 10s; probing hits that wall
  let refusedAt = 0;
  for (let i = 0; i < 120; i++) {
    try {
      await c.ask("join_room", { name: "P", code: `AAA${String(i).padStart(3, "0")}` });
    } catch {
      refusedAt = i;
      break;
    }
  }
  assert.ok(refusedAt > 0 && refusedAt < 120, `probing is throttled (stopped at ${refusedAt})`);
});

test("minting guests in a loop is throttled", async () => {
  // a browser needs this a few times a minute; a script would use it to fill
  // the players table for free
  await resetRateLimits();
  let limited = false;
  for (let i = 0; i < 200; i++) {
    const res = await api("/api/me", { method: "POST" });
    if (res.status === 429) { limited = true; break; }
  }
  assert.ok(limited, "anonymous guest creation is capped per IP");
});

test("a nameless socket cannot open or enter a circle", async (t) => {
  // connect with no cookie at all: allowed, so the join screen can be watched,
  // but it is nobody and the two doors that matter know it
  const nobody = new Client("nobody");
  await nobody.connectAnonymously();
  t.after(() => nobody.close());
  assert.equal(nobody.socket.connected, true, "a stranger may still watch");

  const made = await nobody.ask("create_room", { name: "Nobody" });
  assert.equal(made.success, false, "…but may not summon a circle");
  assert.equal(made.error, "no_identity");

  const joined = await nobody.ask("join_room", { name: "Nobody", code: "AAAAAA" });
  assert.equal(joined.success, false, "…nor walk into one");
  assert.equal(joined.error, "no_identity");
});
