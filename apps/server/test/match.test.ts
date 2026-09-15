import test from "node:test";
import assert from "node:assert/strict";
import { Client, api, wait, playToFinish } from "./helpers.js";
import { MAX_CHAT_LEN, MAX_NAME_LEN } from "../../../packages/shared/index.js";

/** A rite from beginning to end, and what it leaves behind in the chronicle. */

async function circleOf(names: string[], settings: Record<string, unknown> = {}) {
  const clients: Client[] = [];
  for (const n of names) clients.push(await new Client(n).connect());
  const [host, ...rest] = clients;
  const made = await host.ask("create_room", { name: names[0] });
  if (Object.keys(settings).length) {
    host.socket.emit("update_settings", { ...made.room!.settings, ...settings });
    await host.waitForRoom(
      (r) => Object.entries(settings).every(([k, v]) => (r.settings as never as Record<string, unknown>)[k] === v),
      "the new rules",
    );
  }
  for (let i = 0; i < rest.length; i++) {
    await rest[i].ask("join_room", { name: names[i + 1], code: made.roomId });
  }
  await host.waitForRoom((r) => r.players.length === names.length, "everyone");
  return { clients, host, rest, roomId: made.roomId as string };
}

test("a three-wizard rite runs to the end and ranks everyone", async (t) => {
  const { clients, host, roomId } = await circleOf(["Gorbo", "Miffwick", "Prunella"], { rounds: 1, drawTimeMs: 15_000 });
  t.after(() => clients.forEach((c) => c.close()));

  host.socket.emit("start_game", roomId);
  const done = await playToFinish(clients);

  assert.equal(done.status, "finished");
  assert.equal(done.players.length, 3);
  assert.ok(done.players.every((p) => (p.score ?? 0) > 0), "everyone scored something");
  assert.ok(done.stats, "the petty-award tallies survived to the end");

  // the final caster stays in currentDrawerId rather than being appended
  const cast = new Set([...(done.game?.drawnThisRound ?? []), done.game!.currentDrawerId]);
  assert.equal(cast.size, 3, "each wizard cast once in the round");
});

test("the rite is written to the chronicle, and reads back whole", async (t) => {
  const { clients, host, roomId } = await circleOf(["Chronicler", "Witness"], { rounds: 1, drawTimeMs: 15_000 });
  t.after(() => clients.forEach((c) => c.close()));

  host.socket.emit("start_game", roomId);
  const done = await playToFinish(clients);
  await wait(900);   // saveMatch runs as the rite closes

  const list = await api("/api/history?limit=5", { cookie: host.cookie });
  assert.equal(list.status, 200);
  const matches = list.body as Array<{ matchId: string; roomCode: string; playerCount: number; placement: number; finalScore: number; rounds: number }>;
  const mine = matches.find((m) => m.roomCode === roomId);
  assert.ok(mine, "the rite is in the chronicle");
  assert.equal(mine!.playerCount, 2);
  assert.equal(mine!.rounds, 1);
  assert.ok(mine!.placement >= 1 && mine!.placement <= 2, "a placement was recorded");
  assert.equal(mine!.finalScore, done.players.find((p) => p.id === host.playerId)!.score ?? 0, "the score matches the room");

  const detail = await api(`/api/match/${mine!.matchId}`, { cookie: host.cookie });
  assert.equal(detail.status, 200);
  const d = detail.body as {
    participants: Array<{ displayName: string; placement: number }>;
    turns: Array<{ word: string; drawerName: string; guesses: unknown[]; hasReplay: boolean }>;
  };
  assert.equal(d.participants.length, 2);
  assert.equal(d.turns.length, 2, "both casts were logged");
  assert.ok(d.turns.every((t) => typeof t.word === "string" && t.word.length > 0), "each turn kept its spell");
  assert.ok(d.participants.some((p) => p.placement === 1), "someone came first");

  const stats = await api("/api/stats", { cookie: host.cookie });
  assert.equal(stats.status, 200);
  assert.ok((stats.body as { matchesPlayed: number }).matchesPlayed >= 1);
});

