"use client";
import { useEffect, useState } from "react";

/**
 * The candle — this game's round timer.
 * A parchment stub with a flame above it and a magenta burn-down fill inside.
 * The server owns the deadline (endsAt); the candle only renders it.
 */

export function Candle({ w = 22, h = 46, frac = 1 }: { w?: number; h?: number; frac?: number }) {
  const pad = Math.max(3, Math.round(w * 0.09));
  const inner = Math.max(0, h - pad * 2 - 6);
  const lit = frac > 0;
  const flameW = Math.round(w * 0.62);
  const flameH = Math.round(w * 0.88);
  return (
    <span
      className="relative flex-none block"
      style={{
        width: w,
        height: h,
        background: "var(--parchment)",
        border: `${w >= 30 ? 3 : 2.5}px solid var(--ink)`,
        borderRadius: `${Math.round(w * 0.16)}px ${Math.round(w * 0.16)}px ${Math.round(w * 0.24)}px ${Math.round(w * 0.24)}px`,
      }}
    >
      {lit ? (
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: -flameH - Math.round(w * 0.18),
            marginLeft: -flameW / 2,
            width: flameW,
            height: flameH,
            borderRadius: "50% 50% 45% 45%",
            background: "var(--flame)",
            boxShadow: `0 0 ${Math.round(w * 1.4)}px ${Math.round(w * 0.42)}px rgba(255,196,90,.5)`,
          }}
        />
      ) : (
        // burned out — the wick smokes
        <span
          style={{
            position: "absolute",
            left: "50%",
            top: -Math.round(w * 0.7),
            marginLeft: -1,
            width: 2,
            height: Math.round(w * 0.6),
            borderRadius: 2,
            background: "linear-gradient(to top, rgba(242,227,191,.35), transparent)",
          }}
        />
      )}
      {frac > 0 && (
        <span
          style={{
            position: "absolute",
            inset: `auto ${pad}px ${pad}px`,
            height: Math.max(0, inner * frac),
            background: "var(--magenta)",
            borderRadius: Math.round(w * 0.1),
            transition: "height .25s linear",
          }}
        />
      )}
    </span>
  );
}

/** Candle + countdown numeral. Under 10s the numeral turns magenta and pulses. */
export function CandleTimer({
  endsAt,
  totalMs,
  w = 22,
  h = 46,
  numeral = 26,
  className = "",
}: {
  endsAt: number | null;
  totalMs: number;
  w?: number;
  h?: number;
  numeral?: number | false;   // false renders the candle alone
  className?: string;
}) {
  // the clock is the external system here: the effect only advances `now`,
  // and everything shown is derived from it during render
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [endsAt]);

  if (endsAt == null) return null;
  const left = Math.max(0, endsAt - now);
  const secs = Math.ceil(left / 1000);
  const frac = totalMs > 0 ? Math.max(0, Math.min(1, left / totalMs)) : 0;
  const low = secs <= 10;

  return (
    <span className={`inline-flex items-end gap-2 flex-none ${className}`}>
      <Candle w={w} h={h} frac={frac} />
      {numeral !== false && (
        <span
          className={`display ${low ? "pulse" : ""}`}
          style={{ fontSize: numeral, color: low ? "var(--magenta)" : "var(--gold-bright)", lineHeight: 1 }}
        >
          {secs}
        </span>
      )}
    </span>
  );
}
