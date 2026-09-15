// The logo system: a wand mark on a rounded tile, plus the wordmark lockup.
// The tile alone is the app icon; the wand renders at ~58% of the tile's side.

type WandProps = { size: number; stick: string; spark: string; detail?: boolean };

export function Wand({ size, stick, spark, detail = true }: WandProps) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: "visible", display: "block" }} aria-hidden>
      <path d="M20 82 L64 38" stroke={stick} strokeWidth="13" strokeLinecap="round" fill="none" />
      <path d="M56 46 L74 28" stroke={spark} strokeWidth="13" strokeLinecap="round" fill="none" />
      <path d="M82 6 L86.5 19.5 L100 24 L86.5 28.5 L82 42 L77.5 28.5 L64 24 L77.5 19.5 Z" fill={spark} />
      <circle cx="14" cy="30" r="4" fill={spark} />
      {detail && <circle cx="36" cy="16" r="2.6" fill={stick} />}
    </svg>
  );
}

export type TileFill = "magenta" | "gold" | "teal" | "parchment";

const TILE: Record<TileFill, { bg: string; stick: string; spark: string }> = {
  magenta: { bg: "var(--magenta)", stick: "var(--parchment)", spark: "var(--parchment-bright)" },
  gold: { bg: "var(--gold)", stick: "var(--ink-warm)", spark: "var(--ink-warm)" },
  teal: { bg: "var(--teal)", stick: "var(--ink-warm)", spark: "var(--ink-warm)" },
  parchment: { bg: "var(--parchment)", stick: "var(--ink-warm)", spark: "var(--magenta-deep)" },
};

export function LogoTile({ size = 52, fill = "magenta" }: { size?: number; fill?: TileFill }) {
  const t = TILE[fill];
  const border = size >= 44 ? 3 : 2;
  const shadow = size >= 44 ? 4 : 2.5;
  return (
    <span
      className="grid place-items-center flex-none"
      style={{
        width: size,
        height: size,
        background: t.bg,
        border: `${border}px solid var(--ink)`,
        borderRadius: Math.round(size * 0.28),
        boxShadow: `${shadow}px ${shadow}px 0 rgba(0,0,0,.45)`,
      }}
    >
      <Wand size={Math.round(size * 0.58)} stick={t.stick} spark={t.spark} detail={size >= 44} />
    </span>
  );
}

/** The wordmark. Stacked on two lines by default; `inline` puts it on one. */
export function Wordmark({
  size = 44,
  onNight = true,
  inline = false,
}: { size?: number; onNight?: boolean; inline?: boolean }) {
  const amp = onNight ? "var(--gold-bright)" : "var(--magenta-deep)";
  const ink = onNight ? "var(--parchment)" : "var(--ink-warm)";
  return (
    <span
      className="display block"
      style={{ fontSize: size, lineHeight: inline ? 0.9 : 0.86, color: ink, letterSpacing: "-0.01em" }}
    >
      Scrawl{inline ? " " : <br />}
      <span style={{ color: amp }}>&amp;</span> Sorcery
    </span>
  );
}

/** Tile + wordmark, rotated as one piece. */
export function Lockup({
  tile = 52,
  size = 30,
  fill = "magenta",
  onNight = true,
  stacked = false,
}: { tile?: number; size?: number; fill?: TileFill; onNight?: boolean; stacked?: boolean }) {
  return (
    <span
      className={`inline-flex ${stacked ? "flex-col items-center gap-3" : "items-center gap-3"}`}
      style={{ transform: "rotate(-1.4deg)" }}
    >
      <LogoTile size={tile} fill={fill} />
      <Wordmark size={size} onNight={onNight} />
    </span>
  );
}
