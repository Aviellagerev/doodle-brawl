import test from "node:test";
import assert from "node:assert/strict";
import { Client, wait } from "./helpers.js";
import { CHOOSE_TIME_MS } from "../../../packages/shared/index.js";

/** The room + round loop, driven over real sockets against a running server. */

test("a host creates a circle and is the host of it", async (t) => {
  const host = await new Client("host").connect();
  t.after(() => host.close());

  const res = await host.ask("create_room", { name: "Gorbo" });
  assert.equal(res.success, true);
  assert.ok(res.roomId, "a room code came back");
  assert.equal(res.room!.players.length, 1);
  assert.equal(res.room!.players[0].isHost, true);
  assert.equal(res.room!.status, "waiting");
  assert.ok(res.room!.players[0].avatar, "the host was given a familiar");
});

test("a second wizard joins and both see each other", async (t) => {
  const host = await new Client("host").connect();
  const guest = await new Client("guest").connect();
  t.after(() => { host.close(); guest.close(); });

  const made = await host.ask("create_room", { name: "Gorbo" });
  const joined = await guest.ask("join_room", { name: "Miffwick", code: made.roomId });

  assert.equal(joined.success, true);
  assert.equal(joined.room!.players.length, 2);
  await host.waitForRoom((r) => r.players.length === 2, "the host to see the guest");
  assert.deepEqual(
    host.room!.players.map((p) => p.name).sort(),
    ["Gorbo", "Miffwick"],
  );
});

test("an unknown code is refused", async (t) => {
  const c = await new Client("lost").connect();
  t.after(() => c.close());
  const res = await c.ask("join_room", { name: "Nobody", code: "ZZZZZZ" });
  assert.equal(res.success, false);
  assert.match(String(res.error), /not found/i);
});

test("a full circle is refused", async (t) => {
  const host = await new Client("host").connect();
  const a = await new Client("a").connect();
  const b = await new Client("b").connect();
  t.after(() => [host, a, b].forEach((c) => c.close()));

  const made = await host.ask("create_room", { name: "Gorbo" });
  host.socket.emit("update_settings", { ...made.room!.settings, maxPlayers: 2 });
  await host.waitForRoom((r) => r.settings.maxPlayers === 2, "the smaller circle");

  assert.equal((await a.ask("join_room", { name: "A", code: made.roomId })).success, true);
  const overflow = await b.ask("join_room", { name: "B", code: made.roomId });
  assert.equal(overflow.success, false, "the third wizard is turned away");
  assert.match(String(overflow.error), /full/i);
});

test("only the host may tune the rite or light the candle", async (t) => {
  const host = await new Client("host").connect();
  const guest = await new Client("guest").connect();
  t.after(() => { host.close(); guest.close(); });

  const made = await host.ask("create_room", { name: "Gorbo" });
  await guest.ask("join_room", { name: "Miffwick", code: made.roomId });
  await host.waitForRoom((r) => r.players.length === 2, "two wizards");

  guest.socket.emit("update_settings", { ...made.room!.settings, rounds: 9 });
  guest.socket.emit("start_game", made.roomId);
  await wait(400);

  assert.equal(host.room!.settings.rounds, made.room!.settings.rounds, "settings untouched");
  assert.equal(host.room!.status, "waiting", "the game did not start");
});

test("a rite cannot start with one wizard", async (t) => {
  const host = await new Client("host").connect();
  t.after(() => host.close());
  const made = await host.ask("create_room", { name: "Alone" });
  host.socket.emit("start_game", made.roomId);
  await wait(400);
  assert.equal(host.room?.status ?? "waiting", "waiting");
});

test("the round loop: choose, draw, guess, score", async (t) => {
  const host = await new Client("host").connect();
  const guest = await new Client("guest").connect();
  t.after(() => { host.close(); guest.close(); });

  const made = await host.ask("create_room", { name: "Gorbo" });
  host.socket.emit("update_settings", { ...made.room!.settings, rounds: 1, drawTimeMs: 15_000 });
  await host.waitForRoom((r) => r.settings.rounds === 1, "the shorter rite");
  await guest.ask("join_room", { name: "Miffwick", code: made.roomId });
  await host.waitForRoom((r) => r.players.length === 2, "two wizards");

  host.socket.emit("start_game", made.roomId);
  const choosing = await host.waitForRoom((r) => r.game?.phase === "choosing", "the choosing phase");

  const casterIsHost = choosing.game!.currentDrawerId === host.playerId;
  const caster = casterIsHost ? host : guest;
  const diviner = casterIsHost ? guest : host;

  // the caster is offered words; nobody else is
  const casterView = await caster.waitForRoom((r) => !!r.game?.wordOptions?.length, "the spell offering");
  assert.ok(casterView.game!.wordOptions!.length > 0);
  assert.equal(diviner.room!.game!.wordOptions, null, "the offering is redacted from diviners");
  assert.ok(choosing.game!.endsAt! - Date.now() <= CHOOSE_TIME_MS + 1000, "a deadline was set");

  const word = casterView.game!.wordOptions![0].word;
  caster.socket.emit("choose_word", { word });

  const drawing = await diviner.waitForRoom((r) => r.game?.phase === "drawing", "the drawing phase");
  assert.equal(drawing.game!.word, null, "the spell itself is hidden from diviners");
  assert.equal(drawing.game!.wordLength, word.length, "…but its length is not");
  assert.equal(caster.room!.game!.word, word, "the caster can see what they drew");

  // a wrong guess is just chat; the right one scores
  diviner.say("definitely not the word");
  await wait(250);
  diviner.say(word);

  const scoring = await diviner.waitForRoom((r) => r.game?.phase === "scoring", "the reckoning", 12_000);
  assert.ok(scoring.game!.guessedIds.includes(diviner.playerId), "the diviner was credited");
  assert.equal(scoring.game!.word, word, "the spell is revealed at the reckoning");
  assert.ok((scoring.game!.payout ?? []).length > 0, "a payout was worked out");

  const divinerScore = scoring.players.find((p) => p.id === diviner.playerId)!.score ?? 0;
  const casterScore = scoring.players.find((p) => p.id === caster.playerId)!.score ?? 0;
  assert.ok(divinerScore > 0, "divining pays");
  assert.ok(casterScore > 0, "so does being divined");

  assert.ok(
    diviner.chat.some((m) => m.kind === "correct"),
    "the green pill was broadcast",
  );
});

