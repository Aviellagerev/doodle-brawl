/**
 * The guild's noises — conjured with Web Audio rather than fetched as files:
 * each cue is a few sine "bells" through a quick strike-and-ring envelope, so
 * there is nothing to load and nothing to license.
 *
 * Browsers keep a page silent until its visitor has touched it, so the audio
 * context is made on the first tap or key, and woken again by later ones (a
 * phone suspends it when the tab sleeps). A cue asked for before any of that is
 * simply skipped. Whether this browser wants the noises at all is remembered
 * like the familiar is, and read through useSyncExternalStore.
 */

export type Cue = "join" | "roundStart" | "roundEnd" | "correct";

const KEY = "scrawl.sound";

let soundOn: boolean | null = null;
let listeners: Array<() => void> = [];

/** On, unless this browser switched it off. */
export function getSoundOn(): boolean {
  if (soundOn === null) {
    try { soundOn = localStorage.getItem(KEY) !== "off"; } catch { soundOn = true; }
  }
  return soundOn;
}

export function getServerSoundOn(): boolean {
  return true;
}

export function subscribeSound(cb: () => void) {
  listeners.push(cb);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

export function setSoundOn(on: boolean) {
  soundOn = on;
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* private window */ }
  if (on) wake();   // the click that turned it on is the gesture that may start it
  listeners.forEach((l) => l());
}

/* ── the instrument ─────────────────────────────────────────────────────────── */

let ctx: AudioContext | null = null;
let out: GainNode | null = null;

function wake() {
  if (!getSoundOn()) return;
  if (!ctx) {
    const AC = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0.55;
    out.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

if (typeof window !== "undefined") {
  for (const ev of ["pointerdown", "keydown", "touchend"] as const) {
    window.addEventListener(ev, wake, { passive: true });
  }
}

type Note = { f: number; at: number; dur: number; gain: number; to?: number; wave?: OscillatorType };

// A struck bell: the note, and a quieter inharmonic overtone that dies first.
function bell(f: number, at: number, dur: number, gain: number): Note[] {
  const notes: Note[] = [{ f, at, dur, gain }];
  if (f < 1500) notes.push({ f: f * 2.76, at, dur: dur * 0.45, gain: gain * 0.25 });
  return notes;
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, E6 = 1318.51, G6 = 1567.98, A6 = 1760, C7 = 2093;

const CUES: Record<Cue, (mine: boolean) => Note[]> = {
  // someone steps into the circle: a small two-note doorbell
  join: () => [...bell(G5, 0, 0.35, 0.12), ...bell(C6, 0.11, 0.5, 0.12)],

  // the candle is lit: a rising arpeggio with a shimmer over it
  roundStart: () => [
    ...bell(C5, 0, 0.5, 0.11), ...bell(E5, 0.08, 0.5, 0.11), ...bell(G5, 0.16, 0.55, 0.11), ...bell(C6, 0.24, 0.9, 0.13),
    { f: C7, at: 0.3, dur: 0.9, gain: 0.025, wave: "triangle" },
  ],

  // the spell is spent: the notes fall, and the wick smokes out
  roundEnd: () => [
    ...bell(G5, 0, 0.45, 0.11), ...bell(E5, 0.13, 0.45, 0.11), ...bell(C5, 0.26, 1, 0.13),
    { f: 196, to: 131, at: 0.26, dur: 0.8, gain: 0.07, wave: "triangle" },
  ],

  // divined! a quick sparkle — brighter and fuller when it was you
  correct: (mine) => mine
    ? [...bell(C6, 0, 0.3, 0.12), ...bell(E6, 0.06, 0.3, 0.12), ...bell(G6, 0.12, 0.35, 0.12), ...bell(C7, 0.18, 0.7, 0.11)]
    : [...bell(E6, 0, 0.25, 0.08), ...bell(A6, 0.07, 0.4, 0.07)],
};

/** Play a cue — if this browser wants sound, and has been touched yet. */
export function sfx(cue: Cue, mine = false) {
  if (!getSoundOn() || !ctx || !out || ctx.state !== "running") return;
  const t0 = ctx.currentTime + 0.01;
  for (const n of CUES[cue](mine)) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const start = t0 + n.at;
    const end = start + n.dur;
    osc.type = n.wave ?? "sine";
    osc.frequency.setValueAtTime(n.f, start);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, end);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(n.gain, start + 0.012);   // struck…
    env.gain.exponentialRampToValueAtTime(0.0001, end);             // …and ringing away
    osc.connect(env).connect(out);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}
