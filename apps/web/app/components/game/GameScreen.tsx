"use client";
import { RoomState, GameState, Player, ChatMessage, CHOOSE_TIME_MS, SCORING_DELAY_MS } from "../../../../../packages/shared";
import WordBar from "./WordBar";
import PlayerList from "./PlayerList";
import WordPicker from "./WordPicker";
import DrawingBoard from "./DrawingBoard";
import Chat from "./Chat";
import Avatar from "../Avatar";
import { Night, Eyebrow, InkEyebrow, Ghost, Card, CodeChipNight } from "../ui/Bits";

import { CandleTimer } from "../ui/Candle";

import { Socket } from "socket.io-client";

type Props = {
    room: RoomState;
    myPlayerId: string;
    onChooseWord: (word: string) => void;
    socket: Socket | null;
    onLeave: () => void;
    messages: ChatMessage[];
    onSend: (text: string) => void;
};

export default function GameScreen({ room, myPlayerId, onChooseWord, socket, onLeave, messages, onSend }: Props) {
    const game = room.game;
    if (!game) return null;

    const isDrawer = game.currentDrawerId === myPlayerId;
    const drawerName = room.players.find((p) => p.id === game.currentDrawerId)?.name ?? "Someone";
    const waitingCount = Math.max(0, room.players.length - 1);

    const onReroll = () => socket?.emit("reroll_words");

    const totalMs =
        game.phase === "choosing" ? CHOOSE_TIME_MS :
            game.phase === "drawing" ? room.settings.drawTimeMs :
                game.phase === "scoring" ? SCORING_DELAY_MS : 0;

    // ── CHOOSING — the caster picks; everyone else waits ──────────────────────
    if (game.phase === "choosing") {
        return (
            <Night className="flex flex-col p-4 pt-9 lg:p-6 lg:pt-11" glow="rgba(255,214,140,.15)" x="50%" y="8%">
                <div className="w-full lg:max-w-[1240px] lg:mx-auto flex flex-col flex-1">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-baseline gap-3.5 min-w-0">
                            <span className="display flex-none" style={{ fontSize: "clamp(18px, 4.5vw, 26px)", color: "var(--parchment)" }}>
                                Round {game.round} of {room.settings.rounds}
                            </span>
                            <span className="hidden sm:inline-flex"><CodeChipNight code={room.roomId} /></span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="hidden sm:block text-right" style={{ fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 12, lineHeight: 1.25, color: "rgba(242,227,191,.45)" }}>
                                the candle<br />is watching
                            </span>
                            <CandleTimer endsAt={game.endsAt} totalMs={CHOOSE_TIME_MS} w={30} h={64} numeral={false} />
                            <Ghost onClick={onLeave} style={{ minWidth: 44, padding: "0 12px" }}>
                                <span className="hidden sm:inline">leave</span>
                                <span className="sm:hidden">✕</span>
                            </Ghost>
                        </div>
                    </div>

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
            </Night>
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

    const scoring = game.phase === "scoring";
    const drawing = game.phase === "drawing";

    // best-effort next caster: the next player in join order who hasn't drawn yet
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

    // ── SCORING fallback — no payout data → the bare reveal ───────────────────
    if (scoring && (!game.payout || game.payout.length === 0)) {
        return (
            <Night className="grid place-items-center p-5" glow="rgba(255,196,90,.28)" x="50%" y="44%">
                <div className="text-center flex flex-col items-center">
                    <CandleTimer endsAt={game.endsAt} totalMs={SCORING_DELAY_MS} w={46} h={118} numeral={false} />
                    <Eyebrow dim={0.45} size={11} className="mt-7" style={{ letterSpacing: ".34em" }}>the spell is spent</Eyebrow>
                    <h2 className="display m-0 mt-3" dir="auto" style={{ fontSize: "clamp(34px, 9vw, 64px)", color: "var(--parchment)" }}>{game.word}</h2>
                    <p className="m-0 mt-2.5" style={{ fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 18, color: "var(--gold-bright)" }}>
                        {nextDrawerName ? `${nextDrawerName} takes the wand` : "the candle is relit"}
                    </p>
                </div>
            </Night>
        );
    }

    return (
        <Night
            className={
                drawing
                    ? "flex flex-col h-[100dvh] lg:overflow-hidden p-3 lg:p-6"
                    : "flex flex-col p-4 lg:p-6"
            }
            glow={scoring ? "rgba(255,196,90,.24)" : "rgba(255,214,140,.13)"}
            x="50%"
            y={scoring ? "36%" : "0%"}
        >
            <div className={`w-full lg:max-w-[1240px] lg:mx-auto flex flex-col flex-1 min-h-0 ${drawing ? "" : "justify-center"}`}>
                {drawing && <div key="wordbar" className="flex-none">{wordBar}</div>}

                <div
                    key="row"
                    className={
                        drawing
                            ? "flex-1 min-h-0 flex flex-col lg:flex-row gap-3 lg:gap-4 lg:items-stretch mt-3 lg:mt-4"
                            : "flex-1 flex flex-col lg:flex-row gap-6 lg:gap-8 lg:items-center lg:justify-center py-4"
                    }
                >
                    {/* the coven — under the canvas on phones, left column on desktop */}
                    {drawing && (
                        <div key="players" className="order-2 lg:order-1 flex-none w-full lg:w-[212px]">
                            <PlayerList players={room.players} currentDrawerId={game.currentDrawerId} guessedIds={game.guessedIds} myPlayerId={myPlayerId} />
                        </div>
                    )}

                    {/* the vellum — one keyed subtree, so the strokes survive the phase flip */}
                    <div
                        key="canvas"
                        className={
                            drawing
                                ? "order-1 lg:order-2 flex-none lg:flex-1 min-w-0 w-full flex"
                                : "order-1 w-full lg:w-[560px] lg:flex-none flex flex-col items-center gap-5"
                        }
                    >
                        <div className={drawing ? "flex-1 min-w-0 w-full flex" : "relative w-full"}>
                            <DrawingBoard key={`${game.currentDrawerId}-${game.round}`} isDrawer={scoring ? false : isDrawer} socket={socket} fill={drawing} />

                            {scoring && (
                                <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(13,7,24,.35)", borderRadius: 10 }}>
                                    <Card className="relative text-center px-8 py-6 max-w-[88%]" tilt={-2} radius="12px 8px 14px 10px" shadow="6px 7px 0 var(--magenta)">
                                        <InkEyebrow dim={0.45} size={10} style={{ letterSpacing: ".2em" }}>the spell was</InkEyebrow>
                                        <div className="display mt-2" dir="auto" style={{ fontSize: "clamp(30px, 7vw, 48px)", color: "var(--ink-warm)" }}>{game.word}</div>
                                        <div className="mt-2" style={{ fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 14, color: "rgba(58,47,38,.55)" }}>
                                            cast, generously, by <span dir="auto">{drawerName}</span>
                                        </div>
                                    </Card>
                                </div>
                            )}
                        </div>

                        {scoring && (
                            <div className="flex flex-col items-center gap-3">
                                <RoundTracker round={game.round} total={room.settings.rounds} />
                                <div className="flex items-center gap-3">
                                    <CandleTimer endsAt={game.endsAt} totalMs={SCORING_DELAY_MS} w={18} h={40} numeral={24} />
                                    <span style={{ fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 15, color: "var(--gold-bright)" }}>
                                        {nextDrawerName ? `${nextDrawerName} takes the wand` : "the candle is relit"}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* right — the murmurings while drawing, the reckoning while scoring */}
                    {drawing ? (
                        <Chat
                            key="chat"
                            variant="fill"
                            title="the murmurings"
                            messages={messages}
                            onSend={onSend}
                            players={room.players}
                            inputDisabled={isDrawer}
                        />
                    ) : (
                        <PayoutPanel key="payout" game={game} players={room.players} />
                    )}
                </div>
            </div>
        </Night>
    );
}

/** The five-segment round tracker from the between-rounds beat. */
function RoundTracker({ round, total }: { round: number; total: number }) {
    return (
        <div className="flex gap-2">
            {Array.from({ length: total }, (_, i) => (
                <span
                    key={i}
                    style={{
                        width: 36, height: 8, borderRadius: 4,
                        background: i + 1 < round ? "var(--gold)" : i + 1 === round ? "var(--parchment)" : "rgba(242,227,191,.22)",
                    }}
                />
            ))}
        </div>
    );
}

/** The reckoning — one row per payout entry, the top earner marked. */
function PayoutPanel({ game, players }: { game: GameState; players: Player[] }) {
    const payout = game.payout ?? [];
    const rows = [...payout].sort((a, b) => b.points - a.points);
    const guesserCount = payout.filter((e) => e.note === "first to guess" || e.note === "guessed it").length;
    const totalGuessers = Math.max(0, players.length - 1);
    const leader = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];

    return (
        <Card
            key="payout-card"
            className="order-2 w-full lg:w-[360px] lg:flex-none p-6"
            tilt={1}
            radius="18px 12px 20px 14px"
        >
            <div className="flex justify-between items-baseline mb-4">
                <span className="display" style={{ fontSize: 26, color: "var(--ink-warm)" }}>The reckoning</span>
                <InkEyebrow dim={0.45} size={10}>{guesserCount} of {totalGuessers} divined</InkEyebrow>
            </div>

            <div className="flex flex-col gap-2.5">
                {rows.map((entry, i) => {
                    const pIdx = players.findIndex((p) => p.id === entry.playerId);
                    const player = players[pIdx];
                    const name = player?.name ?? "Someone";
                    const positive = entry.points > 0;
                    const top = i === 0 && positive;
                    return (
                        <div
                            key={`${entry.playerId}-${i}`}
                            className="flex items-center gap-3"
                            style={{
                                borderRadius: 12,
                                padding: "9px 11px",
                                opacity: positive ? 1 : 0.55,
                                ...(top
                                    ? { border: "2.5px solid var(--ink-warm)", background: "rgba(255,255,255,.35)", boxShadow: "3px 3px 0 var(--ink-warm)" }
                                    : {}),
                            }}
                        >
                            <Avatar name={name} avatar={player?.avatar} size={34} surface="parchment" />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate" dir="auto" style={{ fontFamily: "var(--font-loud)", fontWeight: 800, fontSize: 13.5, color: "var(--ink-warm)" }}>{name}</span>
                                <span className="block" style={{ fontWeight: 600, fontSize: 10.5, color: "rgba(58,47,38,.5)" }}>{entry.note}</span>
                            </span>
                            <span className="display flex-none" style={{ fontSize: top ? 22 : 19, color: positive ? "var(--magenta-ink)" : "rgba(58,47,38,.4)" }}>
                                +{entry.points} ✦
                            </span>
                        </div>
                    );
                })}
            </div>

            {leader && (
                <div className="flex justify-between items-center mt-4 pt-3.5" style={{ borderTop: "2px dashed rgba(58,47,38,.25)" }}>
                    <InkEyebrow dim={0.45} size={10}>ahead of the coven</InkEyebrow>
                    <span className="flex items-center gap-2.5" style={{ fontWeight: 700, fontSize: 13, color: "var(--ink-warm)" }}>
                        <span dir="auto" style={{ fontFamily: "var(--font-loud)", fontWeight: 800 }}>{leader.name}</span>
                        <span className="display" style={{ fontSize: 18, color: "var(--magenta-ink)" }}>{(leader.score ?? 0).toLocaleString()}</span>
                    </span>
                </div>
            )}
        </Card>
    );
}
