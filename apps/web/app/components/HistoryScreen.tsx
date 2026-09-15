"use client";

import { useState } from "react";
import type { MatchSummary, PlayerStats, PublicUser } from "../../../../packages/shared";
import { Night, Card, Eyebrow, InkEyebrow, Ghost } from "./ui/Bits";
import { EmptyNote, LoadingNote } from "./game/StateScreens";
import { ordinal } from "../lib/numbers";

type HistoryScreenProps = {
  matches: MatchSummary[];
  stats: PlayerStats | null;
  user?: PublicUser | null;
  loading?: boolean;
  /** more rites sit behind this page */
  hasMore?: boolean;
  onLoadMore?: () => void;
  onOpenMatch: (id: string) => void;
  onClose: () => void;
};

const ROT = [-0.5, 0.4, -0.3];
const RANK_FILL = ["var(--gold)", "var(--parchment-mid)", "var(--parchment-dim)", "var(--parchment-dimmer)"];
const META = { fontWeight: 600, fontSize: 12, marginTop: 3 } as const;

const ms = (v: number | null) => (v === null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`);
const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });

type Filter = "All" | "Won" | "Lost";
const FILTERS: Filter[] = ["All", "Won", "Lost"];

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="faint flex-1 min-w-[132px]" style={{ padding: "13px 15px" }}>
      <Eyebrow dim={0.45} size={9.5}>{label}</Eyebrow>
      <span className="display block mt-1.5" style={{ fontSize: 32, color: tone ?? "var(--parchment)" }}>{value}</span>
    </div>
  );
}

/** 06 · The chronicle. */
export default function HistoryScreen({ matches, stats, user, loading, hasMore, onLoadMore, onOpenMatch, onClose }: HistoryScreenProps) {
  const [filter, setFilter] = useState<Filter>("All");

  const shown = matches.filter((m) =>
    filter === "All" ? true : filter === "Won" ? m.placement === 1 : m.placement !== 1);

  const best = matches.reduce<MatchSummary | null>(
    (b, m) => (b === null || m.finalScore > b.finalScore ? m : b), null);
  const missed = stats ? Math.max(0, stats.chances - stats.guessed) : 0;

  return (
    <Night className="p-5 sm:p-9" glow="rgba(255,214,140,.13)" x="50%" y="0%">
      <div className="mx-auto w-full max-w-[1000px]">

        <div className="flex items-start justify-between gap-4 flex-wrap mb-7">
          <div>
            <h2 className="display m-0" style={{ fontSize: "clamp(28px, 6vw, 32px)", color: "var(--parchment)" }}>The chronicle</h2>
            <p className="m-0 mt-2" style={{ fontFamily: "var(--font-loud)", fontWeight: 700, fontSize: 13, color: "rgba(242,227,191,.5)" }}>
              {user ? `${user.username || user.email} · sworn in` : "a wandering stranger · this browser only"}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="cursor-pointer"
                style={
                  filter === f
                    ? { background: "var(--parchment)", color: "var(--ink-warm)", border: "2.5px solid var(--ink)", borderRadius: 11, boxShadow: "2px 2px 0 rgba(0,0,0,.42)", padding: "7px 14px", fontSize: 12, fontWeight: 700 }
                    : { background: "transparent", color: "rgba(242,227,191,.45)", border: "2.5px dashed rgba(242,227,191,.3)", borderRadius: 11, padding: "7px 14px", fontSize: 12, fontWeight: 600 }
                }
              >
                {f}
              </button>
            ))}
            <Ghost onClick={onClose} className="ml-1">← back</Ghost>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap mb-8">
          <Stat label="rites" value={String(stats?.matchesPlayed ?? 0)} />
          <Stat label="won" value={String(stats?.matchesWon ?? 0)} tone="var(--gold-bright)" />
          <Stat label="fastest divination" value={ms(stats?.fastestMs ?? null)} />
          <Stat label="spells nobody got" value={String(missed)} tone="var(--magenta)" />
        </div>

        <div className="flex gap-7 items-start flex-wrap lg:flex-nowrap">
          <div className="flex-1 min-w-[300px] flex flex-col gap-4">
            {loading && matches.length === 0 && <LoadingNote text="unrolling the scrolls…" />}

            {!loading && matches.length === 0 && shown.length === 0 && (
              <EmptyNote
                title={matches.length === 0 ? "no rites yet" : `no ${filter.toLowerCase()} rites`}
                body={matches.length === 0 ? "go embarrass yourself." : "try another filter."}
              />
            )}

            {shown.map((m, i) => {
              const won = m.placement === 1;
              const fill = RANK_FILL[m.placement - 1];
              return (
                <div
                  key={m.matchId}
                  onClick={() => onOpenMatch(m.matchId)}
                  className={`relative flex items-center gap-4 cursor-pointer ${won || fill ? "grain" : "faint"}`}
                  style={{
                    ...(fill
                      ? {
                        background: "var(--parchment)",
                        border: "3px solid var(--ink)",
                        boxShadow: "4px 5px 0 rgba(0,0,0,.42)",
                        color: "var(--ink-warm)",
                      }
                      : { opacity: 0.8 }),
                    borderRadius: 15,
                    padding: "15px 18px",
                    transform: `rotate(${ROT[i % ROT.length]}deg)`,
                    contentVisibility: "auto",
                    containIntrinsicSize: "auto 86px",
                  }}
                >
                  {won && <span className="absolute" style={{ top: -14, right: 16, fontSize: 22, transform: "rotate(9deg)" }}>👑</span>}

                  <div
                    className="grid place-items-center flex-none display"
                    style={{
                      width: 52, height: 52, borderRadius: 14, fontSize: 23,
                      color: fill ? "var(--ink-warm)" : "rgba(242,227,191,.5)",
                      border: fill ? "2.5px solid var(--ink-warm)" : "2.5px dashed rgba(242,227,191,.35)",
                      background: fill ?? "transparent",
                    }}
                  >
                    {ordinal(m.placement)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span
                      className="block truncate"
                      dir="auto"
                      style={{ fontFamily: "var(--font-loud)", fontWeight: 800, fontSize: 17, color: fill ? "var(--ink-warm)" : "var(--parchment)" }}
                    >
                      {m.roomCode} · {m.rounds} {m.rounds === 1 ? "round" : "rounds"}
                    </span>
                    <div style={{ ...META, color: fill ? "rgba(58,47,38,.55)" : "rgba(242,227,191,.45)" }}>
                      {when(m.endedAt)} · {m.playerCount} wizards · as {m.displayName}
                    </div>
                  </div>

                  <div className="text-right flex-none">
                    <span
                      className="display block"
                      style={{ fontSize: 24, color: !fill ? "rgba(242,227,191,.6)" : won ? "var(--magenta-ink)" : "var(--ink-warm)" }}
                    >
                      {m.finalScore.toLocaleString()}
                    </span>
                    <span style={{ fontWeight: 600, fontSize: 10.5, color: fill ? "rgba(58,47,38,.45)" : "rgba(242,227,191,.35)" }}>
                      ✦ earned
                    </span>
                  </div>
                </div>
              );
            })}

            {shown.length > 0 && (
              <div className="text-center mt-1">
                {hasMore ? (
                  <Ghost onClick={onLoadMore} disabled={loading} size={12.5}>
                    {loading ? "unrolling…" : "older rites below"}
                  </Ghost>
                ) : (
                  <p className="m-0" style={{ fontWeight: 600, fontSize: 12, color: "rgba(242,227,191,.35)" }}>
                    {matches.length === shown.length
                      ? `that is all ${matches.length} of them`
                      : `${matches.length - shown.length} more behind the other filters`}
                  </p>
                )}
              </div>
            )}
          </div>

          <aside className="w-full lg:w-[290px] flex-none flex flex-col gap-4">
            <Eyebrow dim={0.45} size={9.5}>spells they still talk about</Eyebrow>

            {best && (
              <Card className="p-4" tilt={1} radius="14px 20px 13px 22px" shadow="4px 4px 0 rgba(0,0,0,.42)">
                <InkEyebrow dim={0.45} size={9}>best haul</InkEyebrow>
                <span className="display block mt-1.5" style={{ fontSize: 30, color: "var(--magenta-ink)" }}>{best.finalScore.toLocaleString()} ✦</span>
                <span className="block mt-1.5" style={{ fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 12.5, color: "rgba(58,47,38,.55)" }}>
                  in {best.roomCode}, {when(best.endedAt)}
                </span>
              </Card>
            )}

            {stats && stats.chances > 0 && (
              <div className="faint" style={{ padding: "13px 15px" }}>
                <span style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.5, color: "rgba(242,227,191,.7)" }}>
                  You divined <b style={{ color: "var(--parchment)" }}>{stats.guessed}</b> of{" "}
                  <b style={{ color: "var(--parchment)" }}>{stats.chances}</b> spells
                  {stats.avgMs !== null ? <>, averaging <b style={{ color: "var(--parchment)" }}>{ms(stats.avgMs)}</b>.</> : ", eventually."}
                </span>
              </div>
            )}

            {!user && (
              <div className="faint" style={{ padding: "13px 15px", borderColor: "var(--gold)" }}>
                <span className="block" style={{ fontFamily: "var(--font-loud)", fontWeight: 800, fontSize: 14, lineHeight: 1.4, color: "var(--parchment)" }}>
                  Strangers keep no record beyond this browser.
                </span>
                <button
                  onClick={onClose}
                  className="cursor-pointer underline mt-2"
                  style={{ background: "transparent", border: 0, color: "var(--gold-bright)", fontFamily: "var(--font-loud)", fontWeight: 700, fontSize: 13 }}
                >
                  conjure an account →
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </Night>
  );
}
