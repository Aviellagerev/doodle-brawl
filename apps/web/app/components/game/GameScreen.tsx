import { RoomState } from "../../../../../packages/shared";
import WordBar from "./WordBar";
import PlayerList from "./PlayerList";
import WordPicker from "./WordPicker";
type Props = {
     room: RoomState;
      myPlayerId: string; 
      words: string[]; 
      onChooseWord: (word: string) => void; 
    };

export default function GameScreen({ room, myPlayerId, words, onChooseWord }: Props) {

    const game = room.game;
    if (!game) return null; // no game yet — render nothing

    const isDrawer = game.currentDrawerId === myPlayerId;
    const drawerName =
        room.players.find((p) => p.id === game.currentDrawerId)?.name ?? "Someone";

    return (
        <div className="space-y-4">
            <WordBar
                phase={game.phase}
                isDrawer={isDrawer}
                word={game.word}
                wordLength={game.wordLength}
                round={game.round}
                drawerName={drawerName}
            />
            <div className="flex gap-4">
                <div className="w-48">
                    <PlayerList players={room.players} currentDrawerId={game.currentDrawerId} />
                </div>
                {/* DrawingBoard goes here (Milestone 2) */}
                {isDrawer && game.phase === "choosing" && words.length > 0 ? (
                    <div className="flex-1 flex items-center justify-center bg-[#1d2021] border border-[#504945] rounded min-h-[300px]">
                        <WordPicker words={words} onChoose={onChooseWord} />
                    </div>
                ) : (
                    <div className="flex-1 bg-[#1d2021] border border-[#504945] rounded min-h-[300px]" />
                )}

                {/* Chat goes here (Milestone 3) */}
                <div className="w-64 bg-[#1d2021] border border-[#504945] rounded" />
            </div>
        </div>
    );
}
