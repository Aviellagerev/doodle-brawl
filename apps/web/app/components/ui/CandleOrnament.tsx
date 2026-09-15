"use client";
import { useEffect, useRef, useState } from "react";

/**
 * The candle in the corner of the join screen. It counts for nothing, which is
 * exactly why it is the right place to hide the room-wide player count: hover it
 * and the guild tells you how many wizards are awake. Press it and it gets
 * snuffed out and relights itself, with sparks.
 */
export default function CandleOrnament({ playerCount }: { playerCount?: number | null }) {
  const [burst, setBurst] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const strike = () => {
    if (timer.current) clearTimeout(timer.current);
    setBurst(true);
    timer.current = setTimeout(() => setBurst(false), 900);
  };

  const awake =
    playerCount == null
      ? "the guild is not counting"
      : `${playerCount.toLocaleString()} ${playerCount === 1 ? "wizard is" : "wizards are"} awake`;

  return (
    <button
      type="button"
      onClick={strike}
      aria-label={awake}
      className="candle-orn group absolute cursor-pointer"
      style={{ right: 54, bottom: 44, background: "transparent", border: 0, padding: 8 }}
    >
      {/* what the candle knows, on hover or keyboard focus */}
      <span
        className={`candle-tip pointer-events-none ${burst ? "is-open" : ""}`}
        style={{
          position: "absolute", bottom: "calc(100% + 6px)", right: 0, whiteSpace: "nowrap",
          background: "var(--parchment)", color: "var(--ink-warm)",
          border: "2.5px solid var(--ink)", borderRadius: 11,
          boxShadow: "3px 3px 0 rgba(0,0,0,.42)", padding: "7px 11px",
          fontWeight: 700, fontSize: 12, transform: "rotate(-1.5deg)",
        }}
      >
        {awake}
      </span>

      <span className="flex items-end gap-4" style={{ transform: "rotate(3deg)" }}>
        {/* the candle */}
        <span className="relative flex-none block" style={{ width: 20, height: 44, background: "var(--parchment)", border: "2.5px solid var(--ink)", borderRadius: "3px 3px 5px 5px" }}>
          <span className={`candle-flame ${burst ? "is-struck" : ""}`} />
          {burst && (
            <>
              <span className="candle-smoke" />
              {[-26, -10, 8, 24, -18, 16].map((x, i) => (
                <span
                  key={i}
                  className="candle-spark"
                  style={{ ["--sx" as string]: `${x}px`, ["--sy" as string]: `${-18 - (i % 3) * 9}px`, animationDelay: `${i * 22}ms` }}
                />
              ))}
            </>
          )}
          <span style={{ position: "absolute", inset: "auto 3px 3px", height: 24, background: "var(--magenta)", borderRadius: 2 }} />
        </span>

        {/* and the thing that watches it */}
        <span
          className="grid place-items-center"
          style={{ width: 46, height: 40, background: "var(--magenta)", border: "3px solid var(--ink)", borderRadius: "9px 7px 10px 8px", boxShadow: "3px 3px 0 rgba(0,0,0,.4)", fontSize: 15, color: "#fff6e2", fontFamily: "var(--font-loud)", fontWeight: 800 }}
        >
          ⊙⊙
        </span>
      </span>
    </button>
  );
}
