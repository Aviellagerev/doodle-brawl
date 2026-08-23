"use client";
import { useEffect, useState } from "react";
import { RoomState, GameState, Player, ChatMessage, CHOOSE_TIME_MS, SCORING_DELAY_MS } from "../../../../../packages/shared";
import WordBar from "./WordBar";
import PlayerList from "./PlayerList";
import WordPicker from "./WordPicker";
import DrawingBoard from "./DrawingBoard";
import Chat from "./Chat";
import Avatar from "../Avatar";
import { Socket } from "socket.io-client";

type Props = {
    room: RoomState;
    myPlayerId: string;
    onChooseWord: (word: string) => void;
    socket: Socket | null;
    onLeave: () => void;
    // guess feed — the chat lives inside the game shell so word + chat stay co-visible on mobile
    messages: ChatMessage[];
    onSend: (text: string) => void;
};

const hardShadow = (x: number, y: number) => ({ boxShadow: `${x}px ${y}px 0 var(--outline)` });

export default function GameScreen({ room, myPlayerId, onChooseWord, socket, onLeave, messages, onSend }: Props) {
    const game = room.game;
    if (!game) return null; // no game yet — render nothing

    const isDrawer = game.currentDrawerId === myPlayerId;
    const drawerName =
        room.players.find((p) => p.id === game.currentDrawerId)?.name ?? "Someone";
    const waitingCount = Math.max(0, room.players.length - 1);

    const onReroll = () => socket?.emit("reroll_words");

    // total duration of the current phase, for the timer-ring fraction
    const totalMs =
        game.phase === "choosing" ? CHOOSE_TIME_MS :
            game.phase === "drawing" ? room.settings.drawTimeMs :
                game.phase === "scoring" ? SCORING_DELAY_MS : 0;

    // A slim top bar (round chip + leave) for the full-frame choosing screen —
    // WordPicker owns its own timer / waiting pill, so we don't duplicate it here.
    const slimBar = (
        <div className="flex items-center justify-between gap-3">
            <span className="tape font-loud flex-none" style={{ border: "2.5px solid var(--outline)", borderRadius: 11, ...hardShadow(3, 3), padding: "7px 12px", fontWeight: 700, fontSize: 12, letterSpacing: ".05em", background: "var(--card)", transform: "rotate(-1.5deg)" }}>
                <span className="hidden sm:inline">Round {game.round} / {room.settings.rounds}</span>
                <span className="sm:hidden">R{game.round}/{room.settings.rounds}</span>
            </span>
            <button onClick={onLeave} className="font-bold cursor-pointer bg-card text-rose flex-none" style={{ border: "2.5px solid var(--outline)", borderRadius: 12, ...hardShadow(3, 3), padding: "9px 13px", fontSize: 12 }}>
                <span className="hidden sm:inline">Leave game</span>
                <span className="sm:hidden">✕</span>
            </button>
        </div>
    );

    // ── CHOOSING — full-frame word picker (drawer) / waiting view (guesser) ──
    if (game.phase === "choosing") {
        return (
            <div className="flex flex-col min-h-[100dvh] lg:min-h-0 p-4 lg:max-w-6xl lg:mx-auto lg:p-6">
                {slimBar}
                <div className="flex-1 flex items-stretch justify-center mt-2">
                    <WordPicker
                        words={isDrawer ? (game.wordOptions ?? []) : null}
                        rerollsLeft={game.rerollsLeft}
                        onReroll={onReroll}
                        onChoose={onChooseWord}
                        endsAt={game.endsAt}
                        totalMs={CHOOSE_TIME_MS}
                        waitingCount={waitingCount}
                        drawerName={drawerName}
                    />
                </div>
            </div>
        );
    }

    const wordBar = (
        <WordBar
            phase={game.phase}
            isDrawer={isDrawer}
            word={game.word}
            wordLength={game.wordLength}
            hint={game.hint}
            round={game.round}
            totalRounds={room.settings.rounds}
            drawerName={drawerName}
            endsAt={game.endsAt}
            totalMs={totalMs}
            onLeave={onLeave}
        />
    );

    // ── SCORING fallback — no payout data → the plain reveal card (defensive:
    // at scoring the finalized payout always carries at least the drawer entry). ──
    if (game.phase === "scoring" && (!game.payout || game.payout.length === 0)) {
        return (
            <div className="p-4 lg:max-w-6xl lg:mx-auto lg:p-6 space-y-4">
                {wordBar}
                <div className="grid place-items-center bg-card min-h-[320px] lg:min-h-[460px]" style={{ border: "3px solid var(--outline)", borderRadius: 6 }}>
                    <div className="text-center px-4">
                        <div className="font-mono uppercase text-ink/45 mb-2" style={{ fontWeight: 700, fontSize: 11, letterSpacing: ".16em" }}>The word was</div>
                        <div className="font-loud text-ink mb-3" dir="auto" style={{ fontWeight: 800, fontSize: "clamp(34px, 9vw, 52px)" }}>{game.word}</div>
                        <div className="font-loud italic text-ink/50" style={{ fontWeight: 700, fontSize: 15 }}>next drawer coming up…</div>
                    </div>
                </div>
            </div>
        );
    }

    // ── DRAWING + SCORING — one shell so the <DrawingBoard> keeps the SAME keyed
    // position across the phase flip. React preserves the canvas instance, so the
    // finished strokes stay on screen behind the round-over reveal (frame #1f).
    // Mobile drawing: a fitted 100dvh column (word · canvas · players · guesses,
    // input pinned). Desktop drawing: WordBar + 3-column shell (214 · flex · 284),
    // viewport-bounded so the guess input is always visible. Scoring: the canvas
    // with the reveal overlay on the left, the "Round N payout" panel on the right.
    const scoring = game.phase === "scoring";
    const drawing = game.phase === "drawing";

    // best-effort next drawer: the next player in join order who hasn't drawn this
    // round. Unknown at the round boundary → we omit the name (per the handoff).
    const nextDrawerName = (() => {
        const order = room.players;
        const curIdx = order.findIndex((p) => p.id === game.currentDrawerId);
        if (curIdx < 0) return null;
        const drawn = game.drawnThisRound ?? [];
        for (let i = 1; i <= order.length; i++) {
            const cand = order[(curIdx + i) % order.length];
            if (cand.id === game.currentDrawerId) break;
            if (!drawn.includes(cand.id)) return cand.name;
        }
        return null;
    })();

    return (
        <div
            className={
                drawing
                    ? "flex flex-col h-[100dvh] lg:overflow-hidden p-3 lg:max-w-6xl lg:mx-auto lg:p-6"
                    : "flex flex-col min-h-[100dvh] p-4 lg:p-6 lg:max-w-6xl lg:mx-auto"
            }
        >
            {drawing && <div key="wordbar" className="flex-none">{wordBar}</div>}

            <div
                key="row"
                className={
                    drawing
                        ? "flex-1 min-h-0 flex flex-col lg:flex-row gap-3 lg:gap-4 lg:items-start mt-3 lg:mt-4"
                        : "flex-1 flex flex-col lg:flex-row gap-4 lg:gap-6 lg:items-center lg:justify-center"
                }
            >
                {/* players — after the canvas on mobile, left column on desktop (drawing only) */}
                {drawing && (
                    <div key="players" className="order-2 lg:order-1 flex-none w-full lg:w-[214px]">
                        <PlayerList players={room.players} currentDrawerId={game.currentDrawerId} guessedIds={game.guessedIds} myPlayerId={myPlayerId} />
                    </div>
                )}

                {/* canvas column — stable keyed subtree so the canvas survives the
                    drawing → scoring flip and the strokes stay painted behind the reveal */}
                <div
                    key="canvas"
                    className={
                        drawing
                            ? "order-1 lg:order-2 flex-none lg:flex-1 min-w-0 w-full flex"
                            : "order-1 w-full lg:w-[600px] lg:flex-none flex flex-col items-center gap-4"
                    }
                >
                    <div className={drawing ? "flex-1 min-w-0 w-full flex" : "relative w-full"}>
                        <DrawingBoard key={`${game.currentDrawerId}-${game.round}`} isDrawer={scoring ? false : isDrawer} socket={socket} />

                        {scoring && (
                            <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(58,47,38,.14)", borderRadius: 6 }}>
                                <div className="relative text-center" style={{ transform: "rotate(-2deg)", background: "var(--card)", border: "3px solid var(--outline)", borderRadius: "10px 22px 12px 20px", boxShadow: "7px 8px 0 var(--lime)", padding: "22px 34px", maxWidth: "88%" }}>
                                    <span className="tape" style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%) rotate(4deg)", width: 100, height: 28 }} />
                                    <div className="font-mono uppercase text-ink/45" style={{ margin: "8px 0 4px", fontWeight: 700, fontSize: 10.5, letterSpacing: ".16em" }}>The word was</div>
                                    <div className="font-loud text-ink" dir="auto" style={{ fontWeight: 800, fontSize: "clamp(30px, 7vw, 52px)", lineHeight: 1.05 }}>{game.word}</div>
                                    <div className="font-loud italic text-ink/55" style={{ marginTop: 6, fontWeight: 700, fontSize: 15 }}>
                                        drawn, generously, by <span dir="auto">{drawerName}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {scoring && (
                        <div className="flex items-center gap-3 flex-wrap justify-center">
                            {nextDrawerName && (
                                <span className="font-bold text-ink" style={{ border: "2.5px solid var(--outline)", borderRadius: 12, background: "var(--card)", ...hardShadow(3, 3), padding: "9px 14px", fontSize: 12.5 }}>
                                    Next up: <b className="font-loud" dir="auto" style={{ fontWeight: 800 }}>{nextDrawerName}</b>
                                </span>
                            )}
                            <span className="flex items-center gap-2 font-loud italic text-ink/55" style={{ fontWeight: 700, fontSize: 14 }}>
                                <ScoringRing endsAt={game.endsAt} />
                                starting in a sec
                            </span>
                        </div>
                    )}
                </div>

                {/* right column — the guess feed while drawing, the payout panel while scoring */}
                {drawing ? (
                    <Chat key="chat" variant="fill" title="Guesses" messages={messages} onSend={onSend} inputDisabled={isDrawer} />
                ) : (
                    <PayoutPanel key="payout" game={game} players={room.players} />
                )}
            </div>
        </div>
    );
}

// The scoring-phase countdown ring under the canvas — cyan, driven by the
// server deadline (game.endsAt) over the fixed SCORING_DELAY_MS window.
function ScoringRing({ endsAt }: { endsAt: number | null }) {
    const [secs, setSecs] = useState<number | null>(null);
    useEffect(() => {
        if (endsAt == null) { setSecs(null); return; }
        const tick = () => setSecs(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [endsAt]);
    const frac = endsAt != null && secs != null ? Math.max(0, Math.min(1, (secs * 1000) / SCORING_DELAY_MS)) : 0;
    return (
        <span className="relative grid place-items-center flex-none" style={{ width: 40, height: 40, border: "3px solid var(--outline)", borderRadius: "50%", background: `conic-gradient(var(--cyan) 0 ${frac * 100}%, var(--card) ${frac * 100}% 100%)` }}>
            <span className="grid place-items-center font-loud text-ink" style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--paper-deep)", fontWeight: 800, fontSize: 15 }}>
                {secs ?? "–"}
            </span>
        </span>
    );
}

// The "Round N payout" panel (frame #1f) — one row per PayoutEntry, sorted by the
// per-turn delta, the top earner highlighted, the room leader pinned in the footer.
function PayoutPanel({ game, players }: { game: GameState; players: Player[] }) {
    const payout = game.payout ?? [];
    const rows = [...payout].sort((a, b) => b.points - a.points);
    const guesserCount = payout.filter((e) => e.note === "first to guess" || e.note === "guessed it").length;
    const totalGuessers = Math.max(0, players.length - 1);
    const leader = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
    const limeInk = "color-mix(in srgb, var(--ink) 42%, var(--lime))";
    const zeroInk = "color-mix(in srgb, var(--ink) 40%, transparent)";

    return (
        <div
            key="payout-card"
            className="order-2 w-full lg:w-[400px] lg:flex-none bg-card"
            style={{ transform: "rotate(1deg)", borderRadius: "20px 8px 22px 8px", boxShadow: "0 8px 20px rgba(58,47,38,.12)", padding: "24px 24px 20px" }}
        >
            <div className="flex justify-between items-baseline" style={{ marginBottom: 16 }}>
                <span className="font-loud text-ink" style={{ fontWeight: 800, fontSize: 24 }}>Round {game.round} payout</span>
                <span className="font-mono uppercase text-ink/45" style={{ fontWeight: 700, fontSize: 10.5, letterSpacing: ".12em" }}>{guesserCount} of {totalGuessers} done</span>
            </div>

            <div className="flex flex-col" style={{ gap: 10 }}>
                {rows.map((entry, i) => {
                    const player = players.find((p) => p.id === entry.playerId);
                    const name = player?.name ?? "Someone";
                    const positive = entry.points > 0;
                    const highlight = i === 0 && positive;
                    return (
                        <div
                            key={`${entry.playerId}-${i}`}
                            className="flex items-center"
                            style={{
                                gap: 11,
                                borderRadius: 13,
                                padding: "9px 11px",
                                opacity: positive ? 1 : 0.6,
                                ...(highlight
                                    ? { border: "2.5px solid var(--outline)", background: "color-mix(in srgb, var(--lime) 28%, transparent)", boxShadow: "3px 3px 0 var(--outline)" }
                                    : {}),
                            }}
                        >
                            <Avatar name={name} size={34} />
                            <span className="min-w-0 flex-1">
                                <span className="block font-bold truncate" dir="auto" style={{ fontSize: 13.5 }}>{name}</span>
                                <span className="block font-semibold text-ink/50" style={{ fontSize: 10.5 }}>{entry.note}</span>
                            </span>
                            <span className="font-loud flex-none" style={{ fontWeight: 800, fontSize: highlight ? 21 : 19, color: positive ? limeInk : zeroInk }}>
                                +{entry.points}
                            </span>
                        </div>
                    );
                })}
            </div>

            {leader && (
                <div className="flex justify-between items-center" style={{ marginTop: 16, paddingTop: 13, borderTop: "2px dotted color-mix(in srgb, var(--ink) 25%, transparent)" }}>
                    <span className="font-mono uppercase text-ink/45" style={{ fontWeight: 700, fontSize: 11, letterSpacing: ".12em" }}>Leader</span>
                    <span className="flex items-center gap-2 font-bold" style={{ fontSize: 13 }}>
                        <span dir="auto">{leader.name}</span>
                        <span className="font-loud" style={{ fontWeight: 800, fontSize: 16 }}>{(leader.score ?? 0).toLocaleString()}</span>
                    </span>
                </div>
            )}
        </div>
    );
}
