"use client";

import { useState } from "react";
import type { MatchDetail } from "../../../../packages/shared";
import ReplayCanvas from "./ReplayCanvas";

type Props = { detail: MatchDetail | null; loading?: boolean; onClose: () => void };

const hardShadow = (x: number, y: number) => ({ boxShadow: `${x}px ${y}px 0 var(--outline)` });
const ROT = [-0.6, 0.4, -0.3, 0.7, -0.5, 0.3];

const DIFF: Record<string, string> = {
  easy: "var(--lime)", normal: "var(--cyan)", hard: "var(--rose)",
};

function secs(v: number | null) {
  return v === null ? "—" : `${(v / 1000).toFixed(1)}s`;
}

function ordinal(n: number) {
  return `${n}${["th", "st", "nd", "rd"][((n % 100) - 20) % 10] ?? ["th", "st", "nd", "rd"][n % 100] ?? "th"}`;
}

export default function MatchDetailScreen({ detail, loading, onClose }: Props) {
  const [openReplay, setOpenReplay] = useState<string | null>(null);
  return (
    <div className="min-h-screen p-5 sm:p-10">
      <div className="mx-auto w-full max-w-[760px]">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <span className="block font-mono uppercase text-ink/45 mb-1" style={{ fontWeight: 700, fontSize: 10.5, letterSpacing: ".12em" }}>
              {detail ? new Date(detail.endedAt).toLocaleString() : "loading"}
            </span>
            <h2 className="font-loud m-0 truncate" style={{ fontWeight: 800, fontSize: "clamp(30px, 6vw, 42px)", lineHeight: 1 }}>
              Room <span className="text-orange">{detail?.roomCode ?? "…"}</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="font-bold cursor-pointer bg-card text-ink flex-none"
            style={{ border: "2.5px solid var(--outline)", borderRadius: 12, ...hardShadow(3, 3), padding: "9px 14px", fontSize: 12.5 }}
          >
            ← Back
          </button>
        </div>

        {loading && (
          <p className="font-loud italic text-ink/50 m-0" style={{ fontWeight: 700, fontSize: 16 }}>
            unrolling the scroll…
          </p>
        )}

        {!loading && !detail && (
          <div className="bg-card grid place-items-center text-center"
               style={{ border: "2.5px dashed var(--outline)", borderRadius: 18, padding: "40px 24px" }}>
            <span className="font-loud" style={{ fontWeight: 800, fontSize: 20 }}>That match isn&apos;t yours to read</span>
          </div>
        )}

        {detail && (
          <>
            <div className="bg-card mb-7" style={{ border: "2.5px solid var(--outline)", borderRadius: 15, ...hardShadow(4, 4), padding: "14px 16px", transform: "rotate(-0.4deg)" }}>
              <span className="block font-mono uppercase text-ink/45 mb-2.5" style={{ fontWeight: 700, fontSize: 9.5, letterSpacing: ".12em" }}>
                final scores
              </span>
              <div className="flex flex-col gap-2">
                {detail.participants.map((p) => (
                  <div key={p.playerId} className="flex items-center gap-3">
                    <span className="grid place-items-center font-loud flex-none"
                          style={{ width: 32, height: 32, borderRadius: 10, border: "2.5px solid var(--outline)",
                                   background: p.placement === 1 ? "var(--amber)" : "var(--paper-deep)", fontWeight: 800, fontSize: 12.5 }}>
                      {ordinal(p.placement)}
                    </span>
                    <span className="font-loud flex-1 min-w-0 truncate" style={{ fontWeight: 700, fontSize: 16 }}>{p.displayName}</span>
                    <span className="font-loud flex-none" style={{ fontWeight: 800, fontSize: 17 }}>{p.finalScore}</span>
                  </div>
                ))}
              </div>
            </div>

            <span className="block font-mono uppercase text-ink/45 mb-3" style={{ fontWeight: 700, fontSize: 10.5, letterSpacing: ".12em" }}>
              {detail.turns.length} turns
            </span>

            <div className="flex flex-col gap-3.5">
              {detail.turns.map((t, i) => (
                <div key={t.turnId} className="bg-card"
                     style={{ border: "2.5px solid var(--outline)", borderRadius: "14px 20px 13px 22px", ...hardShadow(4, 4),
                              padding: "13px 16px", transform: `rotate(${ROT[i % ROT.length]}deg)` }}>
                  <div className="flex items-center gap-3 flex-wrap mb-2.5">
                    <span className="font-loud" style={{ fontWeight: 800, fontSize: 19 }}>{t.word}</span>
                    <span className="font-bold text-ink px-2 py-0.5"
                          style={{ background: DIFF[t.difficulty] ?? "var(--paper-deep)", border: "2px solid var(--outline)",
                                   borderRadius: 8, fontSize: 10.5 }}>
                      {t.difficulty}
                    </span>
                    {t.hasReplay && (
                      <button
                        onClick={() => setOpenReplay(openReplay === t.turnId ? null : t.turnId)}
                        className="font-bold text-ink px-2 py-0.5 cursor-pointer"
                        style={{ background: openReplay === t.turnId ? "var(--cyan)" : "var(--paper-deep)",
                                 border: "2px solid var(--outline)", borderRadius: 8, fontSize: 10.5 }}>
                        {openReplay === t.turnId ? "▾ hide drawing" : "▶ see drawing"}
                      </button>
                    )}
                    <span className="font-mono uppercase text-ink/45 ml-auto" style={{ fontWeight: 700, fontSize: 10, letterSpacing: ".1em" }}>
                      drawn by {t.drawerName} · +{t.drawerPoints}
                    </span>
                  </div>

                  {openReplay === t.turnId && <ReplayCanvas turnId={t.turnId} />}

                  {t.guesses.length === 0 ? (
                    <span className="font-loud italic text-ink/45" style={{ fontWeight: 700, fontSize: 13.5 }}>nobody was watching</span>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      {t.guesses.map((g) => (
                        <span key={g.playerId} className="font-bold px-2.5 py-1"
                              style={{ border: "2px solid var(--outline)", borderRadius: 9, fontSize: 11.5,
                                       background: g.msToGuess === null ? "transparent" : "var(--lime)",
                                       borderStyle: g.msToGuess === null ? "dashed" : "solid",
                                       opacity: g.msToGuess === null ? 0.55 : 1 }}>
                          {g.displayName} · {g.msToGuess === null ? "never got it" : secs(g.msToGuess)}
                        </span>
                      ))}
                    </div>
                  )}

                  {detail.chat.filter((c) => c.turnId === t.turnId).length > 0 && (
                    <div className="mt-3 pt-2.5" style={{ borderTop: "2px dashed var(--outline)", opacity: 0.9 }}>
                      {detail.chat.filter((c) => c.turnId === t.turnId).map((c, ci) => (
                        <div key={ci} className="font-loud" style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.5 }}>
                          <span style={{ color: c.kind === "correct" ? "var(--lime)" : c.kind === "system" ? "var(--ink)" : "var(--orange)", opacity: c.kind === "chat" ? 1 : 0.75 }}>
                            {c.displayName}
                          </span>
                          <span className="text-ink/70">{" "}{c.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
