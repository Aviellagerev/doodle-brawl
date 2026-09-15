import type { PlayerAvatar, AvatarAnimal } from "../../../../packages/shared";
import { AVATAR_ANIMALS, AVATAR_HATS } from "../../../../packages/shared";

/**
 * Familiars — the hand-drawn sprites in /public/avatars. Each animal sits on a
 * backdrop of its own hue; that hue is also the colour the player's name takes
 * in the murmurings.
 */

export type AnimalStyle = {
  fill: string;   // the circle behind the animal
  chat: string;   // the same hue, light enough to read on night
};

export const ANIMAL_STYLE: Record<AvatarAnimal, AnimalStyle> = {
  cat: { fill: "oklch(0.7 0.15 315)", chat: "oklch(0.72 0.15 315)" },
  duck: { fill: "oklch(0.7 0.14 190)", chat: "oklch(0.78 0.16 190)" },
  frog: { fill: "oklch(0.75 0.15 140)", chat: "oklch(0.8 0.16 140)" },
  cow: { fill: "oklch(0.72 0.16 80)", chat: "oklch(0.8 0.16 80)" },
};

export const animalSrc = (animal: AvatarAnimal) => `/avatars/${animal}.png`;
export const hatSrc = (hat: string) => `/avatars/${hat}-hat.png`;

function hash(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/**
 * A stand-in familiar for anyone whose real one we don't have — the chronicle
 * and old match logs keep names, not avatars. Stable for a given name.
 */
export function avatarFromName(name: string): PlayerAvatar {
  const h = hash(name);
  return {
    animal: AVATAR_ANIMALS[h % AVATAR_ANIMALS.length],
    hat: AVATAR_HATS[(h >> 3) % AVATAR_HATS.length],
  };
}

/** The familiar to draw: the player's own if we have it, else one from the name. */
export function avatarOf(name: string, avatar?: PlayerAvatar | null): PlayerAvatar {
  return avatar ?? avatarFromName(name);
}

/** The name colour for a chat line — the light-on-night variant of their hue. */
export function chatColorOf(name: string, avatar?: PlayerAvatar | null): string {
  return ANIMAL_STYLE[avatarOf(name, avatar).animal].chat;
}