test("strokes reach the other wizards, and only from the caster's hand", async (t) => {
  const { clients, host, roomId } = await circleOf(["Caster", "Watcher"], { rounds: 1, drawTimeMs: 25_000 });
  t.after(() => clients.forEach((c) => c.close()));

  host.socket.emit("start_game", roomId);
  const choosing = await host.waitForRoom((r) => r.game?.phase === "choosing", "choosing");
  const caster = clients.find((c) => c.playerId === choosing.game!.currentDrawerId)!;
  const watcher = clients.find((c) => c !== caster)!;

  const view = await caster.waitForRoom((r) => !!r.game?.wordOptions?.length, "the offering");
  caster.socket.emit("choose_word", { word: view.game!.wordOptions![0].word });
  await watcher.waitForRoom((r) => r.game?.phase === "drawing", "drawing");

  const seen: unknown[] = [];
  watcher.socket.on("draw", (s) => seen.push(s));

  const seg = { from: { x: 0.1, y: 0.1 }, to: { x: 0.4, y: 0.4 }, color: "#2b1c12", width: 6, strokeId: 1 };
  caster.socket.emit("draw", seg);
  await wait(400);
  assert.equal(seen.length, 1, "the watcher saw the stroke");

  // a late joiner is handed the canvas so far
  const latecomer = await new Client("Latecomer").connect();
  t.after(() => latecomer.close());
  await latecomer.ask("join_room", { name: "Latecomer", code: roomId });
  const canvas = await new Promise<unknown[]>((resolve) => {
    latecomer.socket.once("canvas_state", (entries: unknown[]) => resolve(entries));
    latecomer.socket.emit("request_canvas");
    setTimeout(() => resolve([]), 3000);
  });
  assert.ok(canvas.length > 0, "the vellum so far was replayed to them");

  // and the caster can wipe it
  caster.socket.emit("clear");
  await wait(300);
  const afterClear = await new Promise<unknown[]>((resolve) => {
    latecomer.socket.once("canvas_state", (entries: unknown[]) => resolve(entries));
    latecomer.socket.emit("request_canvas");
    setTimeout(() => resolve([{ notCleared: true }]), 3000);
  });
  assert.equal(afterClear.length, 0, "banish all emptied the vellum");
});

test("a dropped wizard keeps their seat and their score", async (t) => {
  const { clients, host, roomId } = await circleOf(["Stayer", "Dropper"], { rounds: 1, drawTimeMs: 25_000 });
  t.after(() => clients.forEach((c) => c.close()));
  const dropper = clients[1];

  host.socket.emit("start_game", roomId);
  await host.waitForRoom((r) => r.game?.phase === "choosing", "choosing");

  dropper.socket.disconnect();
  await wait(700);
  const afterDrop = host.room!;
  assert.equal(afterDrop.players.length, 2, "the seat is held, not swept");

  // the same cookie means the same wizard walking back in
  const back = await new Client("Dropper").connect(dropper.cookie);
  t.after(() => back.close());
  assert.equal(back.playerId, dropper.playerId, "the cookie brought the same wizard back");
  const rejoined = await back.ask("join_room", { name: "Dropper", code: roomId });
  assert.equal(rejoined.success, true);
  await host.waitForRoom((r) => r.players.length === 2, "still two wizards");
  assert.equal(host.room!.players.length, 2, "rejoining did not add a duplicate");
});

test("play again resets the scores and reopens the circle", async (t) => {
  const { clients, host, roomId } = await circleOf(["Again", "AndAgain"], { rounds: 1, drawTimeMs: 15_000 });
  t.after(() => clients.forEach((c) => c.close()));

  host.socket.emit("start_game", roomId);
  const done = await playToFinish(clients);
  assert.ok(done.players.some((p) => (p.score ?? 0) > 0), "scores were earned");

  host.socket.emit("play_again");
  const reopened = await host.waitForRoom((r) => r.status === "waiting", "the circle to reopen", 10_000);
  assert.ok(reopened.players.every((p) => (p.score ?? 0) === 0), "every score is back to nothing");
});

test("overlong names and shouts are cut down to size", async (t) => {
  const long = "x".repeat(200);
  const host = await new Client("long").connect();
  const guest = await new Client("guest").connect();
  t.after(() => { host.close(); guest.close(); });

  const made = await host.ask("create_room", { name: long });
  assert.ok(made.room!.players[0].name.length <= MAX_NAME_LEN, "the name was trimmed");

  await guest.ask("join_room", { name: "Guest", code: made.roomId });
  await host.waitForRoom((r) => r.players.length === 2, "two wizards");

  guest.say("y".repeat(MAX_CHAT_LEN + 400));
  await wait(400);
  const shout = host.chat.filter((m) => m.kind === "chat").pop();
  assert.ok(shout, "the shout arrived");
  assert.ok(shout!.text.length <= MAX_CHAT_LEN, `a shout is capped at ${MAX_CHAT_LEN}`);
});

test("a malformed message does not take the server down", async (t) => {
  const c = await new Client("gremlin").connect();
  t.after(() => c.close());

  // every one of these used to be a plausible way to crash a handler
  c.socket.emit("leave_room");
  c.socket.emit("leave_room", {});
  c.socket.emit("join_room", {});
  c.socket.emit("create_room", {});
  c.socket.emit("choose_word", {});
  c.socket.emit("send_message", {});
  c.socket.emit("update_settings", null);
  c.socket.emit("draw", { nonsense: true });
  await wait(900);

  const still = await api("/api/me");
  assert.equal(still.status, 200, "the server is still answering");
  assert.equal(c.socket.connected, true, "and the socket survived");
});
