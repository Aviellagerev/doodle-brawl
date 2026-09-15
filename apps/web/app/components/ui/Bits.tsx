"use client";
import type { CSSProperties, ReactNode, ButtonHTMLAttributes } from "react";

/** Recurring pieces of the Scrawl & Sorcery kit. */

type Div = { children?: ReactNode; className?: string; style?: CSSProperties };

/* ── Grounds ───────────────────────────────────────────────────────────────── */

/** A full-height night ground. Each screen places its own candle glow. */
export function Night({
  children,
  glow = "rgba(255,214,140,.13)",
  x = "50%",
  y = "0%",
  bloom,
  bloomX = "82%",
  bloomY = "74%",
  className = "",
  style,
}: Div & { glow?: string; x?: string; y?: string; bloom?: string; bloomX?: string; bloomY?: string }) {
  return (
    <div
      className={`night min-h-screen ${className}`}
      style={{
        ["--glow" as string]: glow,
        ["--glow-x" as string]: x,
        ["--glow-y" as string]: y,
        ...(bloom ? { ["--bloom" as string]: bloom, ["--bloom-x" as string]: bloomX, ["--bloom-y" as string]: bloomY } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * A scatter of stars — one dot plus a box-shadow list placing the rest.
 * Cheap, non-repeating, and never animated.
 */
export function Starfield({ top = 90, left = 60, wide = false }: { top?: number; left?: number; wide?: boolean }) {
  const dots = wide
    ? "180px 46px 0 -1px #ffe9b0,318px -18px 0 -2px #ffd98a,470px 92px 0 -1px #fff2cf,700px 24px 0 -2px #ffe9b0,880px 120px 0 -1px #ffd98a,960px -22px 0 0 #fff2cf,60px 210px 0 -2px #ffe9b0"
    : "130px 30px 0 -1px #ffd98a,250px -20px 0 -1px #fff2cf,66px 140px 0 -1px #ffe9b0,290px 104px 0 -1px #ffd98a";
  return (
    <span
      aria-hidden
      className="absolute pointer-events-none"
      style={{ top, left, width: 4, height: 4, borderRadius: "50%", background: "#ffe9b0", boxShadow: dots }}
    />
  );
}

/* ── Surfaces ──────────────────────────────────────────────────────────────── */

export function Card({
  children,
  className = "",
  style,
  tilt = 0,
  radius = 16,
  torn = false,
  shadow,
  animate = true,
}: Div & { tilt?: number; radius?: string | number; torn?: boolean; shadow?: string; animate?: boolean }) {
  return (
    <div
      className={`card tilt ${animate ? "tilt-in" : ""} ${torn ? "torn" : ""} ${className}`}
      style={{
        ["--tilt" as string]: `${tilt}deg`,
        borderRadius: torn ? undefined : radius,
        ...(shadow ? { boxShadow: shadow } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** The translucent tape strip that holds a card to the page. */
export function Tape({ w = 118, h = 30, rotate = -2, top = -15, left = "50%" }: { w?: number; h?: number; rotate?: number; top?: number; left?: number | string }) {
  const centered = left === "50%";
  return (
    <span
      aria-hidden
      className="tape absolute"
      style={{ top, left, width: w, height: h, marginLeft: centered ? -w / 2 : undefined, transform: `rotate(${rotate}deg)` }}
    />
  );
}

export function Eyebrow({ children, className = "", style, dim = 0.45, size = 10 }: Div & { dim?: number; size?: number }) {
  return (
    <span className={`eyebrow block ${className}`} style={{ fontSize: size, color: `rgba(242,227,191,${dim})`, ...style }}>
      {children}
    </span>
  );
}

/** The same label, on parchment. */
export function InkEyebrow({ children, className = "", style, dim = 0.45, size = 10 }: Div & { dim?: number; size?: number }) {
  return (
    <span className={`eyebrow block ${className}`} style={{ fontSize: size, color: `rgba(58,47,38,${dim})`, ...style }}>
      {children}
    </span>
  );
}

/** A small rotated label pinned over a corner. */
export function Sticker({
  children,
  bg = "var(--gold)",
  color = "var(--ink-warm)",
  rotate = 9,
  style,
  className = "",
}: Div & { bg?: string; color?: string; rotate?: number }) {
  return (
    <span
      className={`absolute eyebrow ${className}`}
      style={{
        background: bg,
        color,
        border: "2.5px solid var(--ink-warm)",
        borderRadius: 9,
        boxShadow: "2px 2px 0 var(--ink-warm)",
        padding: "5px 9px",
        fontSize: 10,
        letterSpacing: ".1em",
        transform: `rotate(${rotate}deg)`,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ── Controls ──────────────────────────────────────────────────────────────── */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "magenta" | "gold" | "teal";
  radius?: string;
  size?: number;
  /** set when the button sits on a parchment card, so `disabled` still reads */
  onLight?: boolean;
};

/** Primary action — Grenze 900, hard offset shadow, asymmetric corners. */
export function Btn({ tone = "magenta", radius = "34px 30px 34px 28px", size = 22, onLight = false, className = "", style, children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      className={`btn btn-${tone} ${onLight ? "btn-onlight" : ""} ${className}`}
      style={{ borderRadius: radius, fontSize: size, minHeight: 56, padding: "10px 22px", ...style }}
    >
      {children}
    </button>
  );
}

/** Secondary — parchment fill and a handwritten label; `night` drops the fill. */
export function Btn2({
  night = false,
  radius = "22px 26px 20px 24px",
  size = 15,
  className = "",
  style,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { night?: boolean; radius?: string; size?: number }) {
  return (
    <button
      {...rest}
      className={`btn2 ${night ? "btn2-night" : ""} ${className}`}
      style={{ borderRadius: radius, fontSize: size, padding: "12px 18px", ...style }}
    >
      {children}
    </button>
  );
}

export function Ghost({
  className = "",
  style,
  size = 12.5,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { size?: number }) {
  return (
    <button {...rest} className={`ghost ${className}`} style={{ minHeight: 44, padding: "0 14px", fontSize: size, ...style }}>
      {children}
    </button>
  );
}

/** One cell of a segmented setting (rounds / candle). */
export function Seg({
  active,
  disabled,
  tone = "magenta",
  onClick,
  children,
  compact = false,
  wide = false,
}: {
  active: boolean;
  disabled?: boolean;
  tone?: "magenta" | "gold";
  onClick?: () => void;
  children: ReactNode;
  compact?: boolean;
  /** cells holding a unit ("60s") are wider in the reference */
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="grid place-items-center"
      style={{
        minWidth: compact ? 36 : wide ? "clamp(40px, 11vw, 50px)" : "clamp(32px, 9vw, 38px)",
        minHeight: compact ? 34 : 38,
        padding: "0 6px",
        borderRadius: 11,
        fontFamily: "var(--font-sans)",
        fontSize: compact ? 13 : 14,
        cursor: disabled ? "default" : "pointer",
        ...(active
          ? {
              border: "2.5px solid var(--ink-warm)",
              background: tone === "gold" ? "var(--gold)" : "var(--magenta)",
              color: tone === "gold" ? "var(--ink-warm)" : "#fff6e2",
              fontWeight: 800,
              boxShadow: "2px 2px 0 var(--ink-warm)",
            }
          : {
              border: "2px solid rgba(58,47,38,.3)",
              background: "transparent",
              color: "rgba(58,47,38,.55)",
              fontWeight: 700,
            }),
      }}
    >
      {children}
    </button>
  );
}

/** The room code as an outlined chip on night — the in-game header variant. */
export function CodeChipNight({ code, size = 13 }: { code: string; size?: number }) {
  return (
    <span
      className="eyebrow flex-none"
      style={{
        border: "2.5px solid var(--parchment)",
        borderRadius: 11,
        background: "rgba(242,227,191,.1)",
        padding: "6px 12px",
        fontSize: size,
        letterSpacing: ".1em",
        color: "var(--parchment)",
        transform: "rotate(-1.5deg)",
      }}
    >
      {code}
    </span>
  );
}

/** A dashed rule with a mono label through the middle. */
export function DashDivider({ label, night = true }: { label?: string; night?: boolean }) {
  const line = night ? "rgba(242,227,191,.22)" : "rgba(58,47,38,.28)";
  const ink = night ? "rgba(242,227,191,.4)" : "rgba(58,47,38,.42)";
  return (
    <div className="flex items-center gap-3 w-full">
      <span className="flex-1" style={{ borderTop: `2px dashed ${line}` }} />
      {label && <span className="eyebrow flex-none" style={{ fontSize: 9.5, letterSpacing: ".26em", color: ink }}>{label}</span>}
      <span className="flex-1" style={{ borderTop: `2px dashed ${line}` }} />
    </div>
  );
}

/** The room code, on parchment, with a copied-flash. */
export function CodeChip({
  code,
  onCopy,
  copied,
  note,
  size = 14,
  emphasize = false,
}: { code: string; onCopy?: () => void; copied?: boolean; note?: string; size?: number; emphasize?: boolean }) {
  return (
    <button
      type="button"
      onClick={onCopy}
      title={onCopy ? "copy the room code" : undefined}
      className="flex-none"
      style={{
        background: "var(--parchment-mid)",
        border: "2.5px solid var(--ink)",
        borderRadius: 11,
        boxShadow: emphasize ? "0 0 0 3px var(--gold), 3px 3px 0 rgba(0,0,0,.42)" : "3px 3px 0 rgba(0,0,0,.42)",
        padding: "7px 13px",
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        fontSize: size,
        letterSpacing: ".08em",
        color: "var(--ink-warm)",
        cursor: onCopy ? "pointer" : "default",
        transform: "rotate(-1.5deg)",
      }}
    >
      <span dir="auto">{copied ? "copied ✓" : code}</span>
      {note && !copied && <span className="ml-2" style={{ fontSize: 9.5, opacity: 0.55, letterSpacing: 0 }}>{note}</span>}
    </button>
  );
}
