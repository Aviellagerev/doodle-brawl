"use client";
import { useState, type ReactNode } from "react";
import { RoomState, RoomSettings } from "../../../../packages/shared";
import Avatar, { EmptySeat } from "./Avatar";
import { Card, Eyebrow, InkEyebrow, Btn, Ghost, Seg, CodeChip } from "./ui/Bits";

type LobbyProps = {
    room: RoomState;
    isHost: boolean;
    wordLists: Record<string, string[]>;  // available lists per language, from the server
    onLeave: () => void;
    onStart: () => void;
    onUpdateSettings: (settings: RoomSettings) => void;
    onOpenHistory?: () => void;
    /** set when the room was made via "summon a private circle" */
    emphasizeCode?: boolean;
};

const LANG_LABEL: Record<string, string> = { en: "English", he: "עברית" };
const ROUND_CHOICES = [3, 5, 8];
const CANDLE_CHOICES = [30, 60, 90];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// A seat grows with its column but never taller than the screen can spare.
const SEAT = { maxWidth: "min(100%, 15vh)" } as const;

/** 05 · The waiting room. */
export default function Lobby({ room, isHost, wordLists, onLeave, onStart, onUpdateSettings, onOpenHistory, emphasizeCode = false }: LobbyProps) {
    const s = room.settings;
    const set = (patch: Partial<RoomSettings>) => onUpdateSettings({ ...s, ...patch });
    const [moreOpen, setMoreOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const drawSec = Math.round(s.drawTimeMs / 1000);
    const seats = Math.min(s.maxPlayers, 12);
    const emptySlots = Math.max(0, seats - room.players.length);
    const host = room.players.find((p) => p.isHost);
    const canStart = room.players.length >= 2;

    const allLists = wordLists[s.language] ?? [];
    const langs = Object.keys(wordLists).length ? Object.keys(wordLists) : [s.language];
    const grimoire = s.lists.length === 1 ? s.lists[0] : "";

    const copy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
        } catch { setCopied(false); }
    };
    const copyLink = () => copy(typeof window !== "undefined" ? `${window.location.origin}/?room=${room.roomId}` : room.roomId);

    // rounds / candle keep their arbitrary values: an off-menu number joins the row
    const roundCells = ROUND_CHOICES.includes(s.rounds) ? ROUND_CHOICES : [...ROUND_CHOICES, s.rounds].sort((a, b) => a - b);
    const candleCells = CANDLE_CHOICES.includes(drawSec) ? CANDLE_CHOICES : [...CANDLE_CHOICES, drawSec].sort((a, b) => a - b);

    return (
        <div className="flex flex-col gap-6">
            {/* header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3.5 flex-wrap min-w-0">
                    <h2 className="display m-0" style={{ fontSize: 28, color: "var(--parchment)" }}>The waiting room</h2>
                    <CodeChip code={room.roomId} onCopy={() => copy(room.roomId)} copied={copied} emphasize={emphasizeCode} />
                    <button
                        onClick={copyLink}
                        className="cursor-pointer underline hidden sm:inline"
                        style={{ background: "transparent", border: 0, color: "var(--teal)", fontWeight: 600, fontSize: 12 }}
                    >
                        copy the summoning link
                    </button>
                    <span className="sm:hidden" style={{ fontWeight: 600, fontSize: 11, color: "rgba(242,227,191,.4)" }}>tap to copy</span>
                </div>
                <div className="flex items-center gap-2.5">
                    <Ghost onClick={() => setMoreOpen(true)} disabled={!isHost} title={isHost ? "the rest of the rules" : "only the host may tune the rite"}>
                        ⚙<span className="hidden sm:inline ml-1.5">host settings</span>
                    </Ghost>
                    {onOpenHistory && (
                        <Ghost onClick={onOpenHistory} title="the chronicle" style={{ minWidth: 44, padding: "0 12px" }}>📜</Ghost>
                    )}
                    <Ghost onClick={onLeave}>leave</Ghost>
                </div>
            </div>

            {/* the coven */}
            <div>
                <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
                    <Eyebrow dim={0.5} size={10}>the coven · {room.players.length}/{seats}</Eyebrow>
                    <span style={{ fontWeight: 600, fontSize: 12, color: "rgba(242,227,191,.45)" }}>
                        {emptySlots === 0 ? "the circle is closed" : `${emptySlots} more may yet appear`}
                    </span>
                </div>

                {/* seats are fluid, but capped against the viewport height so the
                    two rows and the rules card still fit a 1080p screen */}
                <div className="grid grid-cols-4" style={{ gap: "14px 10px" }}>
                    {room.players.map((p) => (
                        <div key={p.id} className="flex flex-col items-center gap-2 min-w-0 mx-auto w-full" style={SEAT}>
                            <Avatar name={p.name} avatar={p.avatar} size="fill" host={p.isHost} />
                            <span
                                className="truncate max-w-full text-center"
                                dir="auto"
                                style={{ fontFamily: "var(--font-loud)", fontWeight: 800, fontSize: 11, color: "var(--parchment)" }}
                            >
                                {p.name}{p.isHost && <span style={{ color: "var(--gold-bright)" }}> · host</span>}
                            </span>
                        </div>
                    ))}
                    {Array.from({ length: emptySlots }).map((_, i) => (
                        <div key={`e${i}`} className="flex flex-col items-center gap-2 mx-auto w-full" style={SEAT}>
                            {i === 0 ? (
                                <button onClick={copyLink} className="w-full cursor-pointer" title="copy the summoning link" style={{ background: "transparent", border: 0, padding: 0 }}>
                                    <EmptySeat size="fill" invite />
                                </button>
                            ) : (
                                <EmptySeat size="fill" />
                            )}
                            {i === 0 && <span style={{ fontWeight: 600, fontSize: 10, color: "rgba(242,227,191,.4)" }}>invite</span>}
                        </div>
                    ))}
                </div>
            </div>

            {/* the rules of the rite + the ignition */}
            <div className="flex flex-col lg:flex-row gap-4 lg:items-stretch">
                <Card className="flex-1" style={{ padding: "14px 18px 13px" }} tilt={-0.5} radius={16}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
                        <InkEyebrow dim={0.45} size={10} style={{ letterSpacing: ".2em" }}>rules of the rite</InkEyebrow>
                        {isHost && <InkEyebrow dim={1} size={10} style={{ color: "var(--magenta-ink)", letterSpacing: ".14em" }}>host only ⚙</InkEyebrow>}
                    </div>

                    <div className="flex flex-wrap" style={{ gap: 26 }}>
                        <Setting label="Rounds">
                            {isHost ? (
                                <div className="flex gap-[7px] flex-wrap">
                                    {roundCells.map((n) => (
                                        <Seg key={n} active={s.rounds === n} onClick={() => set({ rounds: clamp(n, 1, 10) })}>{n}</Seg>
                                    ))}
                                </div>
                            ) : (
                                <Static>{s.rounds}</Static>
                            )}
                        </Setting>

                        <Setting label="Candle">
                            {isHost ? (
                                <div className="flex gap-[7px] flex-wrap">
                                    {candleCells.map((n) => (
                                        <Seg key={n} tone="gold" wide active={drawSec === n} onClick={() => set({ drawTimeMs: clamp(n, 15, 300) * 1000 })}>{n}s</Seg>
                                    ))}
                                </div>
                            ) : (
                                <Static>{drawSec}s</Static>
                            )}
                        </Setting>

                        <Setting label="Grimoire">
                            {isHost ? (
                                <select
                                    value={grimoire}
                                    onChange={(e) => set({ lists: e.target.value ? [e.target.value] : [] })}
                                    className="w-full cursor-pointer"
                                    style={{
                                        border: "2.5px solid var(--ink-warm)", borderRadius: 10, background: "var(--parchment-bright)",
                                        color: "var(--ink-warm)", padding: "8px 10px", fontSize: 13, fontWeight: 700, minHeight: 38,
                                    }}
                                >
                                    <option value="">Every grimoire</option>
                                    {allLists.map((l) => <option key={l} value={l}>{l}</option>)}
                                </select>
                            ) : (
                                <Static>{grimoire || "every grimoire"}</Static>
                            )}
                        </Setting>
                    </div>
                </Card>

                <div className="w-full lg:w-[280px] flex-none flex flex-col justify-center gap-2.5 sticky bottom-3 lg:static z-10">
                    <Btn
                        tone="gold"
                        className="w-full"
                        size={28}
                        radius="34px 28px 32px 30px"
                        style={{ minHeight: 64 }}
                        disabled={!isHost || !canStart}
                        onClick={onStart}
                    >
                        {isHost ? "BEGIN THE RITE" : "WAITING FOR THE HOST"}
                    </Btn>
                    <span className="text-center" style={{ fontWeight: 600, fontSize: 11.5, color: "rgba(242,227,191,.4)" }}>
                        {!canStart
                            ? "a rite of one is merely drawing"
                            : isHost
                                ? "the candle is yours to light"
                                : `only ${host?.name ?? "the host"} may light the candle`}
                    </span>
                </div>
            </div>

            {/* the rest of the rules — a sheet, so the card above stays the design's three */}
            {moreOpen && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center fade-in">
                    <div className="absolute inset-0" style={{ background: "rgba(13,7,24,.7)" }} onClick={() => setMoreOpen(false)} />
                    <Card
                        className="relative w-full sm:max-w-[520px] p-5 sm:p-6"
                        tilt={0}
                        radius="22px 22px 0 0"
                        style={{ maxHeight: "85vh", overflowY: "auto" }}
                        animate={false}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <InkEyebrow dim={0.5} size={10}>the rest of the rules{isHost ? "" : " · watching only"}</InkEyebrow>
                            <Btn tone="magenta" size={15} radius="12px 14px 12px 14px" style={{ minHeight: 38, padding: "0 16px", boxShadow: "3px 3px 0 var(--ink-warm)" }} onClick={() => setMoreOpen(false)}>
                                DONE
                            </Btn>
                        </div>

                        <div className="flex flex-col gap-4">
                            <StepRow label="Spells offered" display={String(s.wordChoices)} editable={isHost}
                                onDec={() => set({ wordChoices: clamp(s.wordChoices - 1, 1, 5) })}
                                onInc={() => set({ wordChoices: clamp(s.wordChoices + 1, 1, 5) })} />
                            <StepRow label="Letters revealed" display={s.hints === 0 ? "none" : String(s.hints)} editable={isHost}
                                onDec={() => set({ hints: clamp(s.hints - 1, 0, 5) })}
                                onInc={() => set({ hints: clamp(s.hints + 1, 0, 5) })} />
                            <StepRow label="Seats in the circle" display={String(s.maxPlayers)} editable={isHost}
                                onDec={() => set({ maxPlayers: clamp(s.maxPlayers - 1, 2, 20) })}
                                onInc={() => set({ maxPlayers: clamp(s.maxPlayers + 1, 2, 20) })} />

                            <div className="flex justify-between items-center" style={{ borderBottom: "2px dashed rgba(58,47,38,.22)", paddingBottom: 9 }}>
                                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-warm)" }}>Tongue</span>
                                <span className="flex gap-[7px]">
                                    {langs.map((lang) => (
                                        <Seg key={lang} compact active={s.language === lang} disabled={!isHost} onClick={() => set({ language: lang, lists: [] })}>
                                            {LANG_LABEL[lang] ?? lang}
                                        </Seg>
                                    ))}
                                </span>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-warm)" }}>Words of thine own</span>
                                    <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: 11, color: "rgba(58,47,38,.55)" }}>
                                        <input type="checkbox" disabled={!isHost} checked={s.customWordsOnly}
                                            onChange={(e) => set({ customWordsOnly: e.target.checked })} style={{ accentColor: "var(--magenta)" }} />
                                        only these
                                    </label>
                                </div>
                                <textarea
                                    key={s.customWords.join("|")}
                                    dir="auto"
                                    disabled={!isHost}
                                    defaultValue={s.customWords.join(", ")}
                                    onBlur={(e) => set({ customWords: e.target.value.split(/[,\n]/).map((w) => w.trim()).filter(Boolean) })}
                                    placeholder="toad, haunted kettle, astral plumber…"
                                    rows={2}
                                    className="w-full outline-none disabled:opacity-70"
                                    style={{
                                        border: "2.5px dashed rgba(58,47,38,.35)", borderRadius: 10, background: "var(--parchment-bright)",
                                        color: "var(--ink-warm)", padding: "9px 11px", fontSize: 12.5, resize: "vertical",
                                    }}
                                />
                                {isHost && <p className="m-0 mt-1.5" style={{ fontSize: 10, color: "rgba(58,47,38,.45)" }}>comma or newline separated · saved when you look away</p>}
                            </div>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}

