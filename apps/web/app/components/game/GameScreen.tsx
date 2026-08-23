import { RoomState, ChatMessage, CHOOSE_TIME_MS, SCORING_DELAY_MS } from "../../../../../packages/shared";
import WordBar from "./WordBar";
import PlayerList from "./PlayerList";
import WordPicker from "./WordPicker";
import DrawingBoard from "./DrawingBoard";
import Chat from "./Chat";
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

    // ── SCORING — full-frame reveal ──
    if (game.phase === "scoring") {
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

    // ── DRAWING (default) — the game shell ──
    // Mobile: a fitted 100dvh column so the word (header), canvas, player strip AND
    // the guess feed are all visible at once, input pinned. Desktop: WordBar on top,
    // then the 3-column shell (players 214 · canvas flex · guesses 284).
    return (
        <div className="flex flex-col h-[100dvh] lg:h-auto p-3 lg:max-w-6xl lg:mx-auto lg:p-6">
            <div className="flex-none">{wordBar}</div>

            <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 lg:gap-4 lg:items-start mt-3 lg:mt-4">
                {/* players — after the canvas on mobile, left column on desktop */}
                <div className="order-2 lg:order-1 flex-none w-full lg:w-[214px]">
                    <PlayerList players={room.players} currentDrawerId={game.currentDrawerId} guessedIds={game.guessedIds} myPlayerId={myPlayerId} />
                </div>

                {/* canvas / drawing board — first on mobile, middle on desktop */}
                <div className="order-1 lg:order-2 flex-none lg:flex-1 min-w-0 w-full flex">
                    <DrawingBoard key={`${game.currentDrawerId}-${game.round}`} isDrawer={isDrawer} socket={socket} />
                </div>

                {/* guess feed — fills the rest on mobile (input pinned), 284 sidebar on desktop */}
                <Chat variant="fill" title="Guesses" messages={messages} onSend={onSend} inputDisabled={isDrawer} />
            </div>
        </div>
    );
}