test("a guess is forgiving about case and stray spaces", async (t) => {
  const host = await new Client("host").connect();
  const guest = await new Client("guest").connect();
  t.after(() => { host.close(); guest.close(); });

  const made = await host.ask("create_room", { name: "Gorbo" });
  host.socket.emit("update_settings", { ...made.room!.settings, rounds: 1, drawTimeMs: 15_000 });
  await host.waitForRoom((r) => r.settings.rounds === 1, "the shorter rite");
  await guest.ask("join_room", { name: "Miffwick", code: made.roomId });
  await host.waitForRoom((r) => r.players.length === 2, "two wizards");

  host.socket.emit("start_game", made.roomId);
  const choosing = await host.waitForRoom((r) => r.game?.phase === "choosing", "choosing");
  const caster = choosing.game!.currentDrawerId === host.playerId ? host : guest;
  const diviner = caster === host ? guest : host;

  const view = await caster.waitForRoom((r) => !!r.game?.wordOptions?.length, "the offering");
  const word = view.game!.wordOptions![0].word;
  caster.socket.emit("choose_word", { word });
  await diviner.waitForRoom((r) => r.game?.phase === "drawing", "drawing");

  diviner.say(`  ${word.toUpperCase()}  `);
  const scoring = await diviner.waitForRoom((r) => r.game?.phase === "scoring", "the reckoning", 12_000);
  assert.ok(scoring.game!.guessedIds.includes(diviner.playerId), "shouted with spaces still counts");
});

test("the caster's guess is not accepted", async (t) => {
  const host = await new Client("host").connect();
  const guest = await new Client("guest").connect();
  t.after(() => { host.close(); guest.close(); });

  const made = await host.ask("create_room", { name: "Gorbo" });
  host.socket.emit("update_settings", { ...made.room!.settings, rounds: 1, drawTimeMs: 15_000 });
  await host.waitForRoom((r) => r.settings.rounds === 1, "the shorter rite");
  await guest.ask("join_room", { name: "Miffwick", code: made.roomId });
  await host.waitForRoom((r) => r.players.length === 2, "two wizards");

  host.socket.emit("start_game", made.roomId);
  const choosing = await host.waitForRoom((r) => r.game?.phase === "choosing", "choosing");
  const caster = choosing.game!.currentDrawerId === host.playerId ? host : guest;

  const view = await caster.waitForRoom((r) => !!r.game?.wordOptions?.length, "the offering");
  const word = view.game!.wordOptions![0].word;
  caster.socket.emit("choose_word", { word });
  await caster.waitForRoom((r) => r.game?.phase === "drawing", "drawing");

  caster.say(word);
  await wait(600);
  assert.equal(caster.room!.game!.phase, "drawing", "the caster naming their own spell ends nothing");
  assert.equal(caster.room!.game!.guessedIds.includes(caster.playerId), false);
});

test("settings changes are announced in the murmurings", async (t) => {
  const host = await new Client("host").connect();
  const guest = await new Client("guest").connect();
  t.after(() => { host.close(); guest.close(); });

  const made = await host.ask("create_room", { name: "Gorbo" });
  await guest.ask("join_room", { name: "Miffwick", code: made.roomId });
  await host.waitForRoom((r) => r.players.length === 2, "two wizards");

  host.socket.emit("update_settings", { ...made.room!.settings, drawTimeMs: 90_000 });
  await wait(600);
  assert.ok(
    guest.chat.some((m) => m.text.startsWith("⚙") && /candle to 90s/.test(m.text)),
    "the ⚙ pill reached the other wizard",
  );
});

test("leaving hands the circle to someone else", async (t) => {
  const host = await new Client("host").connect();
  const guest = await new Client("guest").connect();
  t.after(() => { host.close(); guest.close(); });

  const made = await host.ask("create_room", { name: "Gorbo" });
  await guest.ask("join_room", { name: "Miffwick", code: made.roomId });
  await host.waitForRoom((r) => r.players.length === 2, "two wizards");

  host.socket.emit("leave_room", { roomId: made.roomId });
  const left = await guest.waitForRoom((r) => r.players.length === 1, "the host to leave");
  assert.equal(left.players[0].name, "Miffwick");
  assert.equal(left.players[0].isHost, true, "the last wizard standing inherits the circle");
});

test("a new arrival is told the player count at once", async (t) => {
  // the listener is attached before the socket opens, so nothing is missed
  const c = await new Client("arrival").connect();
  t.after(() => c.close());

  const deadline = Date.now() + 4000;
  while (!c.counts.length && Date.now() < deadline) await wait(50);

  assert.ok(c.counts.length > 0, "the count arrived without waiting for the 30s sweep");
  assert.ok(c.counts[0] >= 0, "and it is a number");
});
