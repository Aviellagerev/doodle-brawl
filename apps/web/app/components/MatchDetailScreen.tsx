"use client";

import { useState } from "react";
import type { MatchDetail } from "../../../../packages/shared";
import ReplayCanvas from "./ReplayCanvas";
import { Night, Card, Eyebrow, InkEyebrow, Ghost } from "./ui/Bits";
import { EmptyNote, LoadingNote } from "./game/StateScreens";
import { ordinal } from "../lib/numbers";

type Props = { detail: MatchDetail | null; loading?: boolean; onClose: () => void };

const ROT = [-0.6, 0.4, -0.3];
const RANK: Record<string, { label: string; color: string }> = {
  easy: { label: "cantrip", color: "var(--green)" },
  normal: { label: "hex", color: "var(--magenta)" },
  hard: { label: "forbidden", color: "var(--red)" },
};

const secs = (v: number | null) => (v === null ? "—" : `${(v / 1000).toFixed(1)}s`);

/** One rite, unrolled. */
export default function MatchDetailScreen({ detail, loading, onClose }: Props) {
  const [openReplay, setOpenReplay] = useState<string | null>(null);

  return (
    <Night className="p-5 sm:p-9" glow="rgba(255,214,140,.13)" x="50%" y="0%">
      <div className="mx-auto w-full max-w-[760px]">
        <div className="flex items-start justify-between gap-4 mb-7">
          <div className="min-w-0">
            <Eyebrow dim={0.45} size={10}>{detail ? new Date(detail.endedAt).toLocaleString() : "unrolling"}</Eyebrow>
            <h2 className="display m-0 mt-2 truncate" style={{ fontSize: "clamp(28px, 6vw, 40px)", color: "var(--parchment)" }}>
              The rite of <span style={{ color: "var(--gold-bright)" }}>{detail?.roomCode ?? "…"}</span>
            </h2>
          </div>
          <Ghost onClick={onClose} className="flex-none">← back</Ghost>
        </div>

        {loading && <LoadingNote text="unrolling the scroll…" />}
        {!loading && !detail && <EmptyNote title="that rite is not yours to read" />}

        {detail && (
          <>
            <Card className="mb-8 p-4" tilt={-0.4} radius={15} shadow="4px 4px 0 rgba(0,0,0,.42)">
              <InkEyebrow dim={0.45} size={9.5} className="mb-3">final standing</InkEyebrow>
              <div className="flex flex-col gap-2.5">
                {detail.participants.map((p) => (
                  <div key={p.playerId} className="flex items-center gap-3">
                    <span
                      className="grid place-items-center flex-none display"
                      style={{
                        width: 34, height: 34, borderRadius: 10, fontSize: 15,
                        border: "2.5px solid var(--ink)",
                        background: p.placement === 1 ? "var(--gold)" : "var(--parchment-mid)",
                        color: "var(--ink-warm)",
                      }}
                    >
                      {ordinal(p.placement)}
                    </span>
                    <span className="flex-1 min-w-0 truncate" dir="auto" style={{ fontFamily: "var(--font-loud)", fontWeight: 800, fontSize: 15, color: "var(--ink-warm)" }}>
                      {p.displayName}
                    </span>
                    <span className="display flex-none" style={{ fontSize: 18, color: "var(--magenta-ink)" }}>{p.finalScore} ✦</span>
                  </div>
                ))}
              </div>
            </Card>

            <Eyebrow dim={0.45} size={10} className="mb-3.5">{detail.turns.length} castings</Eyebrow>

            <div className="flex flex-col gap-4">
              {detail.turns.map((t, i) => {
                const r = RANK[t.difficulty];
                return (
                  <Card key={t.turnId} className="p-4" tilt={ROT[i % ROT.length]} radius="14px 20px 13px 22px" shadow="4px 4px 0 rgba(0,0,0,.42)">
                    <div className="flex items-center gap-3 flex-wrap mb-3">
                      <span className="display" dir="auto" style={{ fontSize: 22, color: "var(--ink-warm)" }}>{t.word}</span>
                      <span
                        className="eyebrow"
                        style={{ background: r?.color ?? "var(--parchment-mid)", border: "2px solid var(--ink-warm)", borderRadius: 8, padding: "3px 8px", fontSize: 9, color: "var(--ink-warm)" }}
                      >
                        {r?.label ?? t.difficulty}
                      </span>
                      {t.hasReplay && (
                        <button
                          onClick={() => setOpenReplay(openReplay === t.turnId ? null : t.turnId)}
                          className="cursor-pointer eyebrow"
                          style={{
                            background: openReplay === t.turnId ? "var(--teal)" : "transparent",
                            border: "2px solid var(--ink-warm)", borderRadius: 8, padding: "4px 9px", fontSize: 9, color: "var(--ink-warm)",
                          }}
                        >
                          {openReplay === t.turnId ? "▾ hide the vellum" : "▶ see the vellum"}
                        </button>
                      )}
                      <InkEyebrow dim={0.45} size={9} className="ml-auto">
                        cast by {t.drawerName} · +{t.drawerPoints} ✦
                      </InkEyebrow>
                    </div>

                    {openReplay === t.turnId && <ReplayCanvas turnId={t.turnId} />}

                    {t.guesses.length === 0 ? (
                      <span style={{ fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 13, color: "rgba(58,47,38,.5)" }}>
                        nobody was watching
                      </span>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        {t.guesses.map((g) => (
                          <span
                            key={g.playerId}
                            style={{
                              border: `2px ${g.msToGuess === null ? "dashed" : "solid"} var(--ink-warm)`,
                              borderRadius: 9, padding: "4px 10px", fontSize: 11.5, fontWeight: 700,
                              background: g.msToGuess === null ? "transparent" : "var(--green)",
                              color: "var(--ink-warm)",
                              opacity: g.msToGuess === null ? 0.55 : 1,
                            }}
                          >
                            {g.displayName} · {g.msToGuess === null ? "never got it" : secs(g.msToGuess)}
                          </span>
                        ))}
                      </div>
                    )}

                    {detail.chat.filter((c) => c.turnId === t.turnId).length > 0 && (
                      <div className="mt-3.5 pt-3" style={{ borderTop: "2px dashed rgba(58,47,38,.25)" }}>
                        {detail.chat.filter((c) => c.turnId === t.turnId).map((c, ci) => (
                          <div key={ci} style={{ fontWeight: 600, fontSize: 12.5, lineHeight: 1.5, color: "rgba(58,47,38,.7)" }}>
                            <b style={{ color: c.kind === "correct" ? "oklch(0.45 0.14 145)" : c.kind === "system" ? "rgba(58,47,38,.45)" : "var(--magenta-deep)", fontWeight: 700 }}>
                              {c.displayName}
                            </b>{" "}
                            <span dir="auto">{c.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Night>
  );
}
