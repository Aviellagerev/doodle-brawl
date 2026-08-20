"use client";
import { useEffect, useState } from "react";
import { GamePhase } from "../../../../../packages/shared";

type Props = {
    phase: GamePhase;
    isDrawer: boolean;
    word: string | null;
    wordLength: number | null;
    round: number;
    totalRounds: number;
    drawerName: string;
    endsAt: number | null;
    totalMs: number;
    onLeave: () => void;
};

const hardShadow = (x: number, y: number) => ({ boxShadow: `${x}px ${y}px 0 var(--outline)` });

export default function WordBar({ phase, isDrawer, word, wordLength, round, totalRounds, drawerName, endsAt, totalMs, onLeave }: Props) {
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

    // Live countdown for whatever phase is timed (choosing / drawing / scoring).
    // The server owns the deadline (endsAt); we just display it.
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
    const low = secondsLeft != null && secondsLeft <= Math.max(5, Math.round((totalMs / 1000) * 0.2));
    const ringColor = low ? "var(--rose)" : "var(--orange)";

    function renderMiddle() {
        if (phase === "choosing") {
            return (
                <span className="font-loud italic text-ink/55" style={{ fontWeight: 700, fontSize: 22 }}>
                    {isDrawer ? "Pick a word to draw…" : `${drawerName} is choosing a word…`}
                </span>
            );
        }
        if (phase === "drawing") {
            return (
                <div>
                    <div className="font-mono uppercase text-ink/45 mb-1" style={{ fontWeight: 700, fontSize: 10, letterSpacing: ".16em" }}>
                        {isDrawer ? "You are drawing" : `${drawerName} is drawing`}
                    </div>
                    {isDrawer ? (
                        <span className="font-loud" style={{ fontWeight: 800, fontSize: "clamp(20px, 6vw, 34px)", letterSpacing: ".06em" }}>
                            {word?.toUpperCase()}
                            <span className="ml-3 font-bold text-ink/45" style={{ fontSize: 13 }}>{wordLength} letters</span>
                        </span>
                    ) : (
                        <span className="inline-flex items-end gap-1.5 flex-wrap justify-center max-w-full">
                            {Array.from({ length: wordLength ?? 0 }).map((_, i) => (
                                <span key={i} className="font-loud text-center" style={{ fontSize: "clamp(20px, 6vw, 34px)", lineHeight: 1, width: "clamp(15px, 5vw, 24px)", borderBottom: "4px solid color-mix(in srgb, var(--ink) 30%, transparent)" }}>&nbsp;</span>
                            ))}
                            <span className="ml-2 font-bold text-ink/45" style={{ fontSize: 12 }}>{wordLength} letters</span>
                        </span>
                    )}
                </div>
            );
        }
        if (phase === "scoring") {
            return (
                <span className="font-loud" style={{ fontWeight: 700, fontSize: 22 }}>
                    <span className="text-ink/55">The word was </span>
                    <span className="text-orange" style={{ fontWeight: 800 }}>{word}</span>
                </span>
            );
        }
        return null;
    }

    return (
        <div className="flex items-center gap-4 flex-wrap">
            <span className="tape font-loud flex-none" style={{ border: "2.5px solid var(--outline)", borderRadius: 11, ...hardShadow(3, 3), padding: "7px 12px", fontWeight: 700, fontSize: 12, letterSpacing: ".05em", background: "var(--card)", transform: "rotate(-1.5deg)" }}>
                Round {round} / {totalRounds}
            </span>

            <div className="flex-1 min-w-0 text-center">{renderMiddle()}</div>

            <div className="flex items-center gap-3 flex-none">
                {endsAt != null && secondsLeft != null && (
                    <span className="relative grid place-items-center flex-none" style={{ width: 62, height: 62, border: "3px solid var(--outline)", borderRadius: "50%", background: `conic-gradient(${ringColor} 0 ${frac * 100}%, var(--card) ${frac * 100}% 100%)`, ...hardShadow(3, 3) }}>
                        <span className="grid place-items-center font-loud" style={{ width: 46, height: 46, borderRadius: "50%", background: "var(--card)", fontWeight: 800, fontSize: 21, color: low ? "var(--rose)" : "var(--ink)" }}>
                            {secondsLeft ?? "–"}
                        </span>
                    </span>
                )}
                <button onClick={onLeave} className="font-bold cursor-pointer bg-card text-rose" style={{ border: "2.5px solid var(--outline)", borderRadius: 12, ...hardShadow(3, 3), padding: "9px 13px", fontSize: 12 }}>
                    Leave game
                </button>
            </div>
        </div>
    );
}
