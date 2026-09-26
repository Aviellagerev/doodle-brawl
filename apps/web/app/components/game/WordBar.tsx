"use client";
import { Fragment } from "react";
import { GamePhase } from "../../../../../packages/shared";
import { CandleTimer } from "../ui/Candle";
import { Wordmark } from "../ui/Logo";
import { LeaveGhost, InkEyebrow } from "../ui/Bits";


type Props = {
    phase: GamePhase;
    isDrawer: boolean;
    divined: boolean;        // this diviner has already guessed it
    word: string | null;     // only sent to those allowed to know it
    wordLength: number | null;
    hint: string[] | null;   // per-letter reveal for diviners ("" hidden, " " space, else letter)
    wordDir: "ltr" | "rtl" | null;   // which way the spell reads
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
 * It is laid out in the spell's own direction: a Hebrew spell's first word sits
 * on the right, and so does its first letter once a hint uncovers it — blanks
 * alone carry no direction for the browser to find.
 */
function MaskedWord({ groups, size, dir }: { groups: string[]; size: string | number; dir: "ltr" | "rtl" | null }) {
    return (
        <div dir={dir ?? "auto"} className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
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

const DASH = /\p{Pd}/u;
const LETTER = /[\p{L}\p{N}]/u;

// "haunted kettle" → ["H A U N T E D", "K E T T L E"]; hidden letters read as _.
// A spelled-out word keeps the shape of the blanks (the server's hintForm): a
// hyphen parts words like a space, and an apostrophe rides on the letter before
// it — ג' י ר פ ה — so the caster sees as many letters as the rest see blanks.
function groupsOf(word: string | null, hint: string[] | null, wordLength: number | null): string[] {
    const cells = word
        ? [...word.toUpperCase()]
        : hint ?? Array.from({ length: wordLength ?? 0 }, () => "");
    const out: string[] = [];
    let cur: string[] = [];
    for (const ch of cells) {
        if (ch === " " || DASH.test(ch)) { out.push(cur.join(" ")); cur = []; }
        else if (ch && !LETTER.test(ch) && cur.length) cur[cur.length - 1] += ch;
        else cur.push(ch === "" ? "_" : ch.toUpperCase());
    }
    if (cur.length) out.push(cur.join(" "));
    return out.filter(Boolean);
}

export default function WordBar({ phase, isDrawer, divined, word, wordLength, hint, wordDir, round, totalRounds, drawerName, endsAt, totalMs, onLeave }: Props) {
    // the server sends the word only to whoever may see it: the caster, a
    // diviner who has already guessed it, and everyone once it is spent
    const groups = groupsOf(word, hint, wordLength);
    const label =
        phase === "scoring" ? "the spell was" :
            isDrawer ? "casting" :
                divined && word ? "divined ✦" :
                    `${drawerName} is casting`;

    return (
        <div className="flex items-center gap-2.5 sm:gap-3 lg:gap-4">
            {/* left — the way out on phones; the mark and the round on wide
                screens, unless the stage is short (a phone on its side) */}
            <LeaveGhost onLeave={onLeave} confirm className="sm:hidden flex-none" style={{ padding: "0 11px" }} />
            <div className="when-roomy hidden sm:flex items-center gap-3.5 flex-none">
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
                        <InkEyebrow dim={0.45} size={8.5} className="truncate" style={{ letterSpacing: ".18em", textAlign: "center" }}>
                            {/* wherever the round chip is not on show, the plaque carries the round */}
                            <span className="plaque-round">{round}/{totalRounds} · </span>{label}
                        </InkEyebrow>
                        <div className="mt-1.5">
                            {/* sized by the width, but never so large that a phone
                                on its side spends its little height on the plaque */}
                            <MaskedWord groups={groups} dir={wordDir} size="clamp(13px, min(3.6vw, 4.6cqh), 21px)" />
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
                <LeaveGhost onLeave={onLeave} confirm className="hidden sm:inline-block" />
            </div>
        </div>
    );
}
