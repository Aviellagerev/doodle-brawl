import { RoomState } from "../../../../../packages/shared";

type Props = {
    room: RoomState;
    isHost: boolean;
    onPlayAgain: () => void;
    onLeave: () => void;
};

export default function GameOver({ room, isHost, onPlayAgain, onLeave }: Props) {
    // rank a copy by score, highest first (don't mutate room.players)
    const ranked = [...room.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const winner = ranked[0];

    return (
        <div className="bg-[#3c3836] p-6 rounded border border-[#504945] space-y-4 text-center">
            <h2 className="text-2xl font-bold text-[#b8bb26]">Game Over</h2>
            {winner && (
                <p className="text-lg text-[#fabd2f]">
                    🏆 {winner.name} wins with {winner.score ?? 0} points!
                </p>
            )}

            <ol className="space-y-1 text-left max-w-sm mx-auto">
                {ranked.map((p, i) => (
                    <li key={p.id} className="flex justify-between bg-[#1d2021] border border-[#504945] rounded p-2">
                        <span className="text-[#ebdbb2]">{i + 1}. {p.name}</span>
                        <span className="text-[#b8bb26] font-bold">{p.score ?? 0}</span>
                    </li>
                ))}
            </ol>

            <div className="flex gap-3 justify-center">
                <button onClick={onLeave}
                    className="bg-[#504945] hover:bg-[#665c54] text-[#ebdbb2] font-bold py-2 px-4 rounded transition-colors">
                    Leave
                </button>
                {isHost && (
                    <button onClick={onPlayAgain}
                        className="bg-[#98971a] hover:bg-[#b8bb26] text-[#282828] font-bold py-2 px-4 rounded transition-colors">
                        Play again
                    </button>
                )}
            </div>
        </div>
    );
}
