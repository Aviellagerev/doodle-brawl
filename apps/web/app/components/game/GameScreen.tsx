import { RoomState, CHOOSE_TIME_MS, SCORING_DELAY_MS } from "../../../../../packages/shared";
import WordBar from "./WordBar";
import PlayerList from "./PlayerList";
import WordPicker from "./WordPicker";
import DrawingBoard from "./DrawingBoard";
import { Socket } from "socket.io-client";

type Props = {
    room: RoomState;
    myPlayerId: string;
    onChooseWord: (word: string) => void;
    socket: Socket | null;
    onLeave: () => void;
};

export default function GameScreen({ room, myPlayerId, onChooseWord, socket, onLeave }: Props) {
    const game = room.game;
    if (!game) return null; // no game yet — render nothing

    const isDrawer = game.currentDrawerId === myPlayerId;
    const drawerName =
        room.players.find((p) => p.id === game.currentDrawerId)?.name ?? "Someone";
    const words = game.wordOptions ?? []; // only the drawer receives these (redacted)

    // total duration of the current phase, for the timer-ring fraction
    const totalMs =
        game.phase === "choosing" ? CHOOSE_TIME_MS :
            game.phase === "drawing" ? room.settings.drawTimeMs :
                game.phase === "scoring" ? SCORING_DELAY_MS : 0;

    const placeholder = (
        <div className="flex-1 min-w-0 bg-card min-h-[320px] lg:min-h-[460px]" style={{ border: "3px solid var(--outline)", borderRadius: 6 }} />
    );

    function renderCenter() {
        if (game!.phase === "choosing") {
            return isDrawer && words.length > 0
                ? <WordPicker words={words} onChoose={onChooseWord} />
                : placeholder;
        }
        if (game!.phase === "drawing") {
            return <DrawingBoard isDrawer={isDrawer} socket={socket} />;
        }
        if (game!.phase === "scoring") {
            return (
                <div className="flex-1 min-w-0 grid place-items-center bg-card min-h-[320px] lg:min-h-[460px]" style={{ border: "3px solid var(--outline)", borderRadius: 6 }}>
                    <div className="text-center px-4">
                        <div className="font-mono uppercase text-ink/45 mb-2" style={{ fontWeight: 700, fontSize: 11, letterSpacing: ".16em" }}>The word was</div>
                        <div className="font-loud text-ink mb-3" style={{ fontWeight: 800, fontSize: "clamp(34px, 9vw, 52px)" }}>{game!.word}</div>
                        <div className="font-loud italic text-ink/50" style={{ fontWeight: 700, fontSize: 15 }}>next drawer coming up…</div>
                    </div>
                </div>
            );
        }
        return placeholder;
    }

    return (
        <div className="space-y-4">
            <WordBar
                phase={game.phase}
                isDrawer={isDrawer}
                word={game.word}
                wordLength={game.wordLength}
                round={game.round}
                totalRounds={room.settings.rounds}
                drawerName={drawerName}
                endsAt={game.endsAt}
                totalMs={totalMs}
                onLeave={onLeave}
            />
            <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-start">
                <div className="w-full lg:w-[214px] flex-none">
                    <PlayerList players={room.players} currentDrawerId={game.currentDrawerId} guessedIds={game.guessedIds} />
                </div>
                {renderCenter()}
            </div>
        </div>
    );
}
