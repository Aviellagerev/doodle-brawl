"use client";
import { useState, type ReactNode } from "react";
import { RoomState, RoomSettings } from "../../../../packages/shared";
import Avatar from "./Avatar";
import ThemeToggle from "./ThemeToggle";

type LobbyProps = {
    room: RoomState;
    isHost: boolean;
    wordLists: Record<string, string[]>;  // available lists per language, from the server
    onLeave: () => void;
    onStart: () => void;
    onUpdateSettings: (settings: RoomSettings) => void;
};

const LANG_LABEL: Record<string, string> = { en: "English", he: "עברית" };

const hardShadow = (x: number, y: number) => ({ boxShadow: `${x}px ${y}px 0 var(--outline)` });
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const tilt = (name: string) => (name.charCodeAt(0) % 9) - 4; // stable ±4° per name

export default function Lobby({ room, isHost, wordLists, onLeave, onStart, onUpdateSettings }: LobbyProps) {
    const s = room.settings;
    const set = (patch: Partial<RoomSettings>) => onUpdateSettings({ ...s, ...patch });
    const [open, setOpen] = useState(false); // mobile: settings collapsed by default
    const [copied, setCopied] = useState(false);
    const emptySlots = Math.max(0, Math.min(s.maxPlayers, 12) - room.players.length);
    const soloish = room.players.length <= 1; // "just you in here" — nudge to invite

    const copyInvite = async () => {
        try {
            const link = typeof window !== "undefined" ? `${window.location.origin}/?room=${room.roomId}` : room.roomId;
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch {
            setCopied(false);
        }
    };

    // word-list controls. lists === [] means "all lists for this language".
    const langs = Object.keys(wordLists).length ? Object.keys(wordLists) : [s.language];
    const allLists = wordLists[s.language] ?? [];
    const listEnabled = (l: string) => s.lists.length === 0 || s.lists.includes(l);
    const toggleList = (l: string) => {
        const cur = s.lists.length === 0 ? [...allLists] : [...s.lists];
        let next: string[];
        if (cur.includes(l)) {
            if (cur.length <= 1) return;                 // keep at least one list on
            next = cur.filter((x) => x !== l);
        } else {
            next = [...cur, l];
        }
        set({ lists: next.length >= allLists.length ? [] : next });  // all on → back to []
    };

    return (
        <div className="space-y-5">
            {/* header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-baseline gap-3.5 flex-wrap">
                    <span className="font-loud" style={{ fontWeight: 800, fontSize: 27 }}>The waiting room</span>
                    <span className="tape font-loud" style={{ border: "2.5px solid var(--outline)", borderRadius: 11, ...hardShadow(3, 3), padding: "6px 13px", fontWeight: 800, fontSize: 16, letterSpacing: ".2em", transform: "rotate(-1.5deg)" }}>{room.roomId}</span>
                </div>
                <div className="flex gap-2.5">
                    <ThemeToggle />
                    <button onClick={onLeave} className="font-bold cursor-pointer bg-card text-rose" style={{ border: "2.5px solid var(--outline)", borderRadius: 12, ...hardShadow(3, 3), padding: "8px 13px", fontSize: 12 }}>Leave room</button>
                </div>
            </div>

            {/* body */}
            <div className="flex gap-4 items-start flex-wrap">
                <div className="flex-1 min-w-[280px] flex flex-col gap-4">
                    {/* "just you in here" — nudge the host to invite a friend (#1h lobby-of-one) */}
                    {soloish && (
                        <div
                            className="flex items-center justify-between gap-3 flex-wrap bg-card"
                            style={{ border: "3px dashed color-mix(in srgb, var(--ink) 40%, transparent)", borderRadius: "14px 8px 14px 8px", padding: "12px 16px" }}
                        >
                            <div className="min-w-0">
                                <div className="font-loud" style={{ fontWeight: 800, fontSize: 16 }}>Just you in here</div>
                                <div className="text-ink/55" style={{ fontSize: 12, fontWeight: 600 }}>A one-player brawl is called drawing — send the code to a friend.</div>
                            </div>
                            <div className="flex items-center gap-2.5 flex-none">
                                <span className="font-loud text-ink" dir="auto" style={{ border: "2.5px solid var(--outline)", borderRadius: 12, background: "var(--tape)", ...hardShadow(3, 3), padding: "8px 13px", fontWeight: 800, fontSize: 15, letterSpacing: ".18em" }}>{room.roomId}</span>
                                <button onClick={copyInvite} className="font-loud text-card cursor-pointer bg-orange" style={{ border: "2.5px solid var(--outline)", borderRadius: 12, ...hardShadow(3, 3), padding: "9px 14px", fontWeight: 700, fontSize: 13 }}>
                                    {copied ? "Copied!" : "Copy invite"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* player grid */}
                    <div className="bg-card" style={{ borderRadius: "8px 22px 10px 20px", boxShadow: "0 10px 24px rgba(58,47,38,.14)", padding: 22 }}>
                        <div className="flex justify-between items-baseline mb-4 flex-wrap gap-2">
                            <span className="font-mono uppercase text-ink/45" style={{ fontWeight: 700, fontSize: 11, letterSpacing: ".12em" }}>Who&apos;s here — {room.players.length} / {s.maxPlayers}</span>
                            <span className="font-loud italic text-ink/50" style={{ fontWeight: 700, fontSize: 13 }}>waiting on the host…</span>
                        </div>
                        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(54px, 1fr))" }}>
                            {room.players.map((p) => (
                                <div key={p.id} className="flex flex-col items-center gap-1.5">
                                    <div className="relative">
                                        <Avatar name={p.name} size={54} ring rotate={tilt(p.name)} />
                                        {p.isHost && (
                                            <span className="absolute font-bold" style={{ top: -12, left: "50%", transform: "translateX(-50%) rotate(-7deg)", border: "2px solid var(--outline)", borderRadius: 7, background: "var(--amber)", color: "var(--ink)", ...hardShadow(2, 2), padding: "1px 6px", fontSize: 9, letterSpacing: ".08em" }}>HOST</span>
                                        )}
                                    </div>
                                    <span className="font-bold text-center truncate max-w-full" style={{ fontSize: 12 }}>{p.name}</span>
                                </div>
                            ))}
                            {Array.from({ length: emptySlots }).map((_, i) => (
                                <div key={`e${i}`} className="grid place-items-center" style={{ width: 54, height: 54, borderRadius: "50%", border: "3px dashed color-mix(in srgb, var(--ink) 22%, transparent)", color: "color-mix(in srgb, var(--ink) 16%, transparent)", fontSize: 22, fontWeight: 600 }}>+</div>
                            ))}
                        </div>
                    </div>

                    {isHost && (
                        <button onClick={onStart} className="font-loud text-card cursor-pointer bg-orange" style={{ border: "3px solid var(--outline)", borderRadius: "34px 30px 34px 30px", ...hardShadow(6, 7), padding: "20px 0", fontWeight: 800, fontSize: 30 }}>Start the chaos →</button>
                    )}
                </div>

                {/* settings */}
                <div className="w-full lg:w-[300px] flex-none bg-card" style={{ borderRadius: "20px 8px 22px 8px", boxShadow: "0 10px 24px rgba(58,47,38,.14)", padding: "14px 16px" }}>
                    <button onClick={() => setOpen((v) => !v)} className="w-full flex justify-between items-center mb-2.5 lg:cursor-default cursor-pointer">
                        <span className="font-mono uppercase text-ink/45" style={{ fontWeight: 700, fontSize: 11, letterSpacing: ".12em" }}>Room settings</span>
                        {/* mobile: quick summary + chevron · desktop: host-only label */}
                        <span className="lg:hidden flex items-center gap-2 text-ink/50" style={{ fontSize: 11, fontWeight: 600 }}>
                            {s.rounds} rounds · {Math.round(s.drawTimeMs / 1000)}s
                            <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
                        </span>
                        <span className="hidden lg:inline text-ink/40" style={{ fontWeight: 600, fontSize: 10 }}>{isHost ? "host only" : "view only"}</span>
                    </button>
                    <div className={`flex-col gap-2 ${open ? "flex" : "hidden"} lg:flex`}>
                        <Row label="Rounds" display={String(s.rounds)} editable={isHost}
                            onDec={() => set({ rounds: clamp(s.rounds - 1, 1, 10) })}
                            onInc={() => set({ rounds: clamp(s.rounds + 1, 1, 10) })} />
                        <Row label="Draw time" display={`${Math.round(s.drawTimeMs / 1000)}s`} editable={isHost}
                            onDec={() => set({ drawTimeMs: clamp(Math.round(s.drawTimeMs / 1000) - 10, 15, 300) * 1000 })}
                            onInc={() => set({ drawTimeMs: clamp(Math.round(s.drawTimeMs / 1000) + 10, 15, 300) * 1000 })} />
                        <Row label="Word choices" display={String(s.wordChoices)} editable={isHost}
                            onDec={() => set({ wordChoices: clamp(s.wordChoices - 1, 1, 5) })}
                            onInc={() => set({ wordChoices: clamp(s.wordChoices + 1, 1, 5) })} />
                        <Row label="Hints" display={s.hints === 0 ? "off" : String(s.hints)} editable={isHost}
                            onDec={() => set({ hints: clamp(s.hints - 1, 0, 5) })}
                            onInc={() => set({ hints: clamp(s.hints + 1, 0, 5) })} />
                        <Row label="Max players" display={String(s.maxPlayers)} editable={isHost}
                            onDec={() => set({ maxPlayers: clamp(s.maxPlayers - 1, 2, 20) })}
                            onInc={() => set({ maxPlayers: clamp(s.maxPlayers + 1, 2, 20) })} />

                        {/* language */}
                        <div className="flex justify-between items-center border-b-2 border-dotted border-ink/20 pb-[7px]">
                            <span style={{ fontWeight: 600, fontSize: 13 }}>Language</span>
                            <span className="flex gap-1.5">
                                {langs.map((lang) => (
                                    <Chip key={lang} active={s.language === lang} disabled={!isHost}
                                        onClick={() => set({ language: lang, lists: [] })}>
                                        {LANG_LABEL[lang] ?? lang}
                                    </Chip>
                                ))}
                            </span>
                        </div>

                        {/* word lists */}
                        <div className="border-b-2 border-dotted border-ink/20 pb-2">
                            <div className="flex justify-between items-center mb-1.5">
                                <span style={{ fontWeight: 600, fontSize: 13 }}>Word lists</span>
                                <span className="text-ink/40" style={{ fontSize: 10, fontWeight: 600 }}>
                                    {s.lists.length === 0 ? "all on" : `${s.lists.length}/${allLists.length}`}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {allLists.map((l) => (
                                    <Chip key={l} active={listEnabled(l)} disabled={!isHost} onClick={() => toggleList(l)}>
                                        {l}
                                    </Chip>
                                ))}
                            </div>
                        </div>

                        {/* custom words */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <span style={{ fontWeight: 600, fontSize: 13 }}>Custom words</span>
                                <label className="flex items-center gap-1.5 text-ink/55 cursor-pointer" style={{ fontSize: 11 }}>
                                    <input type="checkbox" disabled={!isHost} checked={s.customWordsOnly}
                                        onChange={(e) => set({ customWordsOnly: e.target.checked })} />
                                    only these
                                </label>
                            </div>
                            <textarea
                                key={s.customWords.join("|")}
                                disabled={!isHost}
                                defaultValue={s.customWords.join(", ")}
                                onBlur={(e) => set({ customWords: e.target.value.split(/[,\n]/).map((w) => w.trim()).filter(Boolean) })}
                                placeholder="apple, house, banana…"
                                rows={2}
                                className="w-full paper-bg text-ink outline-none disabled:opacity-70"
                                style={{ border: "2px dashed color-mix(in srgb, var(--ink) 30%, transparent)", borderRadius: 10, padding: "8px 10px", fontSize: 12, resize: "vertical" }}
                            />
                            {isHost && <p className="text-ink/40 mt-1" style={{ fontSize: 10 }}>comma or newline separated · saves when you click away</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Row({ label, display, editable, onDec, onInc, last }: {
    label: string; display: string; editable: boolean; onDec: () => void; onInc: () => void; last?: boolean;
}) {
    return (
        <div className={`flex justify-between items-center ${last ? "" : "border-b-2 border-dotted border-ink/20 pb-[7px]"}`}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
            <span className="flex items-center gap-2.5">
                {editable && <StepBtn onClick={onDec}>−</StepBtn>}
                <b className="font-loud text-center" style={{ fontWeight: 800, fontSize: 17, minWidth: 40 }}>{display}</b>
                {editable && <StepBtn onClick={onInc}>+</StepBtn>}
            </span>
        </div>
    );
}

// A toggle pill — used for both language and word-list selection.
function Chip({ active, disabled, onClick, children }: {
    active: boolean; disabled?: boolean; onClick: () => void; children: ReactNode;
}) {
    return (
        <button
            dir="auto"
            disabled={disabled}
            onClick={onClick}
            className="font-bold enabled:cursor-pointer disabled:opacity-70"
            style={{
                border: "2px solid var(--outline)", borderRadius: 9, padding: "3px 9px", fontSize: 11,
                background: active ? "var(--lime)" : "var(--paper)",
                color: "var(--ink)", opacity: active ? 1 : 0.55,
            }}
        >
            {children}
        </button>
    );
}

function StepBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
    return (
        <button onClick={onClick} className="grid place-items-center paper-bg cursor-pointer font-bold text-ink" style={{ width: 24, height: 24, border: "2.5px solid var(--outline)", borderRadius: 8, fontSize: 13 }}>
            {children}
        </button>
    );
}
