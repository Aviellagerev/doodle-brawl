"use client";
import { useEffect, useState } from "react";
import { WordOption, Difficulty } from "../../../../../packages/shared";

type Props = {
    words: WordOption[] | null;        // room.game.wordOptions (null for non-drawers)
    rerollsLeft: number;               // room.game.rerollsLeft
    onReroll: () => void;              // socket.emit("reroll_words")
    onChoose: (word: string) => void;  // socket.emit("choose_word", { word })
    endsAt: number | null;             // room.game.endsAt (choose deadline)
    totalMs: number;                   // CHOOSE_TIME_MS for the timer-ring denominator
    waitingCount: number;              // guessers waiting = players.length - 1
    drawerName: string;                // current drawer's name (non-drawer view)
};

const hardShadow = (x: number, y: number, c = "var(--outline)") => `${x}px ${y}px 0 ${c}`;
const softLift = "0 14px 30px rgba(58,47,38,.16)";

// Per-position tilt/radius/width/tape — fixed so the layout never jitters on re-render.
// Difficulty-specific treatment (border, RISKY sticker, pips, label colour) is applied
// per option below, independent of position.
const CARDS = [
    { tilt: "lg:-rotate-2", radius: "8px 20px 10px 18px", width: "lg:w-[266px]", tape: "rotate(3deg)" },
    { tilt: "lg:rotate-1 lg:-translate-y-3", radius: "10px 22px 12px 20px", width: "lg:w-[290px]", tape: "rotate(-4deg)" },
    { tilt: "lg:rotate-[2.4deg]", radius: "18px 8px 20px 10px", width: "lg:w-[266px]", tape: "rotate(-2deg)" },
];

const PIP_COLOR: Record<Difficulty, string> = { easy: "var(--lime)", normal: "var(--amber)", hard: "var(--orange)" };
const PIP_FILL: Record<Difficulty, number> = { easy: 1, normal: 2, hard: 3 };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// A few accent circles for the "staring at a blank page" pill (no per-player data here).
const WAIT_DOTS = ["var(--cyan)", "var(--lime)", "var(--orange)", "var(--rose)", "var(--amber)"];

