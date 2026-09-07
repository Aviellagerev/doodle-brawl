"use client";

import { useState } from "react";
import type { MatchSummary, PlayerStats, PublicUser } from "../../../../packages/shared";

type HistoryScreenProps = {
  matches: MatchSummary[];
  stats: PlayerStats | null;
  user?: PublicUser | null;
  loading?: boolean;
  onOpenMatch: (id: string) => void;
  onClose: () => void;
};

const hardShadow = (x: number, y: number) => ({ boxShadow: `${x}px ${y}px 0 var(--outline)` });
const ROT = [-0.5, 0.4, -0.3, 0.6, -0.45, 0.3];
const EYEBROW = { fontWeight: 700, fontSize: 10.5, letterSpacing: ".12em" } as const;

const ms = (v: number | null) => (v === null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`);
const when = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const ordinal = (n: number) =>
  `${n}${["th", "st", "nd", "rd"][((n % 100) - 20) % 10] ?? ["th", "st", "nd", "rd"][n % 100] ?? "th"}`;

type Filter = "all" | "won" | "lost";

function Stat({ label, value, tone, dim }: { label: string; value: string; tone?: string; dim?: boolean }) {
  return (
    <div
      className="flex-1 min-w-[124px]"
      style={
        dim
          ? { border: "2.5px dashed color-mix(in srgb, var(--ink) 28%, transparent)", borderRadius: 14, padding: "12px 14px" }
          : { background: "var(--card)", border: "2.5px solid var(--outline)", borderRadius: 14, ...hardShadow(3, 3), padding: "12px 14px" }
      }
    >
      <span className="block font-mono uppercase text-ink/45" style={EYEBROW}>{label}</span>
      <span className="font-loud block" style={{ fontWeight: 800, fontSize: 34, lineHeight: 1.05, color: tone ?? "var(--ink)" }}>
        {value}
      </span>
    </div>
  );
}

export default function HistoryScreen({ matches, stats, user, loading, onOpenMatch, onClose }: HistoryScreenProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const shown = matches.filter((m) =>
    filter === "all" ? true : filter === "won" ? m.placement === 1 : m.placement !== 1);

  const best = matches.reduce<MatchSummary | null>(
    (b, m) => (b === null || m.finalScore > b.finalScore ? m : b), null);

  return (
    <div className="min-h-screen p-5 sm:p-9">
      <div className="mx-auto w-full max-w-[1000px]">

        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <span className="block font-mono uppercase text-ink/45 mb-1" style={EYEBROW}>your record</span>
            <h2 className="font-loud m-0" style={{ fontWeight: 800, fontSize: "clamp(34px, 7vw, 48px)", lineHeight: 1 }}>
              Match <span className="text-orange">history</span>
            </h2>
            <p className="font-loud italic text-ink/50 m-0 mt-1.5" style={{ fontWeight: 700, fontSize: 14 }}>
              {user ? `${user.username || user.email} · signed in` : "playing as a guest"}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {(["all", "won", "lost"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="font-bold cursor-pointer capitalize"
                style={
                  filter === f
                    ? { background: "var(--card)", color: "var(--ink)", border: "2.5px solid var(--outline)", borderRadius: 11, ...hardShadow(2, 2), padding: "6px 13px", fontSize: 12 }
                    : { background: "transparent", color: "color-mix(in srgb, var(--ink) 45%, transparent)", border: "2.5px dashed color-mix(in srgb, var(--ink) 25%, transparent)", borderRadius: 11, padding: "6px 13px", fontSize: 12 }
                }
              >
                {f}
              </button>
            ))}
            <button
              onClick={onClose}
              className="font-bold cursor-pointer bg-card text-ink ml-1"
              style={{ border: "2.5px solid var(--outline)", borderRadius: 11, ...hardShadow(3, 3), padding: "7px 13px", fontSize: 12 }}
            >
              ← Back
            </button>
          </div>
        </div>

        {stats && (
          <div className="flex gap-2.5 flex-wrap mb-7">
            <Stat label="matches" value={String(stats.matchesPlayed)} />
            <Stat label="won" value={String(stats.matchesWon)} tone="var(--lime)" />
            <Stat label="guess rate" value={`${stats.hitRatePct}%`} dim />
            <Stat label="fastest guess" value={ms(stats.fastestMs)} tone="var(--cyan)" dim />
          </div>
        )}

        <div className="flex gap-7 items-start flex-wrap lg:flex-nowrap">

          <div className="flex-1 min-w-[300px] flex flex-col gap-3.5">
            {loading && (
              <p className="font-loud italic text-ink/50 m-0" style={{ fontWeight: 700, fontSize: 16 }}>
                digging through the pile…
              </p>
            )}

            {!loading && shown.length === 0 && (
              <div className="bg-card grid place-items-center text-center"
                   style={{ border: "2.5px dashed var(--outline)", borderRadius: 18, padding: "44px 24px", transform: "rotate(-0.4deg)" }}>
                <span className="font-loud mb-1.5 block" style={{ fontWeight: 800, fontSize: 22 }}>
                  {matches.length === 0 ? "Nothing here yet" : `No ${filter} matches`}
                </span>
                <span className="font-loud italic text-ink/50 block" style={{ fontWeight: 700, fontSize: 14.5 }}>
                  {matches.length === 0 ? "Finish a match and it'll show up." : "Try another filter."}
                </span>
              </div>
            )}

            {shown.map((m, i) => {
              const won = m.placement === 1;
              return (
                <div
                  key={m.matchId}
                  onClick={() => onOpenMatch(m.matchId)}
                  className="relative flex items-center gap-4 flex-wrap cursor-pointer"
                  style={{
                    background: won ? "var(--card)" : "color-mix(in srgb, var(--card) 55%, transparent)",
                    border: won ? "2.5px solid var(--outline)" : "2.5px dashed color-mix(in srgb, var(--ink) 30%, transparent)",
                    borderRadius: "15px 21px 14px 23px",
                    ...(won ? hardShadow(4, 4) : {}),
                    opacity: won ? 1 : 0.82,
                    padding: "14px 17px",
                    transform: `rotate(${ROT[i % ROT.length]}deg)`,
                  }}
                >
                  {won && (
                    <span className="absolute" style={{ top: -13, right: 16, fontSize: 23, transform: "rotate(9deg)" }}>👑</span>
                  )}

                  <div
                    className="grid place-items-center font-loud flex-none"
                    style={{
                      width: 52, height: 52, borderRadius: 15, fontWeight: 800, fontSize: 19, color: "var(--ink)",
                      border: won ? "2.5px solid var(--outline)" : "2.5px dashed color-mix(in srgb, var(--ink) 35%, transparent)",
                      background: won ? "var(--amber)" : "transparent",
                    }}
                  >
                    {ordinal(m.placement)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="font-loud block truncate" style={{ fontWeight: 800, fontSize: 17.5 }}>
                      {m.roomCode} · {m.rounds} {m.rounds === 1 ? "round" : "rounds"}
                    </span>
                    <span className="font-mono uppercase text-ink/45 block mt-1" style={{ fontWeight: 700, fontSize: 10, letterSpacing: ".1em" }}>
                      {when(m.endedAt)} · {m.playerCount} players · as {m.displayName}
                    </span>
                  </div>

                  <div className="text-right flex-none">
                    <span className="font-loud block" style={{ fontWeight: 800, fontSize: 23, lineHeight: 1 }}>{m.finalScore}</span>
                    <span className="font-mono uppercase text-ink/45 block mt-0.5" style={{ fontWeight: 700, fontSize: 9, letterSpacing: ".1em" }}>
                      points earned
                    </span>
                  </div>
                </div>
              );
            })}

            {shown.length > 0 && (
              <p className="font-loud italic text-ink/40 m-0 mt-1 text-center" style={{ fontWeight: 700, fontSize: 12.5 }}>
                {matches.length === shown.length
                  ? `that's all ${matches.length} of them`
                  : `${matches.length - shown.length} more behind the other filters`}
              </p>
            )}
          </div>

          <aside className="w-full lg:w-[290px] flex-none flex flex-col gap-3.5">
            <span className="block font-mono uppercase text-ink/45" style={EYEBROW}>worth mentioning</span>

            {best && (
              <div className="bg-card" style={{ border: "2.5px solid var(--outline)", borderRadius: "14px 20px 13px 22px", ...hardShadow(4, 4), padding: "13px 15px", transform: "rotate(0.8deg)" }}>
                <span className="block font-mono uppercase text-ink/45 mb-1" style={{ ...EYEBROW, fontSize: 9.5 }}>best haul</span>
                <span className="font-loud block" style={{ fontWeight: 800, fontSize: 30, lineHeight: 1, color: "var(--orange)" }}>
                  {best.finalScore}
                </span>
                <span className="font-loud italic text-ink/55 block mt-1" style={{ fontWeight: 700, fontSize: 12.5 }}>
                  in {best.roomCode}, {when(best.endedAt)}
                </span>
              </div>
            )}

            {stats && stats.chances > 0 && (
              <div style={{ border: "2.5px dashed color-mix(in srgb, var(--ink) 28%, transparent)", borderRadius: 14, padding: "12px 14px" }}>
                <span className="font-loud text-ink/70" style={{ fontWeight: 700, fontSize: 13.5, lineHeight: 1.45 }}>
                  You got <strong className="text-ink">{stats.guessed}</strong> of{" "}
                  <strong className="text-ink">{stats.chances}</strong> words,
                  {stats.avgMs !== null ? <> averaging <strong className="text-ink">{ms(stats.avgMs)}</strong>.</> : " eventually."}
                </span>
              </div>
            )}

            {!user && (
              <div className="bg-card" style={{ border: "2.5px solid var(--amber)", borderRadius: 14, ...hardShadow(3, 3), padding: "13px 15px", transform: "rotate(-0.7deg)" }}>
                <span className="font-loud block text-ink" style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.35 }}>
                  This record lives in this browser only.
                </span>
                <button onClick={onClose} className="font-loud underline cursor-pointer text-orange mt-1.5" style={{ fontWeight: 800, fontSize: 13.5 }}>
                  Make an account to keep it →
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
