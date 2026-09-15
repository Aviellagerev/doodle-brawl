import { io, Socket } from "socket.io-client";
import { Redis } from "ioredis";
import type { RoomResponse, RoomState, ChatMessage } from "../../../packages/shared/index.js";

export const SERVER = process.env.TEST_SERVER ?? "http://localhost:3001";

/** A player driven from the test: its socket, its cookie jar, and what it saw. */
export class Client {
  socket!: Socket;
  cookie = "";
  playerId = "";
  rooms: RoomState[] = [];
  chat: ChatMessage[] = [];
  counts: number[] = [];

  constructor(readonly name: string) { }

  /**
   * Pick up a guest identity the way the browser does, then open the socket.
   * Pass a cookie to come back as a wizard who already exists.
   */
  async connect(cookie?: string): Promise<this> {
    if (cookie) this.cookie = cookie;
    // POST, not GET: looking at the front page no longer mints anyone, and a
    // test client always wants an identity
    const res = await fetch(`${SERVER}/api/me`, {
      method: "POST",
      headers: this.cookie ? { cookie: this.cookie } : {},
    });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    if (setCookie.length) this.cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
    this.playerId = (await res.json()).playerId;

    this.socket = io(SERVER, { extraHeaders: { cookie: this.cookie }, transports: ["websocket"] });
    this.socket.on("room_update", (r: RoomState) => this.rooms.push(r));
    this.socket.on("chat_message", (m: ChatMessage) => this.chat.push(m));
    this.socket.on("player_count", (n: number) => this.counts.push(n));
    await new Promise<void>((ok, fail) => {
      this.socket.once("connect", () => ok());
      this.socket.once("connect_error", (e) => fail(e));
      setTimeout(() => fail(new Error(`${this.name}: socket never connected`)), 5000);
    });
    return this;
  }

  /** Open a socket without ever asking the server for an identity. */
  async connectAnonymously(): Promise<this> {
    this.socket = io(SERVER, { transports: ["websocket"] });
    this.socket.on("room_update", (r: RoomState) => this.rooms.push(r));
    await new Promise<void>((ok, fail) => {
      this.socket.once("connect", () => ok());
      this.socket.once("connect_error", (e) => fail(e));
      setTimeout(() => fail(new Error(`${this.name}: socket never connected`)), 5000);
    });
    return this;
  }

  /** An emit that expects the server's acknowledgement. */
  ask<T = RoomResponse>(event: string, payload?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${this.name}: no ack for "${event}"`)), 5000);
      this.socket.emit(event, payload, (res: T) => { clearTimeout(timer); resolve(res); });
    });
  }

  say(text: string) { this.socket.emit("send_message", { text }); }

  /** The newest room state this client has been sent. */
  get room(): RoomState | undefined { return this.rooms[this.rooms.length - 1]; }

  /** Wait until the room this client sees satisfies `check`. */
  waitForRoom(check: (r: RoomState) => boolean, label = "room state", ms = 8000): Promise<RoomState> {
    if (this.room && check(this.room)) return Promise.resolve(this.room);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.socket.off("room_update", onUpdate);
        reject(new Error(`${this.name}: timed out waiting for ${label}`));
      }, ms);
      const onUpdate = (r: RoomState) => {
        if (!check(r)) return;
        clearTimeout(timer);
        this.socket.off("room_update", onUpdate);
        resolve(r);
      };
      this.socket.on("room_update", onUpdate);
    });
  }

  close() { this.socket?.disconnect(); }
}

export async function api(path: string, init: RequestInit & { cookie?: string } = {}) {
  const { cookie, ...rest } = init;
  const res = await fetch(`${SERVER}${path}`, {
    ...rest,
    headers: {
      ...(rest.body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(rest.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }
  const setCookie = res.headers.getSetCookie?.() ?? [];
  return { status: res.status, body: body as never, cookie: setCookie.map((c) => c.split(";")[0]).join("; ") };
}

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A name nothing else in the database will collide with. */
export const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

/**
 * Play a room to the end: whoever is casting picks the first spell offered, and
 * everyone else shouts it. Returns the final room state.
 */
export async function playToFinish(clients: Client[], ms = 60_000): Promise<RoomState> {
  const watcher = clients[0];
  const deadline = Date.now() + ms;

  while (Date.now() < deadline) {
    const room = watcher.room;
    if (room?.status === "finished") return room;

    const phase = room?.game?.phase;
    if (phase === "choosing") {
      const casterId = room!.game!.currentDrawerId;
      const caster = clients.find((c) => c.playerId === casterId);
      const offering = caster?.room?.game?.wordOptions;
      if (caster && offering?.length) {
        caster.socket.emit("choose_word", { word: offering[0].word });
        await wait(120);
      }
    } else if (phase === "drawing") {
      const casterId = room!.game!.currentDrawerId;
      const caster = clients.find((c) => c.playerId === casterId);
      const word = caster?.room?.game?.word;
      const pending = clients.filter(
        (c) => c.playerId !== casterId && !room!.game!.guessedIds.includes(c.playerId),
      );
      if (word && pending.length) {
        pending.forEach((c) => c.say(word));
        await wait(200);
      }
    }
    await wait(120);
  }
  throw new Error("the rite never ended");
}

/**
 * Clear the rate limiter's counters.
 *
 * Signup is 5/hour and login 8/15min per IP, which the suite would exhaust on
 * its own — every run creates accounts, and the counters live in Redis and so
 * outlive the server. Call this before anything that signs up or logs in.
 */
export async function resetRateLimits() {
  const redis = new Redis({ host: "127.0.0.1", port: 6379 });
  try {
    const keys = await redis.keys("*rate-limit*");
    if (keys.length) await redis.del(...keys);
  } finally {
    await redis.quit();
  }
}
