"use client";
import { useEffect, useState } from "react";
import { GamePhase } from "../../../../../packages/shared";

type Props = {
    phase: GamePhase;
    isDrawer: boolean;
    word: string | null;
    wordLength: number | null;
    hint: string[] | null;   // per-letter reveal for guessers ("" hidden, " " space, else letter)
    round: number;
    totalRounds: number;
    drawerName: string;
    endsAt: number | null;
    totalMs: number;
    onLeave: () => void;
};

const hardShadow = (x: number, y: number) => ({ boxShadow: `${x}px ${y}px 0 var(--outline)` });

export default function WordBar({ phase, isDrawer, word, wordLength, hint, round, totalRounds, drawerName, endsAt, totalMs, onLeave }: Props) {
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

    // Desktop middle — the full word / hint block centered in the header row.
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
                            <span dir="auto">{word?.toUpperCase()}</span>
                            <span className="ml-3 font-bold text-ink/45" style={{ fontSize: 13 }}>{wordLength} letters</span>
                        </span>
                    ) : (
                        <span className="inline-flex items-end gap-1.5 flex-wrap justify-center max-w-full" dir="auto">
                            {(hint ?? Array.from({ length: wordLength ?? 0 }, () => "")).map((ch, i) => (
                                ch === " "
                                    ? <span key={i} style={{ width: "clamp(6px, 2vw, 12px)" }} />
                                    : <span key={i} className="font-loud text-center text-ink" style={{ fontSize: "clamp(20px, 6vw, 34px)", lineHeight: 1, width: "clamp(15px, 5vw, 24px)", borderBottom: "4px solid color-mix(in srgb, var(--ink) 30%, transparent)" }}>{ch || " "}</span>
                            ))}
                            <span className="ml-2 font-bold text-ink/45" style={{ fontSize: 12 }}>{hint ? hint.filter((c) => c !== " ").length : wordLength} letters</span>
                        </span>
                    )}
                </div>
            );
        }
        if (phase === "scoring") {
            return (
                <span className="font-loud" style={{ fontWeight: 700, fontSize: 22 }}>
                    <span className="text-ink/55">The word was </span>
                    <span className="text-orange" dir="auto" style={{ fontWeight: 800 }}>{word}</span>
                </span>
            );
        }
        return null;
    }

    // Mobile compact label — the mono-caps line that sits centered in the header row.
    function renderMobileLabel() {
        const text =
            phase === "choosing" ? (isDrawer ? "Pick a word" : `${drawerName} is choosing`) :
                phase === "drawing" ? (isDrawer ? "You are drawing" : `${drawerName} is drawing`) :
                    phase === "scoring" ? "The word was" : "";
        return (
            <div className="font-mono uppercase text-ink/45 truncate" style={{ fontWeight: 700, fontSize: 10, letterSpacing: ".14em" }}>
                {text}
            </div>
        );
    }

    // Mobile word row — its own line under the header so the length/hint is always
    // visible (drawing phase only). ~26px letters in 20px slots per frame #1i.
    function renderMobileWord() {
        if (isDrawer) {
            return (
                <div className="flex justify-center items-baseline gap-2 flex-wrap" dir="auto">
                    <span className="font-loud text-ink" style={{ fontWeight: 800, fontSize: 26, letterSpacing: ".04em", lineHeight: 1 }}>{word}</span>
                    <span className="font-bold text-ink/45" style={{ fontSize: 11 }}>{wordLength} letters</span>
                </div>
            );
        }
        const cells = hint ?? Array.from({ length: wordLength ?? 0 }, () => "");
        return (
            <div className="flex justify-center items-end gap-[5px] flex-wrap" dir="auto">
                {cells.map((ch, i) => (
                    ch === " "
                        ? <span key={i} style={{ width: 8 }} />
                        : <span key={i} className="font-loud text-center text-ink" style={{ fontSize: 26, lineHeight: 1, width: 20, borderBottom: ch ? "3.5px solid var(--outline)" : "3.5px solid color-mix(in srgb, var(--ink) 30%, transparent)" }}>{ch || " "}</span>
                ))}
                <span className="ml-1 font-bold text-ink/45" style={{ fontSize: 11 }}>{cells.filter((c) => c !== " ").length} letters</span>
            </div>
        );
    }

    // Timer ring at a given size (62px desktop, 44px mobile).
    function ring(size: number, inner: number, font: number) {
        if (endsAt == null || secondsLeft == null) return null;
        return (
            <span className="relative grid place-items-center flex-none" style={{ width: size, height: size, border: "3px solid var(--outline)", borderRadius: "50%", background: `conic-gradient(${ringColor} 0 ${frac * 100}%, var(--card) ${frac * 100}% 100%)`, ...hardShadow(3, 3) }}>
                <span className="grid place-items-center font-loud" style={{ width: inner, height: inner, borderRadius: "50%", background: "var(--card)", fontWeight: 800, fontSize: font, color: low ? "var(--rose)" : "var(--ink)" }}>
                    {secondsLeft ?? "–"}
                </span>
            </span>
        );
    }

    const leaveBtn = (
        <button onClick={onLeave} className="font-bold cursor-pointer bg-card text-rose flex-none" style={{ border: "2.5px solid var(--outline)", borderRadius: 12, ...hardShadow(3, 3), padding: "9px 13px", fontSize: 12 }}>
            <span className="hidden sm:inline">Leave game</span>
            <span className="sm:hidden">✕</span>
        </button>
    );

    const roundChip = (
        <span className="tape font-loud flex-none" style={{ border: "2.5px solid var(--outline)", borderRadius: 11, ...hardShadow(3, 3), padding: "7px 12px", fontWeight: 700, fontSize: 12, letterSpacing: ".05em", background: "var(--card)", transform: "rotate(-1.5deg)" }}>
            <span className="hidden sm:inline">Round {round} / {totalRounds}</span>
            <span className="sm:hidden">R{round}/{totalRounds}</span>
        </span>
    );

    return (
        <div className="space-y-3 lg:space-y-0">
            {/* header row */}
            <div className="flex items-center gap-3 lg:gap-4">
                {roundChip}

                <div className="flex-1 min-w-0 text-center">
                    <div className="hidden lg:block">{renderMiddle()}</div>
                    <div className="lg:hidden">{renderMobileLabel()}</div>
                </div>

                <div className="flex items-center gap-2 lg:gap-3 flex-none">
                    <span className="lg:hidden">{ring(44, 30, 15)}</span>
                    <span className="hidden lg:inline-grid">{ring(62, 46, 21)}</span>
                    {leaveBtn}
                </div>
            </div>

            {/* mobile-only word row — keeps the masked word / length on screen with the chat */}
            {phase === "drawing" && <div className="lg:hidden">{renderMobileWord()}</div>}
        </div>
    );
}
