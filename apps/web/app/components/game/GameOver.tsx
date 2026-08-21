import { RoomState, Player } from "../../../../../packages/shared";
import Avatar from "../Avatar";

type Props = {
    room: RoomState;
    isHost: boolean;
    onPlayAgain: () => void;
    onLeave: () => void;
};

const hardShadow = (x: number, y: number, color = "var(--outline)") => ({ boxShadow: `${x}px ${y}px 0 ${color}` });

// per-place look: [avatar size, plinth height, rank font, tilt, plinth shadow colour]
const SPOTS: Record<number, { avatar: number; plinth: number; rank: number; tilt: number; shadow: string; width: number }> = {
    1: { avatar: 84, plinth: 140, rank: 44, tilt: 3, shadow: "var(--orange)", width: 140 },
    2: { avatar: 64, plinth: 104, rank: 30, tilt: -4, shadow: "var(--outline)", width: 108 },
    3: { avatar: 64, plinth: 78, rank: 26, tilt: 5, shadow: "var(--outline)", width: 108 },
};

function PodiumSpot({ player, place }: { player: Player; place: number }) {
    const s = SPOTS[place];
    return (
        <div className="flex flex-col items-center gap-2.5">
            <div className="relative">
                {place === 1 && (
                    <span
                        className="absolute font-bold"
                        style={{ top: -24, left: "50%", transform: "translateX(-50%) rotate(-6deg)", border: "2.5px solid var(--outline)", borderRadius: 9, background: "var(--amber)", color: "var(--ink)", ...hardShadow(3, 3), padding: "3px 10px", fontSize: 11, letterSpacing: ".08em", whiteSpace: "nowrap" }}
                    >
                        WINNER
                    </span>
                )}
                <Avatar name={player.name} size={s.avatar} ring rotate={s.tilt} />
            </div>
            <div
                className="bg-card flex flex-col items-center justify-center gap-0.5 text-center px-2"
                style={{ width: s.width, height: s.plinth, border: "3px solid var(--outline)", borderRadius: "8px 8px 4px 4px", ...hardShadow(place === 1 ? 6 : 5, place === 1 ? 7 : 6, s.shadow) }}
            >
                <span className="font-loud text-ink" style={{ fontWeight: 800, fontSize: s.rank, lineHeight: 1 }}>{place}</span>
                <span className="font-bold text-ink truncate max-w-full" style={{ fontSize: place === 1 ? 14 : 12 }}>{player.name}</span>
                <span className="font-semibold text-ink/50" style={{ fontSize: place === 1 ? 12 : 11 }}>{player.score ?? 0}</span>
            </div>
        </div>
    );
}

export default function GameOver({ room, isHost, onPlayAgain, onLeave }: Props) {
    const ranked = [...room.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    // visual podium order: 2nd, 1st, 3rd (1st tallest in the middle)
    const podium = [
        { p: ranked[1], place: 2 },
        { p: ranked[0], place: 1 },
        { p: ranked[2], place: 3 },
    ].filter((s) => s.p);
    const rest = ranked.slice(3);

    return (
        <div className="relative overflow-hidden py-6 px-4">
            {/* confetti */}
            <span className="absolute" style={{ top: 30, left: 40, width: 14, height: 14, borderRadius: 4, background: "var(--orange)", transform: "rotate(24deg)" }} />
            <span className="absolute" style={{ top: 90, left: 150, width: 10, height: 10, borderRadius: "50%", background: "var(--cyan)" }} />
            <span className="absolute" style={{ top: 50, right: 60, width: 12, height: 12, borderRadius: 3, background: "var(--lime)", transform: "rotate(-16deg)" }} />
            <span className="absolute" style={{ bottom: 40, left: 80, width: 11, height: 11, borderRadius: "50%", background: "oklch(0.7 0.15 315)" }} />
            <span className="absolute" style={{ bottom: 70, right: 90, width: 13, height: 13, borderRadius: 4, background: "var(--amber)", transform: "rotate(18deg)" }} />

            <div className="relative flex flex-col items-center gap-6">
                {/* headline */}
                <div className="relative text-center">
                    <span className="tape absolute" style={{ top: -12, left: -30, width: 78, height: 26, transform: "rotate(-18deg)" }} />
                    <h2 className="font-loud m-0" style={{ fontWeight: 800, fontSize: "clamp(32px, 8vw, 46px)", lineHeight: 1.05 }}>That&apos;s a brawl!</h2>
                    <p className="font-loud italic text-ink/55 mt-1.5" style={{ fontWeight: 700, fontSize: 16 }}>
                        {room.settings.rounds} {room.settings.rounds === 1 ? "round" : "rounds"}, {room.players.length} players, one winner
                    </p>
                </div>

                {/* podium */}
                <div className="w-full flex items-end justify-center gap-3 sm:gap-4 overflow-x-auto pb-2" style={{ minHeight: 200 }}>
                    {podium.map(({ p, place }) => (
                        <PodiumSpot key={p!.id} player={p!} place={place} />
                    ))}
                </div>

                {/* actions */}
                <div className="flex gap-3 flex-wrap justify-center">
                    {isHost && (
                        <button onClick={onPlayAgain} className="font-loud text-card cursor-pointer bg-orange" style={{ border: "3px solid var(--outline)", borderRadius: "32px 28px 32px 28px", ...hardShadow(5, 6), padding: "14px 30px", fontWeight: 800, fontSize: 22 }}>
                            Rematch!
                        </button>
                    )}
                    <button onClick={onLeave} className="font-loud text-ink cursor-pointer bg-card" style={{ border: "3px solid var(--outline)", borderRadius: "28px 32px 28px 32px", ...hardShadow(5, 6), padding: "14px 24px", fontWeight: 700, fontSize: 17 }}>
                        Back to lobby
                    </button>
                </div>

                {/* everyone else */}
                {rest.length > 0 && (
                    <div className="bg-card w-full max-w-sm" style={{ transform: "rotate(-1deg)", borderRadius: "8px 20px 10px 18px", boxShadow: "0 12px 26px rgba(58,47,38,.16)", padding: 18 }}>
                        <div className="font-mono uppercase text-ink/45 mb-3" style={{ fontWeight: 700, fontSize: 10.5, letterSpacing: ".12em" }}>Everyone else</div>
                        <div className="flex flex-col gap-2">
                            {rest.map((p, i) => (
                                <div key={p.id} className="flex items-center gap-2.5">
                                    <span className="font-loud text-ink/50" style={{ fontWeight: 800, fontSize: 15, width: 18 }}>{i + 4}</span>
                                    <Avatar name={p.name} size={28} />
                                    <span className="flex-1 font-bold truncate" style={{ fontSize: 13 }}>{p.name}</span>
                                    <span className="font-semibold text-ink/55" style={{ fontSize: 12 }}>{p.score ?? 0}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
