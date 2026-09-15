import type { PlayerAvatar } from "../../../../packages/shared";
import { cleanAvatar, randomAvatar, AVATAR_ANIMALS, AVATAR_HATS } from "../../../../packages/shared";

/**
 * Your own familiar. Rolled once — the first time you land — then kept in this
 * browser until you reroll it. Read through useSyncExternalStore so the server
 * renders a placeholder and the browser swaps the real one in after hydration.
 */
const KEY = "scrawl.avatar";

// A fixed stand-in for the server render; getServerSnapshot must be referentially
// stable, so it can never be a fresh random one.
const SSR: PlayerAvatar = { animal: "cat", hat: "wizard" };

let cached: PlayerAvatar | null = null;
let listeners: Array<() => void> = [];

function write(a: PlayerAvatar) {
  cached = a;
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* private window */ }
}

/** The stored familiar, rolling (and saving) one on the first read. */
export function getMyAvatar(): PlayerAvatar {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { cached = cleanAvatar(JSON.parse(raw)); return cached; }
  } catch { /* unreadable storage — fall through and roll one */ }
  write(randomAvatar());
  return cached!;
}

export function getServerAvatar(): PlayerAvatar {
  return SSR;
}

export function subscribeMyAvatar(cb: () => void) {
  listeners.push(cb);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

/** Roll a different familiar — never the one already on screen. */
export function rerollMyAvatar() {
  const current = getMyAvatar();
  let next = randomAvatar();
  for (let i = 0; i < 12 && next.animal === current.animal && next.hat === current.hat; i++) {
    next = randomAvatar();
  }
  write(next);
  listeners.forEach((l) => l());
}

/** Every combination, for anyone who would rather pick than roll. */
export function allAvatars(): PlayerAvatar[] {
  return AVATAR_ANIMALS.flatMap<PlayerAvatar>((animal) => AVATAR_HATS.map((hat) => ({ animal, hat })));
}