function Setting({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <div style={{ fontFamily: "var(--font-loud)", fontWeight: 700, fontSize: 13, color: "rgba(58,47,38,.6)", marginBottom: 7 }}>
                {label}
            </div>
            {children}
        </div>
    );
}

function Static({ children }: { children: ReactNode }) {
    return (
        <span className="display" style={{ fontSize: 22, color: "var(--ink-warm)" }}>{children}</span>
    );
}

function StepRow({ label, display, editable, onDec, onInc }: {
    label: string; display: string; editable: boolean; onDec: () => void; onInc: () => void;
}) {
    return (
        <div className="flex justify-between items-center" style={{ borderBottom: "2px dashed rgba(58,47,38,.22)", paddingBottom: 9 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-warm)" }}>{label}</span>
            <span className="flex items-center gap-3">
                {editable && <StepBtn onClick={onDec}>−</StepBtn>}
                <b className="display text-center" style={{ fontSize: 19, minWidth: 44, color: "var(--ink-warm)" }}>{display}</b>
                {editable && <StepBtn onClick={onInc}>+</StepBtn>}
            </span>
        </div>
    );
}

function StepBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
    return (
        <button
            onClick={onClick}
            className="grid place-items-center cursor-pointer"
            style={{ width: 30, height: 30, border: "2.5px solid var(--ink-warm)", borderRadius: 9, background: "var(--parchment-bright)", color: "var(--ink-warm)", fontSize: 14, fontWeight: 700 }}
        >
            {children}
        </button>
    );
}
