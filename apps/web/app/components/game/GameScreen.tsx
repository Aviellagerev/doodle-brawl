import { RoomState } from "../../../../../packages/shared";
import WordBar from "./WordBar";
import PlayerList from "./PlayerList";
import WordPicker from "./WordPicker";
import DrawingBoard from "./DrawingBoard";
import { Socket } from "socket.io-client";

type Props = {
    room: RoomState;
    myPlayerId: string;
    words: string[];
    onChooseWord: (word: string) => void;
    socket: Socket | null;
};

export default function GameScreen({ room, myPlayerId, words, onChooseWord, socket }: Props) {
    const game = room.game;
    if (!game) return null; // no game yet — render nothing

    const isDrawer = game.currentDrawerId === myPlayerId;
    const drawerName =
        room.players.find((p) => p.id === game.currentDrawerId)?.name ?? "Someone";

    // One thing per phase in the center column — no overlap. Reads like a
    // little state machine, same pattern as renderScreen() in page.tsx.
    function renderCenter() {
        if (game!.phase === "choosing") {
            return isDrawer && words.length > 0 ? (
                <div className="flex-1 flex items-center justify-center bg-[#1d2021] border border-[#504945] rounded min-h-[300px]">
                    <WordPicker words={words} onChoose={onChooseWord} />
                </div>
            ) : (
                <div className="flex-1 bg-[#1d2021] border border-[#504945] rounded min-h-[300px]" />
            );
        }
        if (game!.phase === "drawing") {
            return <DrawingBoard isDrawer={isDrawer} socket={socket} />;
        }
        return <div className="flex-1 bg-[#1d2021] border border-[#504945] rounded min-h-[300px]" />;
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
            />
            <div className="flex gap-4">
                <div className="w-48">
                    <PlayerList players={room.players} currentDrawerId={game.currentDrawerId} />
                </div>
                {renderCenter()}
            </div>
        </div>
    );
}
