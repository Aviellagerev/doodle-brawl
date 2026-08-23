import { RoomState, Player } from "../../../../../packages/shared";
import Avatar from "../Avatar";

type Props = {
    room: RoomState;
    isHost: boolean;
    onPlayAgain: () => void;
    onLeave: () => void;
};

const hardShadow = (x: number, y: number, color = "var(--outline)") => ({ boxShadow: `${x}px ${y}px 0 ${color}` });
const fmt = (n: number) => (n ?? 0).toLocaleString();

// per-place look: [avatar size, plinth width/height, rank font, tilt, plinth shadow colour]
const SPOTS: Record<number, { avatar: number; plinth: number; rank: number; tilt: number; shadow: string; width: number; nameSize: number; scoreSize: number }> = {
    1: { avatar: 96, plinth: 152, rank: 44, tilt: 3, shadow: "var(--orange)", width: 158, nameSize: 14, scoreSize: 12 },
    2: { avatar: 76, plinth: 104, rank: 30, tilt: -4, shadow: "var(--outline)", width: 132, nameSize: 12, scoreSize: 11 },
    3: { avatar: 76, plinth: 80, rank: 26, tilt: 5, shadow: "var(--outline)", width: 132, nameSize: 12, scoreSize: 11 },
};

function PodiumSpot({ player, place }: { player: Player; place: number }) {
    const s = SPOTS[place];
    return (
        <div className="flex flex-col items-center gap-2.5">
            <div className="relative">
                {place === 1 && (
                    <span
                        className="absolute"
                        style={{ top: -24, left: "50%", transform: "translateX(-50%) rotate(-6deg)", border: "2.5px solid var(--outline)", borderRadius: 9, background: "var(--amber)", color: "var(--ink)", ...hardShadow(3, 3), padding: "3px 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", whiteSpace: "nowrap" }}
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
                <span className="font-bold text-ink truncate max-w-full" style={{ fontSize: s.nameSize }}>{player.name}</span>
                <span className="font-semibold text-ink/50" style={{ fontSize: s.scoreSize }}>{fmt(player.score ?? 0)}</span>
            </div>
        </div>
    );
}

// Petty-award label sticker + winner text
function AwardRow({ label, bg, onColor, text }: { label: string; bg: string; onColor?: boolean; text: string }) {
    return (
        <div className="flex items-center gap-2.5" style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>
            <span
                className={onColor ? "text-card" : "text-ink"}
                style={{ border: "2px solid var(--outline)", borderRadius: 8, background: bg, padding: "3px 8px", fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}
            >
                {label}
            </span>
            <span className="text-ink" dir="auto">{text}</span>
        </div>
    );
}

// smallest / largest entry of a Record<string, number>; returns null when empty
function pick(rec: Record<string, number> | undefined, mode: "min" | "max"): { id: string; value: number } | null {
    if (!rec) return null;
    let best: { id: string; value: number } | null = null;
    for (const [id, value] of Object.entries(rec)) {
        if (!best || (mode === "min" ? value < best.value : value > best.value)) best = { id, value };
    }
    return best;
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

    // petty awards computed from server stats (may be undefined on a never-played room)
    const stats = room.stats;
    const nameOf = (id: string) => room.players.find((p) => p.id === id)?.name;
    const fastest = pick(stats?.guessMs, "min");
    const bestDoodle = pick(stats?.doodle, "max");
    const mostWrong = pick(stats?.wrong, "max");
    const fastestName = fastest && nameOf(fastest.id);
    const doodleName = bestDoodle && nameOf(bestDoodle.id);
    const wrongName = mostWrong && nameOf(mostWrong.id);
    const hasAwards = Boolean(fastestName || doodleName || wrongName);

    // "N terrible guesses" — total wrong guesses this game
    const terrible = stats ? Object.values(stats.wrong).reduce((a, b) => a + b, 0) : 0;
    const rounds = room.settings.rounds;
    const subhead = terrible > 0
        ? `${rounds} ${rounds === 1 ? "round" : "rounds"}, ${terrible} terrible guess${terrible === 1 ? "" : "es"}, one winner`
        : `${rounds} ${rounds === 1 ? "round" : "rounds"}, ${room.players.length} players, one winner`;

    return (
        <div className="relative overflow-hidden py-6 px-4">
            {/* confetti — fixed positions/rotations, no randomness */}
            <span className="absolute" style={{ top: 34, left: 60, width: 14, height: 14, borderRadius: 4, background: "var(--orange)", transform: "rotate(24deg)" }} />
            <span className="absolute" style={{ top: 96, left: 170, width: 10, height: 10, borderRadius: "50%", background: "var(--cyan)" }} />
            <span className="absolute" style={{ top: 54, right: 70, width: 12, height: 12, borderRadius: 3, background: "var(--lime)", transform: "rotate(-16deg)" }} />
            <span className="absolute" style={{ bottom: 60, left: 120, width: 11, height: 11, borderRadius: "50%", background: "oklch(0.7 0.15 315)" }} />
            <span className="absolute" style={{ bottom: 90, right: 110, width: 13, height: 13, borderRadius: 4, background: "var(--amber)", transform: "rotate(18deg)" }} />

            <div className="relative flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-9 max-w-4xl mx-auto">
                {/* LEFT: headline + podium + actions */}
                <div className="flex-1 flex flex-col items-center gap-6 min-w-0">
                    <div className="relative text-center">
                        <span className="tape absolute" style={{ top: -12, left: -34, width: 80, height: 28, transform: "rotate(-18deg)" }} />
                        <h2 className="font-loud m-0" style={{ fontWeight: 800, fontSize: "clamp(32px, 8vw, 46px)", lineHeight: 1.05 }}>That&apos;s a brawl!</h2>
                        <p className="font-loud italic text-ink/55 mt-1.5" style={{ fontWeight: 700, fontSize: 17 }}>{subhead}</p>
                    </div>

                    {/* podium */}
                    <div className="w-full flex items-end justify-center gap-3 sm:gap-4 overflow-x-auto pb-2" style={{ minHeight: 220 }}>
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
                </div>

                {/* RIGHT: everyone else + petty awards */}
                {(rest.length > 0 || hasAwards) && (
                    <div className="w-full lg:w-[344px] flex-none flex flex-col gap-4">
                        {rest.length > 0 && (
                            <div className="bg-card" style={{ transform: "rotate(-1deg)", borderRadius: "8px 20px 10px 18px", boxShadow: "0 12px 26px rgba(58,47,38,.16)", padding: 20 }}>
                                <div className="font-mono uppercase text-ink/45 mb-3" style={{ fontWeight: 700, fontSize: 10.5, letterSpacing: ".12em" }}>Everyone else</div>
                                <div className="flex flex-col gap-2.5">
                                    {rest.map((p, i) => (
                                        <div key={p.id} className="flex items-center gap-2.5">
                                            <span className="font-loud text-ink/50" style={{ fontWeight: 800, fontSize: 15, width: 18 }}>{i + 4}</span>
                                            <Avatar name={p.name} size={28} />
                                            <span className="flex-1 font-bold truncate" style={{ fontSize: 13 }}>{p.name}</span>
                                            <span className="font-semibold text-ink/55" style={{ fontSize: 12 }}>{fmt(p.score ?? 0)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {hasAwards && (
                            <div className="bg-card relative" style={{ transform: "rotate(1.4deg)", borderRadius: "18px 8px 20px 10px", boxShadow: "0 12px 26px rgba(58,47,38,.16)", padding: 20 }}>
                                <span className="tape absolute" style={{ top: -13, left: 24, width: 84, height: 26, transform: "rotate(-5deg)" }} />
                                <div className="font-mono uppercase text-ink/45 mb-3" style={{ marginTop: 8, fontWeight: 700, fontSize: 10.5, letterSpacing: ".12em" }}>Petty awards</div>
                                <div className="flex flex-col gap-2.5">
                                    {fastestName && <AwardRow label="FASTEST" bg="var(--lime)" text={`${fastestName}, ${(fastest!.value / 1000).toFixed(1)}s`} />}
                                    {doodleName && <AwardRow label="BEST DOODLE" bg="var(--cyan)" onColor text={doodleName} />}
                                    {wrongName && <AwardRow label="MOST WRONG" bg="var(--rose)" onColor text={`${wrongName}, ${mostWrong!.value} guess${mostWrong!.value === 1 ? "" : "es"}`} />}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
