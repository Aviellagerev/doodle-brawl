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
};

export default function WordBar({ phase, isDrawer, word, wordLength, round, totalRounds, drawerName, endsAt }: Props) {
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);


    useEffect(() => {
        if (phase !== "drawing" || endsAt == null) {
            setSecondsLeft(null);
            return;
        }
        const tick = () => setSecondsLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
        tick();                                 // show immediately, don't wait a second
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [phase, endsAt]);

    function renderWord() {
        if (phase === "choosing") {
            return (
                <span className="text-[#a89984]">
                    {isDrawer ? "Pick a word to draw…" : `${drawerName} is choosing a word…`}
                </span>
            );
        }
        if (phase === "drawing") {
            if (isDrawer) {
                return <span className="text-[#b8bb26] tracking-[0.3em]">{word}</span>;
            }
            const blanks = Array.from({ length: wordLength ?? 0 }, () => "_").join(" ");
            return <span className="text-[#ebdbb2] tracking-[0.3em]">{blanks}</span>;
        }
        if (phase === "scoring") {
            return (
                <span className="text-[#a89984]">
                    The word was: <span className="text-[#b8bb26] font-bold">{word}</span>
                </span>
            );
        }
        return <span className="text-[#7c6f64]">—</span>;
    }

    return (
        <div className="flex items-center justify-between bg-[#3c3836] p-3 rounded border border-[#504945]">
            <span className="text-sm text-[#a89984]">Round {round} / {totalRounds}</span>
            <div className="text-xl font-bold font-mono">{renderWord()}</div>
            <span className="w-16 text-right text-sm font-bold text-[#fabd2f]">
                {secondsLeft !== null ? `${secondsLeft}s` : ""}
            </span>
        </div>
    );
}
