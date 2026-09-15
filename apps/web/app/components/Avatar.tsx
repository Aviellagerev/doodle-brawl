import type { PlayerAvatar } from "../../../../packages/shared";
import { ANIMAL_STYLE, animalSrc, hatSrc, avatarOf } from "../lib/avatar";

type Props = {
  name: string;
  /** the player's familiar; without one we fall back to a stable pick from the name */
  avatar?: PlayerAvatar | null;
  /** a pixel size, or "fill" to take the width of the cell (lobby seats) */
  size?: number | "fill";
  rotate?: number;
  /** the host wears the double ring */
  host?: boolean;
  /** which ground the avatar sits on — it flips the ring's inner band */
  surface?: "night" | "parchment";
  /** force a ring on a non-host */
  ring?: boolean;
  /** a quieter parchment ring, as the losing podium spots wear */
  faintRing?: boolean;
  dim?: boolean;
  className?: string;
};

/*
 * Placement, in shares of the circle's width. tools/build-avatars.py cuts every
 * animal to a square around its head and every hat down to its own ink, so these
 * two numbers are all the app needs — no per-sprite table.
 */
const HAT_HEIGHT = 0.4375;   // the hat's own height
const HAT_TOP = -0.2575;     // how far above the circle it starts, so the brim
                             // lands just inside the rim and the crown overhangs
const HAT_ROOM = -HAT_TOP;   // …and the room the layout keeps for that overhang

/**
 * A flat circle with a hand-drawn familiar in it: the animal's head fills the
 * circle, and the hat rides above the rim.
 */
export default function Avatar({
  name,
  avatar,
  size = 40,
  rotate = 0,
  host = false,
  surface = "night",
  ring = false,
  faintRing = false,
  dim = false,
  className = "",
}: Props) {
  const look = avatarOf(name, avatar);
  const style = ANIMAL_STYLE[look.animal];
  const fill = size === "fill";
  const px = fill ? 60 : size;

  const onParchment = surface === "parchment";
  const showRing = ring || host;
  const ringBg = onParchment ? "var(--parchment)" : "var(--night)";
  const ringColor = faintRing ? "rgba(242,227,191,.4)" : onParchment ? "var(--ink-warm)" : "var(--gold-bright)";
  const outer = px >= 70 ? 6 : 5;


  // A hat overhangs the circle, so the box the layout sees is that much taller —
  // otherwise crowns push into whatever sits above them.
  const room = look.hat ? HAT_ROOM : 0;

  return (
    <span
      className={`${fill ? "block w-full" : "inline-block flex-none"} ${className}`}
      style={fill ? { paddingTop: `${room * 100}%` } : { width: px, paddingTop: px * room }}
    >
      <span className="relative block" style={fill ? { aspectRatio: "1" } : { width: px, height: px }}>
      <span
        className="relative block overflow-hidden"
        style={{
          width: fill ? "100%" : px,
          height: fill ? "100%" : px,
          borderRadius: "50%",
          background: style.fill,
          opacity: dim ? 0.55 : 1,
          transform: rotate ? `rotate(${rotate}deg)` : undefined,
          boxShadow: showRing ? `0 0 0 3px ${ringBg}, 0 0 0 ${outer}px ${ringColor}` : undefined,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={animalSrc(look.animal)}
          alt=""
          aria-hidden
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", imageRendering: "pixelated" }}
        />
      </span>

      {/* outside the circle, so the crown is free to overhang it */}
      {look.hat && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={hatSrc(look.hat)}
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            top: `${HAT_TOP * 100}%`,
            left: "50%",
            height: `${HAT_HEIGHT * 100}%`,
            width: "auto",
            transform: "translateX(-50%)",
            imageRendering: "pixelated",
            pointerEvents: "none",
          }}
        />
      )}
      </span>
    </span>
  );
}

/** A seat nobody has taken. `invite` adds the centred plus. */
export function EmptySeat({ size = 46, invite = false }: { size?: number | "fill"; invite?: boolean }) {
  const fill = size === "fill";
  return (
    <span
      className={`grid place-items-center ${fill ? "w-full" : "flex-none"}`}
      style={{
        width: fill ? "100%" : size,
        height: fill ? undefined : size,
        aspectRatio: "1",
        borderRadius: "50%",
        border: `2.5px dashed rgba(242,227,191,${invite ? 0.3 : 0.16})`,
        color: `rgba(242,227,191,${invite ? 0.4 : 0.2})`,
        fontSize: fill ? 26 : Math.round(size * 0.4),
        fontWeight: 500,
        lineHeight: 1,
      }}
    >
      {invite ? "+" : ""}
    </span>
  );
}
