"use client";
import { useEffect, useState, type ReactNode } from "react";
import { RoomState, RoomSettings } from "../../../../packages/shared";
import Avatar, { EmptySeat } from "./Avatar";
import { Card, Eyebrow, InkEyebrow, Btn, Ghost, LeaveGhost, Seg, PickTag, CodeChip } from "./ui/Bits";

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
// the lists that are difficulty tiers rather than subjects, in reading order
const TIERS = ["easy", "medium", "hard"];

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// A seat grows with its column but never taller than the screen can spare.
const SEAT = { maxWidth: "min(100%, 15vh)" } as const;

const INK_NOTE = { fontWeight: 600, fontSize: 11.5, lineHeight: 1.45, color: "rgba(58,47,38,.5)" } as const;

/** 05 · The waiting room. */
export default function Lobby({ room, isHost, wordLists, onLeave, onStart, onUpdateSettings, onOpenHistory, emphasizeCode = false }: LobbyProps) {
    const s = room.settings;
    const set = (patch: Partial<RoomSettings>) => onUpdateSettings({ ...s, ...patch });
    const [moreOpen, setMoreOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [lastBook, setLastBook] = useState(false);   // tried to close the only open grimoire

    useEffect(() => {
        if (!lastBook) return;
        const id = setTimeout(() => setLastBook(false), 2600);
        return () => clearTimeout(id);
    }, [lastBook]);

    const drawSec = Math.round(s.drawTimeMs / 1000);
    const seats = Math.min(s.maxPlayers, 12);
    const emptySlots = Math.max(0, seats - room.players.length);
    const host = room.players.find((p) => p.isHost);
    const canStart = room.players.length >= 2;
    const langs = Object.keys(wordLists).length ? Object.keys(wordLists) : [s.language];

    // ── the grimoires: any number open; [] on the wire means every one ──────
    const books = wordLists[s.language] ?? [];
    const onlyOwn = s.customWordsOnly && s.customWords.length > 0;
    const isOpen = (book: string) => !onlyOwn && (s.lists.length === 0 || s.lists.includes(book));
    const openCount = books.filter(isOpen).length;
    const allOpen = openCount === books.length;
    const shelves = [
        { label: "by difficulty", books: TIERS.filter((b) => books.includes(b)) },
        { label: "by subject", books: books.filter((b) => !TIERS.includes(b)).sort() },
    ].filter((shelf) => shelf.books.length > 0);

    const own = s.customWords.length;
    const ownWords = `${isHost ? "your" : "the host's"} own ${own === 1 ? "word" : `${own} words`}`;

    const toggleBook = (book: string) => {
        // own-words-only has every book shut: opening one brings the grimoires back
        if (onlyOwn) return set({ customWordsOnly: false, lists: [book] });
        const open = books.filter(isOpen);
        const next = open.includes(book) ? open.filter((b) => b !== book) : [...open, book];
        if (next.length === 0) { setLastBook(true); return; }   // a rite needs something to draw from
        set({ lists: next.length === books.length ? [] : next });
    };

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

    const chronicle = onOpenHistory && (
        <Ghost onClick={onOpenHistory} title="your past rites">the chronicle</Ghost>
    );

    return (
        <div className="flex flex-col gap-6">
            {/* header — phones: the title and the way out, then the code and the
                chronicle; wider: all of it on one line */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-3.5 min-w-0">
                    <h2 className="display m-0" style={{ fontSize: 28, color: "var(--parchment)" }}>The waiting room</h2>
                    <span className="hidden sm:inline-flex"><CodeChip code={room.roomId} onCopy={() => copy(room.roomId)} copied={copied} emphasize={emphasizeCode} /></span>
                    <button
                        onClick={copyLink}
                        className="cursor-pointer underline hidden sm:inline"
                        style={{ background: "transparent", border: 0, color: "var(--teal)", fontWeight: 600, fontSize: 12 }}
                    >
                        copy the summoning link
                    </button>
                    <LeaveGhost onLeave={onLeave} className="sm:hidden" />
                </div>
                <div className="flex items-center justify-between gap-3">
                    <span className="sm:hidden flex items-center gap-3">
                        <CodeChip code={room.roomId} onCopy={() => copy(room.roomId)} copied={copied} emphasize={emphasizeCode} />
                        <span style={{ fontWeight: 600, fontSize: 11, color: "rgba(242,227,191,.4)" }}>tap to copy</span>
                    </span>
                    <div className="flex items-center gap-2.5">
                        {chronicle}
                        <LeaveGhost onLeave={onLeave} className="hidden sm:inline-block" />
                    </div>
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

            {/* the rules of the rite — every one of them, in one card — and the ignition */}
            <div className="flex flex-col lg:flex-row gap-4 lg:items-stretch">
                <Card className="flex-1 min-w-0" style={{ padding: "14px 18px 10px" }} tilt={-0.5} radius={16}>
                    <div className="flex items-center justify-between gap-3" style={{ marginBottom: 14 }}>
                        <InkEyebrow dim={0.45} size={10} className="flex-none whitespace-nowrap" style={{ letterSpacing: ".2em" }}>rules of the rite</InkEyebrow>
                        <InkEyebrow dim={1} size={10} className="truncate min-w-0" style={{ color: isHost ? "var(--magenta-ink)" : "rgba(58,47,38,.45)", letterSpacing: ".14em" }}>
                            {isHost ? "yours to set" : `set by ${host?.name ?? "the host"}`}
                        </InkEyebrow>
                    </div>

                    <div className="flex flex-wrap" style={{ gap: "16px 26px" }}>
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

                        <Setting label="Tongue">
                            {isHost ? (
                                <div className="flex gap-[7px] flex-wrap">
                                    {langs.map((lang) => (
                                        // a new tongue has its own books: start with all of them open
                                        <Seg key={lang} active={s.language === lang} onClick={() => set({ language: lang, lists: [] })}>
                                            <span dir="auto" style={{ padding: "0 4px" }}>{LANG_LABEL[lang] ?? lang}</span>
                                        </Seg>
                                    ))}
                                </div>
                            ) : (
                                <Static><span dir="auto">{LANG_LABEL[s.language] ?? s.language}</span></Static>
                            )}
                        </Setting>
                    </div>

                    {/* the grimoires the caster's spells are drawn from — pick any number */}
                    <div style={{ marginTop: 18 }}>
                        <div className="flex items-baseline gap-2 flex-wrap" style={{ marginBottom: 9 }}>
                            <SettingLabel>Grimoires</SettingLabel>
                            <span style={{ fontWeight: 700, fontSize: 11.5, color: "rgba(58,47,38,.45)" }}>
                                {onlyOwn ? "all shut" : allOpen ? "every one open" : `${openCount} of ${books.length} open`}
                            </span>
                        </div>

                        <div className="flex flex-wrap" style={{ gap: "10px 16px" }}>
                            {shelves.map((shelf) => (
                                <div key={shelf.label} className="min-w-0">
                                    <InkEyebrow dim={0.38} size={9} style={{ letterSpacing: ".16em", marginBottom: 7 }}>{shelf.label}</InkEyebrow>
                                    <div className="flex flex-wrap gap-2">
                                        {shelf.books.map((book) => (
                                            <PickTag key={book} on={isOpen(book)} disabled={!isHost} onClick={() => toggleBook(book)}>{book}</PickTag>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <p className="m-0" style={{ ...INK_NOTE, marginTop: 10 }}>
                            {lastBook ? (
                                <span style={{ color: "var(--magenta-ink)" }}>one grimoire has to stay open</span>
                            ) : onlyOwn ? (
                                <>only {ownWords} {own === 1 ? "is" : "are"} in play{isHost && " — open a book to add its spells back"}</>
                            ) : (
                                <>
                                    {isHost && "tap a book to put its spells in or leave them out"}
                                    {isHost && own > 0 && " · "}
                                    {own > 0 && `plus ${ownWords}`}
                                    {isHost && !allOpen && (
                                        <>
                                            {" · "}
                                            <button type="button" onClick={() => set({ lists: [], customWordsOnly: false })} className="cursor-pointer underline" style={{ background: "transparent", border: 0, padding: 0, font: "inherit", color: "var(--magenta-ink)" }}>
                                                open them all
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        </p>
                    </div>

                    {/* the finer print, unfolded in place rather than hidden in a sheet */}
                    <button
                        type="button"
                        onClick={() => setMoreOpen((o) => !o)}
                        aria-expanded={moreOpen}
                        className="w-full flex items-center gap-3 cursor-pointer"
                        style={{ marginTop: 10, minHeight: 38, background: "transparent", border: 0, padding: 0 }}
                    >
                        <span className="flex-1" style={{ borderTop: "2px dashed rgba(58,47,38,.25)" }} />
                        <span style={{ fontFamily: "var(--font-loud)", fontWeight: 800, fontSize: 13, color: "var(--magenta-ink)" }}>
                            {moreOpen ? "fewer rules ▴" : "more rules ▾"}
                        </span>
                        <span className="flex-1" style={{ borderTop: "2px dashed rgba(58,47,38,.25)" }} />
                    </button>

                    {moreOpen && (
                        <div className="flex flex-col gap-4 fade-in" style={{ padding: "8px 0 8px" }}>
                            <StepRow label="Spells offered" display={String(s.wordChoices)} editable={isHost}
                                onDec={() => set({ wordChoices: clamp(s.wordChoices - 1, 1, 5) })}
                                onInc={() => set({ wordChoices: clamp(s.wordChoices + 1, 1, 5) })} />
                            <StepRow label="Letters revealed" display={s.hints === 0 ? "none" : String(s.hints)} editable={isHost}
                                onDec={() => set({ hints: clamp(s.hints - 1, 0, 5) })}
                                onInc={() => set({ hints: clamp(s.hints + 1, 0, 5) })} />
                            <StepRow label="Seats in the circle" display={String(s.maxPlayers)} editable={isHost}
                                onDec={() => set({ maxPlayers: clamp(s.maxPlayers - 1, 2, 20) })}
                                onInc={() => set({ maxPlayers: clamp(s.maxPlayers + 1, 2, 20) })} />

                            {isHost ? (
                                <div>
                                    <div className="flex justify-between items-center gap-3 mb-2">
                                        <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-warm)" }}>Words of thine own</span>
                                        <label className="flex items-center gap-1.5 cursor-pointer" style={{ fontSize: 12, fontWeight: 600, color: "rgba(58,47,38,.6)", minHeight: 32 }}>
                                            <input type="checkbox" checked={s.customWordsOnly}
                                                onChange={(e) => set({ customWordsOnly: e.target.checked })}
                                                style={{ accentColor: "var(--magenta)", width: 16, height: 16 }} />
                                            only these
                                        </label>
                                    </div>
                                    <textarea
                                        key={s.customWords.join("|")}
                                        dir="auto"
                                        defaultValue={s.customWords.join(", ")}
                                        onBlur={(e) => set({ customWords: e.target.value.split(/[,\n]/).map((w) => w.trim()).filter(Boolean) })}
                                        placeholder="toad, haunted kettle, astral plumber…"
                                        rows={2}
                                        // 16px on phones: iOS zooms into any smaller field
                                        className="w-full outline-none text-base sm:text-[12.5px]"
                                        style={{
                                            border: "2.5px dashed rgba(58,47,38,.35)", borderRadius: 10, background: "var(--parchment-bright)",
                                            color: "var(--ink-warm)", padding: "9px 11px", resize: "vertical",
                                        }}
                                    />
                                    <p className="m-0 mt-1.5" style={{ fontSize: 10.5, color: "rgba(58,47,38,.45)" }}>
                                        comma or newline separated · saved when you look away{s.customWordsOnly && s.customWords.length === 0 && " · with none written, the grimoires stand in"}
                                    </p>
                                </div>
                            ) : (
                                // the words themselves stay the host's: a short list of them
                                // would be a list of answers
                                <div className="flex justify-between items-center" style={{ borderBottom: "2px dashed rgba(58,47,38,.22)", paddingBottom: 9 }}>
                                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-warm)" }}>Words of the host&apos;s own</span>
                                    <b className="display" style={{ fontSize: 19, color: "var(--ink-warm)" }}>{s.customWords.length || "none"}</b>
                                </div>
                            )}
                        </div>
                    )}
                </Card>

                {/* on phones the ignition floats at the bottom while the host scrolls
                    the rules — only once it can be pressed: its disabled state is a
                    see-through outline, and would hover over the card */}
                <div className={`w-full lg:w-[280px] flex-none flex flex-col justify-center gap-2.5 z-10 ${isHost && canStart ? "sticky bottom-3 lg:static" : ""}`}>
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
                    {/* …and when it floats, its note stays behind rather than trail across the card */}
                    <span className={`text-center ${isHost && canStart ? "hidden lg:block" : ""}`} style={{ fontWeight: 600, fontSize: 11.5, color: "rgba(242,227,191,.4)" }}>
                        {!canStart
                            ? "a rite of one is merely drawing"
                            : isHost
                                ? "the candle is yours to light"
                                : `only ${host?.name ?? "the host"} may light the candle`}
                    </span>
                </div>
            </div>
        </div>
    );
}

function SettingLabel({ children }: { children: ReactNode }) {
    return (
        <span style={{ fontFamily: "var(--font-loud)", fontWeight: 700, fontSize: 13, color: "rgba(58,47,38,.6)" }}>
            {children}
        </span>
    );
}

function Setting({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <div style={{ marginBottom: 7 }}><SettingLabel>{label}</SettingLabel></div>
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
                {editable && <StepBtn onClick={onDec} label={`fewer ${label.toLowerCase()}`}>−</StepBtn>}
                <b className="display text-center" style={{ fontSize: 19, minWidth: 44, color: "var(--ink-warm)" }}>{display}</b>
                {editable && <StepBtn onClick={onInc} label={`more ${label.toLowerCase()}`}>+</StepBtn>}
            </span>
        </div>
    );
}

function StepBtn({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="grid place-items-center cursor-pointer"
            style={{ width: 36, height: 36, border: "2.5px solid var(--ink-warm)", borderRadius: 10, background: "var(--parchment-bright)", color: "var(--ink-warm)", fontSize: 15, fontWeight: 700 }}
        >
            {children}
        </button>
    );
}
