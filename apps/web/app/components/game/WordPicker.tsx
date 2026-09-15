"use client";
import { useEffect, useState } from "react";
import { WordOption, Difficulty } from "../../../../../packages/shared";
import { Eyebrow, InkEyebrow, Btn2, Sticker, Tape } from "../ui/Bits";
import { Candle } from "../ui/Candle";

type Props = {
    words: WordOption[] | null;        // room.game.wordOptions (null for non-casters)
    rerollsLeft: number;
    onReroll: () => void;
    onChoose: (word: string) => void;
    endsAt: number | null;
    totalMs: number;
    waitingCount: number;
    drawerName: string;
};

// per-position treatment — fixed so the row never jitters on a re-render
const SPOTS = [
    { tilt: -2.4, lift: 0, bg: "var(--parchment)", sh: "rgba(0,0,0,.45)", tape: true },
    { tilt: 1.6, lift: -10, bg: "var(--parchment-bright)", sh: "var(--magenta)", tape: false },
    { tilt: 2.8, lift: 0, bg: "var(--parchment)", sh: "rgba(0,0,0,.45)", tape: false },
];

const RANK: Record<Difficulty, { label: string; dots: number; color: string }> = {
    easy: { label: "cantrip", dots: 1, color: "var(--green)" },
    normal: { label: "hex", dots: 2, color: "var(--magenta)" },
    hard: { label: "forbidden", dots: 3, color: "var(--red)" },
};

/** 02 · Choose thy spell. */
export default function WordPicker({ words, rerollsLeft, onReroll, onChoose, endsAt, totalMs, waitingCount, drawerName }: Props) {
    // the server owns the deadline; the effect only advances the clock
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (endsAt == null) return;
        const id = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(id);
    }, [endsAt]);

    const left = endsAt == null ? null : Math.max(0, endsAt - now);
    const secondsLeft = left == null ? null : Math.ceil(left / 1000);
    const frac = totalMs > 0 && left != null ? Math.max(0, Math.min(1, left / totalMs)) : 0;

    // Non-caster / no options yet → the waiting view.
    if (!words || words.length === 0) {
        return (
            <div className="flex-1 w-full flex flex-col items-center justify-center gap-5 py-10 min-h-[320px] lg:min-h-[440px]">
                <Candle w={30} h={70} frac={frac} />
                <Eyebrow dim={0.42} size={10} style={{ letterSpacing: ".3em" }}>the circle waits</Eyebrow>
                <h2 className="display m-0 text-center" dir="auto" style={{ fontSize: "clamp(28px, 7vw, 46px)", color: "var(--parchment)" }}>
                    {drawerName} is choosing a spell
                </h2>
                <p className="m-0 text-center" style={{ fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 17, color: "var(--gold-bright)" }}>
                    sharpen thy divining fingers
                </p>
                {waitingCount > 0 && (
                    <p className="m-0" style={{ fontWeight: 600, fontSize: 12.5, color: "rgba(242,227,191,.4)" }}>
                        {waitingCount} {waitingCount === 1 ? "wizard is" : "wizards are"} staring at blank vellum
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="flex-1 w-full flex flex-col items-center justify-center gap-8 lg:gap-10 py-6 min-h-[320px] lg:min-h-[440px]">
            <div className="text-center">
                <Eyebrow dim={0.42} size={10} style={{ letterSpacing: ".3em" }}>it is thy turn to conjure</Eyebrow>
                <h2 className="display m-0 mt-3" style={{ fontSize: "clamp(30px, 7vw, 54px)", lineHeight: 0.95, color: "var(--parchment)" }}>
                    Pick a spell <br className="sm:hidden" />to botch
                </h2>
                {secondsLeft != null && (
                    <p className="m-0 mt-2" style={{ fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 16, color: "oklch(0.75 0.15 80)" }}>
                        {secondsLeft} seconds before the grimoire chooses for you
                    </p>
                )}
            </div>

            {/* desktop: a row of tilted cards · mobile: full-width stacked rows */}
            <div className="w-full flex flex-col lg:flex-row gap-3.5 lg:gap-[26px] items-stretch justify-center">
                {words.map((opt, i) => {
                    const s = SPOTS[i % SPOTS.length];
                    const r = RANK[opt.difficulty];
                    const recommended = i === 1;
                    return (
                        <button
                            key={opt.word + i}
                            onClick={() => onChoose(opt.word)}
                            className="grain relative w-full lg:w-[328px] flex flex-row lg:flex-col items-center lg:items-stretch justify-between gap-3 lg:gap-0 text-left lg:text-center cursor-pointer spell-card p-4 lg:p-[30px_24px_26px]"
                            style={{
                                background: s.bg,
                                border: "3px solid var(--ink-warm)",
                                borderRadius: 8,
                                ["--tilt" as string]: `${s.tilt}deg`,
                                ["--lift" as string]: `${s.lift}px`,
                                ["--sh" as string]: s.sh,
                            }}
                        >
                            {s.tape && <Tape w={60} h={28} rotate={-8} top={-16} />}
                            {recommended && <Sticker bg="var(--gold)" rotate={9} style={{ top: -14, right: -12 }}>hot</Sticker>}

                            {/* mobile puts the meta above the word; desktop puts it under */}
                            <span className="flex flex-col-reverse lg:flex-col min-w-0 flex-1 lg:flex-none items-start lg:items-center lg:py-[14px]">
                                <InkEyebrow dim={0.5} size={10} className="mt-1.5 lg:mt-3" style={{ letterSpacing: ".2em" }}>
                                    {r.label} · {opt.points} ✦
                                </InkEyebrow>
                                {/* the one place the display face gives way: a spell has to be
                                    read at a glance, and Grenze's blackletter does not */}
                                <span
                                    className="block w-full lg:w-auto"
                                    dir="auto"
                                    style={{
                                        fontFamily: "var(--font-loud)", fontWeight: 800,
                                        fontSize: "clamp(24px, 5vw, 34px)", lineHeight: 1.1,
                                        color: "var(--ink-warm)", wordBreak: "break-word", overflowWrap: "anywhere",
                                    }}
                                >
                                    {opt.word}
                                </span>
                            </span>

                            <span className="flex flex-none gap-[5px] lg:justify-center lg:mt-4">
                                {[0, 1, 2].map((p) => (
                                    <span
                                        key={p}
                                        style={{
                                            width: 9, height: 9, borderRadius: "50%",
                                            background: p < r.dots ? r.color : "transparent",
                                            boxShadow: `0 0 0 2px ${p < r.dots ? r.color : "rgba(58,47,38,.3)"}`,
                                        }}
                                    />
                                ))}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="flex flex-col items-center gap-2">
                <Btn2 night onClick={onReroll} disabled={rerollsLeft <= 0} size={15} radius="26px 22px 26px 20px" style={{ padding: "11px 26px", opacity: rerollsLeft <= 0 ? 0.4 : 1 }}>
                    let fate decide ⟳
                </Btn2>
                <span style={{ fontWeight: 600, fontSize: 11, color: "rgba(242,227,191,.35)" }}>
                    {rerollsLeft > 0 ? `${rerollsLeft} more offering${rerollsLeft === 1 ? "" : "s"} may be drawn` : "the grimoire offers no more"}
                </span>
            </div>
        </div>
    );
}
