import test, { before } from "node:test";
import assert from "node:assert/strict";
import { Client, wait , resetRateLimits} from "./helpers.js";
import { CHOOSE_TIME_MS } from "../../../packages/shared/index.js";
import { hintForm } from "../src/game/skribbl.js";

before(resetRateLimits);

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
  assert.equal(drawing.game!.wordLength, [...hintForm(word)].length, "…but how many blanks it has is not");
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

/** A rite whose only spell is `word`, cast by the host (who always draws first). */
async function riteOf(word: string, ...names: string[]) {
  const host = await new Client("host").connect();
  const others = await Promise.all(names.map((n) => new Client(n).connect()));
  const made = await host.ask("create_room", { name: "Gorbo" });
  host.socket.emit("update_settings", {
    ...made.room!.settings, rounds: 1, drawTimeMs: 20_000, wordChoices: 1,
    customWords: [word], customWordsOnly: true,
  });
  await host.waitForRoom((r) => r.settings.customWordsOnly, "own words only");
  for (const [i, c] of others.entries()) await c.ask("join_room", { name: names[i], code: made.roomId });
  await host.waitForRoom((r) => r.players.length === others.length + 1, "the whole coven");

  host.socket.emit("start_game", made.roomId);
  const offer = await host.waitForRoom((r) => !!r.game?.wordOptions?.length, "the offering");
  assert.equal(offer.game!.currentDrawerId, host.playerId, "the host casts first");
  host.socket.emit("choose_word", { word: offer.game!.wordOptions![0].word });
  await Promise.all([host, ...others].map((c) => c.waitForRoom((r) => r.game?.phase === "drawing", "drawing")));
  return { host, others, close: () => [host, ...others].forEach((c) => c.close()) };
}

test("an accented spell is divined without the accent", async (t) => {
  const { host, others: [diviner], close } = await riteOf("Café", "Miffwick");
  t.after(close);
  assert.equal(host.room!.game!.word, "Café");

  diviner.say("CAFE");   // no accent, wrong case — as a phone keyboard might send it
  const scoring = await diviner.waitForRoom((r) => r.game?.phase === "scoring", "the reckoning", 12_000);
  assert.ok(scoring.game!.guessedIds.includes(diviner.playerId), "the plain spelling divined it");
});

test("a geresh is no blank, and needn't be typed", async (t) => {
  const { others: [diviner], close } = await riteOf("ג'ירפה", "Miffwick");
  t.after(close);
  assert.deepEqual(diviner.room!.game!.hint, ["", "", "", "", ""], "five blanks, nothing between them");
  assert.equal(diviner.room!.game!.wordLength, 5);
  assert.equal(diviner.room!.game!.wordDir, "rtl", "so the blanks are laid out right to left");

  diviner.say("גירפה");
  const scoring = await diviner.waitForRoom((r) => r.game?.phase === "scoring", "the reckoning", 12_000);
  assert.ok(scoring.game!.guessedIds.includes(diviner.playerId), "divined without the geresh");
  assert.equal(scoring.game!.word, "ג'ירפה", "the reveal still spells it properly");
});

test("one letter off is whispered to the guesser alone", async (t) => {
  const { host, others: [near, far], close } = await riteOf("kettle", "Near", "Far");
  t.after(close);

  near.say("kettel");
  await wait(500);
  const hint = near.chat.find((m) => m.kind === "close");
  assert.equal(hint?.text, "kettel", "the guesser is told they were close");
  for (const c of [host, far]) {
    assert.ok(!c.chat.some((m) => m.text.includes("kettel")), `${c.name} never saw the near-miss`);
  }
  assert.equal(far.room!.game!.guessedIds.length, 0, "a near-miss divines nothing");
});

test("a diviner sees the spell, and may not say it", async (t) => {
  const { host, others: [first, second], close } = await riteOf("kettle", "First", "Second");
  t.after(close);

  first.say("kettle");
  const knows = await first.waitForRoom((r) => r.game?.guessedIds.includes(first.playerId) ?? false, "credit");
  assert.equal(knows.game!.word, "kettle", "divining it shows it");
  await second.waitForRoom((r) => r.game?.guessedIds.includes(first.playerId) ?? false, "the others to hear");
  assert.equal(second.room!.game!.word, null, "…to the one who divined it, only");

  first.say("it's a kettle lol");
  host.say("kettel");
  await wait(500);
  for (const [c, line] of [[first, "it's a kettle lol"], [host, "kettel"]] as const) {
    assert.ok(c.chat.some((m) => m.kind === "system" && /hush/.test(m.text)), `${c.name} is hushed`);
    assert.ok(!second.chat.some((m) => m.text === line), `"${line}" never reached the one still guessing`);
  }

  first.say("well drawn");
  await wait(300);
  assert.ok(second.chat.some((m) => m.text === "well drawn"), "ordinary chat still carries");
});

test("grimoires are checked against the books that exist", async (t) => {
  const host = await new Client("host").connect();
  t.after(() => host.close());
  const made = await host.ask("create_room", { name: "Gorbo" });
  const books = host.wordMeta[made.room!.settings.language] ?? [];
  assert.ok(books.length > 1, "the server named its grimoires");

  host.socket.emit("update_settings", { ...made.room!.settings, lists: [books[0], "no-such-book", 42] });
  const narrowed = await host.waitForRoom((r) => r.settings.lists.length > 0, "the narrowed shelf");
  assert.deepEqual(narrowed.settings.lists, [books[0]], "only real books survive");

  host.socket.emit("update_settings", { ...narrowed.settings, lists: [...books] });
  const all = await host.waitForRoom((r) => r.settings.lists.length === 0, "every book open");
  assert.deepEqual(all.settings.lists, [], "every book open is written as no filter");
});

test("wizards guessing in the same instant are all counted", async (t) => {
  const { host, others: [a, b, c], close } = await riteOf("kettle", "A", "B", "C");
  t.after(close);

  // one tick: each handler used to read the room before the others wrote it
  // back, so all but one of these vanished — a wrong guess could erase a right one
  c.say("teapot");
  a.say("kettle");
  b.say("kettle");

  const both = await host.waitForRoom(
    (r) => [a, b].every((x) => r.game?.guessedIds.includes(x.playerId)), "both diviners credited", 4000);
  for (const x of [a, b]) {
    assert.ok((both.players.find((p) => p.id === x.playerId)?.score ?? 0) > 0, `${x.name} was paid`);
  }

  c.say("kettle");
  await host.waitForRoom((r) => r.game?.phase === "scoring", "the turn to end the moment all have it", 4000);
});