export default function WordPicker({ words, rerollsLeft, onReroll, onChoose, endsAt, totalMs, waitingCount, drawerName }: Props) {
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

    // Server owns the deadline (endsAt); we just count it down for display.
    useEffect(() => {
        if (endsAt == null) {
            setSecondsLeft(null);
            return;
        }
        const tick = () => setSecondsLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [endsAt]);

    const frac = totalMs > 0 && secondsLeft != null ? Math.max(0, Math.min(1, (secondsLeft * 1000) / totalMs)) : 0;
    const low = frac > 0 && frac < 0.2;
    const ringColor = low ? "var(--rose)" : "var(--orange)";
    const pct = frac * 100;

    const waitingPill = (
        <div className="flex items-center gap-2.5 bg-card" style={{ borderRadius: 30, boxShadow: "0 6px 16px rgba(58,47,38,.12)", padding: "8px 16px 8px 10px" }}>
            <span className="flex">
                {Array.from({ length: Math.min(waitingCount, WAIT_DOTS.length) }, (_, i) => (
                    <span key={i} className="grid place-items-center flex-none" style={{ width: 26, height: 26, borderRadius: "50%", background: WAIT_DOTS[i], boxShadow: "0 0 0 2px var(--card)", marginLeft: i === 0 ? 0 : -8 }} />
                ))}
            </span>
            <span className="font-medium text-ink/60" style={{ fontSize: 12.5 }}>
                {waitingCount} {waitingCount === 1 ? "player is" : "players are"} staring at a blank page
            </span>
        </div>
    );

    // Non-drawer / no options yet → waiting view.
    if (!words || words.length === 0) {
        return (
            <div className="flex-1 w-full flex flex-col items-center justify-center gap-6 min-h-[320px] lg:min-h-[460px]">
                <p className="font-loud text-ink text-center" dir="auto" style={{ fontWeight: 800, fontSize: "clamp(24px, 6vw, 40px)", lineHeight: 1.05 }}>
                    {drawerName} is choosing a word…
                </p>
                <p className="font-loud italic text-ink/55 text-center" style={{ fontWeight: 700, fontSize: 18 }}>
                    Sharpen your guessing fingers.
                </p>
                {waitingPill}
            </div>
        );
    }

    return (
        <div className="flex-1 w-full flex flex-col items-center justify-center gap-7 lg:gap-9 min-h-[320px] lg:min-h-[460px]">
            {/* Desktop: a row of tilted cards · Mobile: full-width stacked rows */}
            <div className="w-full flex flex-col lg:flex-row gap-4 lg:gap-[26px] items-stretch lg:items-stretch justify-center">
                {words.map((opt, i) => {
                    const cs = CARDS[i % CARDS.length];
                    const isHard = opt.difficulty === "hard";
                    const accent = PIP_COLOR[opt.difficulty];
                    const wordSize = isHard ? "clamp(26px, 6vw, 42px)" : "clamp(26px, 6vw, 38px)";
                    return (
                        <button
                            key={opt.word + i}
                            onClick={() => onChoose(opt.word)}
                            className={`relative bg-card cursor-pointer w-full ${cs.width} ${cs.tilt} flex flex-row lg:flex-col items-center lg:items-stretch gap-3 lg:gap-0 p-4 lg:p-[26px] text-left lg:text-center`}
                            style={{
                                borderRadius: cs.radius,
                                border: isHard ? "3px solid var(--outline)" : undefined,
                                boxShadow: isHard ? `${hardShadow(7, 8, "var(--orange)")}, 0 16px 34px rgba(58,47,38,.18)` : softLift,
                            }}
                        >
                            {/* tape strip — desktop only, over the top edge */}
                            <span className="tape absolute hidden lg:block" style={{ top: -13, left: "50%", transform: `translateX(-50%) ${cs.tape}`, width: 90, height: 26 }} />

                            {/* RISKY sticker on the hard option */}
                            {isHard && (
                                <span className="absolute font-bold bg-amber text-ink" style={{ top: -14, right: -14, transform: "rotate(9deg)", border: "2.5px solid var(--outline)", borderRadius: 9, boxShadow: hardShadow(3, 3), padding: "4px 9px", fontSize: 11, letterSpacing: ".06em" }}>
                                    RISKY
                                </span>
                            )}

                            {/* text block: label + word. Mobile shows word first (col-reverse), desktop label first */}
                            <span className="flex flex-col-reverse lg:flex-col min-w-0 flex-1 lg:flex-none items-start lg:items-center">
                                <span className="font-mono uppercase" style={{ marginTop: 2, fontWeight: 700, fontSize: 10.5, letterSpacing: ".14em", color: isHard ? "var(--orange)" : "color-mix(in srgb, var(--ink) 40%, transparent)" }}>
                                    {cap(opt.difficulty)} · {opt.points} pts
                                </span>
                                <span className="block font-loud text-ink w-full lg:w-auto" dir="auto" style={{ fontWeight: 800, fontSize: wordSize, lineHeight: 1.05, marginBottom: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                    {opt.word}
                                </span>
                            </span>

                            {/* pips */}
                            <span className="flex flex-none gap-[5px] lg:justify-center lg:mt-4">
                                {[0, 1, 2].map((p) => {
                                    const filled = p < PIP_FILL[opt.difficulty];
                                    return (
                                        <span key={p} style={{ width: 9, height: 9, borderRadius: "50%", background: filled ? accent : "var(--paper)", boxShadow: filled ? "0 0 0 2px var(--outline)" : "0 0 0 2px color-mix(in srgb, var(--ink) 35%, transparent)" }} />
                                    );
                                })}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Reroll + timer */}
            <div className="flex items-center gap-4 lg:gap-[18px] flex-wrap justify-center">
                <button
                    onClick={onReroll}
                    disabled={rerollsLeft <= 0}
                    className="font-loud bg-card text-ink"
                    style={{ border: "2.5px solid var(--outline)", borderRadius: 14, boxShadow: hardShadow(4, 4), padding: "11px 18px", fontWeight: 700, fontSize: 15, cursor: rerollsLeft <= 0 ? "default" : "pointer", opacity: rerollsLeft <= 0 ? 0.45 : 1 }}
                >
                    ↻ Reroll all three ({rerollsLeft} left)
                </button>

                {endsAt != null && secondsLeft != null && (
                    <div className="flex items-center gap-3">
                        <span className="relative grid place-items-center flex-none" style={{ width: 52, height: 52, border: "3px solid var(--outline)", borderRadius: "50%", background: `conic-gradient(${ringColor} 0 ${pct}%, var(--paper) ${pct}% 100%)` }}>
                            <span className="grid place-items-center font-loud" style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--card)", fontWeight: 800, fontSize: 19, color: low ? "var(--rose)" : "var(--ink)" }}>
                                {secondsLeft}
                            </span>
                        </span>
                        <span className="font-loud italic text-ink/55" style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, maxWidth: 180 }}>
                            or we pick for you, coward
                        </span>
                    </div>
                )}
            </div>

            {waitingPill}
        </div>
    );
}
