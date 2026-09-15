"use client";
import { Fragment } from "react";
import { GamePhase } from "../../../../../packages/shared";
import { CandleTimer } from "../ui/Candle";
import { Wordmark } from "../ui/Logo";
import { Ghost, InkEyebrow } from "../ui/Bits";


type Props = {
    phase: GamePhase;
    isDrawer: boolean;
    word: string | null;
    wordLength: number | null;
    hint: string[] | null;   // per-letter reveal for diviners ("" hidden, " " space, else letter)
    round: number;
    totalRounds: number;
    drawerName: string;
    endsAt: number | null;
    totalMs: number;
    onLeave: () => void;
};

/**
 * The masked word plaque and the candle.
 * The word is rendered as one span per word with a rule between them — never a
 * single string, or the gap between words disappears under the letter-spacing.
 */
function MaskedWord({ groups, size }: { groups: string[]; size: string | number }) {
    return (
        <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
            {groups.map((g, i) => (
                <Fragment key={i}>
                    {i > 0 && <span className="flex-none w-4 sm:w-[22px]" style={{ height: 3, background: "rgba(58,47,38,.3)", borderRadius: 2 }} />}
                    <span className="display" style={{ fontSize: size, letterSpacing: ".24em", lineHeight: 1.15, color: "var(--ink-warm)", whiteSpace: "nowrap" }}>
                        {g}
                    </span>
                </Fragment>
            ))}
        </div>
    );
}

// "haunted kettle" → ["H A U N T E D", "K E T T L E"]; hidden letters read as _
function groupsOf(word: string | null, hint: string[] | null, wordLength: number | null): string[] {
    const cells = word
        ? word.toUpperCase().split("")
        : hint ?? Array.from({ length: wordLength ?? 0 }, () => "");
    const out: string[] = [];
    let cur: string[] = [];
    for (const ch of cells) {
        if (ch === " ") { out.push(cur.join(" ")); cur = []; }
        else cur.push(ch === "" ? "_" : ch.toUpperCase());
    }
    if (cur.length) out.push(cur.join(" "));
    return out.filter(Boolean);
}

export default function WordBar({ phase, isDrawer, word, wordLength, hint, round, totalRounds, drawerName, endsAt, totalMs, onLeave }: Props) {
    const groups = groupsOf(phase === "scoring" ? word : isDrawer ? word : null, hint, wordLength);
    const label =
        phase === "scoring" ? "the spell was" :
            isDrawer ? "casting" :
                `${drawerName} is casting`;

    return (
        <div className="flex items-center gap-3 lg:gap-4">
            {/* left — a back button on phones; the mark and the round on wide screens */}
            <Ghost onClick={onLeave} title="leave the circle" className="sm:hidden" style={{ width: 44, minWidth: 44, padding: 0, fontSize: 17 }}>
                ←
            </Ghost>
            <div className="hidden sm:flex items-center gap-3.5 flex-none">
                <Wordmark size={22} onNight inline />
                <span
                    className="eyebrow flex-none whitespace-nowrap"
                    style={{
                        border: "2px solid rgba(242,227,191,.4)", borderRadius: 9, padding: "4px 10px",
                        fontSize: 11, letterSpacing: ".14em", color: "rgba(242,227,191,.7)",
                    }}
                >
                    ROUND {round}/{totalRounds}
                </span>
            </div>

            {/* middle — the plaque */}
            <div className="flex-1 min-w-0 flex justify-center">
                {groups.length > 0 ? (
                    <div
                        className="card tilt max-w-full"
                        style={{
                            ["--tilt" as string]: "-1.4deg",
                            borderRadius: 12, padding: "6px 10px",
                            boxShadow: "4px 4px 0 rgba(0,0,0,.42)",
                        }}
                    >
                        <InkEyebrow dim={0.45} size={8.5} style={{ letterSpacing: ".18em", textAlign: "center" }}>{label}</InkEyebrow>
                        <div className="mt-1.5">
                            <MaskedWord groups={groups} size="clamp(13px, 3.6vw, 21px)" />
                        </div>
                    </div>
                ) : (
                    <span
                        className="truncate"
                        style={{ fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 15, color: "rgba(242,227,191,.55)" }}
                    >
                        {isDrawer ? "choose thy spell…" : `${drawerName} is choosing…`}
                    </span>
                )}
            </div>

            {/* right — the candle and the way out */}
            <div className="flex items-center gap-2.5 lg:gap-3.5 flex-none">
                <span className="lg:hidden"><CandleTimer endsAt={endsAt} totalMs={totalMs} w={16} h={34} numeral={22} /></span>
                <span className="hidden lg:inline-flex"><CandleTimer endsAt={endsAt} totalMs={totalMs} w={20} h={44} numeral={28} /></span>
                <Ghost onClick={onLeave} title="leave the circle" className="hidden sm:inline-grid" style={{ minWidth: 44, padding: "0 12px" }}>
                    leave
                </Ghost>
            </div>
        </div>
    );
}
