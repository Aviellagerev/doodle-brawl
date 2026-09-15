import { RoomState, Player } from "../../../../../packages/shared";
import Avatar from "../Avatar";
import { Eyebrow, Btn, Btn2, Card } from "../ui/Bits";
import { ordinal } from "../../lib/numbers";

type Props = {
    room: RoomState;
    isHost: boolean;
    onPlayAgain: () => void;
    onLeave: () => void;
    onOpenHistory?: () => void;
};

const fmt = (n: number) => (n ?? 0).toLocaleString();

// per-place plinth: [height, width, numeral size, fill, avatar size]
const PLINTH: Record<number, { h: number; w: number; numeral: number; fill: string; avatar: number; grain: boolean }> = {
    1: { h: 190, w: 240, numeral: 50, fill: "var(--parchment)", avatar: 112, grain: true },
    2: { h: 154, w: 210, numeral: 38, fill: "var(--parchment-mid)", avatar: 92, grain: false },
    3: { h: 126, w: 210, numeral: 32, fill: "var(--parchment-dim)", avatar: 92, grain: false },
};


function PodiumSpot({ player, place }: { player: Player; place: number }) {
    const s = PLINTH[place];
    const first = place === 1;
    return (
        <div className="flex flex-col items-center" style={{ paddingTop: first ? 38 : 0 }}>
            <div className="relative flex flex-col items-center" style={{ marginBottom: 12 }}>
                {first && (
                    <span className="absolute" style={{ top: -34, fontSize: 26, transform: "rotate(-8deg)" }}>👑</span>
                )}
                <Avatar name={player.name} avatar={player.avatar} size={s.avatar} ring faintRing={!first} />
            </div>
            <div
                className={`flex flex-col items-center justify-center text-center px-3 ${s.grain ? "grain" : ""}`}
                style={{
                    width: s.w, height: s.h, maxWidth: "100%",
                    background: s.fill,
                    border: "3px solid var(--ink)",
                    borderRadius: `${first ? 14 : 12}px ${first ? 14 : 12}px 0 0`,
                }}
            >
                <span className="display" style={{ fontSize: s.numeral, color: "var(--ink-warm)" }}>{ordinal(place)}</span>
                <span className="truncate max-w-full" dir="auto" style={{ fontFamily: "var(--font-loud)", fontWeight: 800, fontSize: first ? 17 : 15, color: "var(--ink-warm)" }}>
                    {player.name}
                </span>
                <span className="display" style={{ fontSize: first ? 26 : place === 2 ? 22 : 20, color: first ? "var(--magenta-ink)" : "rgba(58,47,38,.6)" }}>
                    {fmt(player.score ?? 0)} ✦
                </span>
            </div>
        </div>
    );
}

/** The stacked standing used on phones, and for 4th place and below anywhere. */
function StandingRow({ player, place }: { player: Player; place: number }) {
    const top = place === 1;
    const dim = place >= 4;
    return (
        <div
            className={`relative flex items-center gap-3 ${dim ? "faint" : "grain"}`}
            style={{
                padding: "11px 14px",
                borderRadius: 14,
                ...(dim
                    ? {}
                    : {
                        background: place === 1 ? "var(--parchment)" : place === 2 ? "var(--parchment-mid)" : "var(--parchment-dim)",
                        border: "3px solid var(--ink)",
                        boxShadow: top ? "5px 5px 0 var(--gold)" : "4px 4px 0 rgba(0,0,0,.42)",
                    }),
                opacity: dim ? 0.85 : 1,
            }}
        >
            {top && <span className="absolute" style={{ top: -14, right: 14, fontSize: 22, transform: "rotate(9deg)" }}>👑</span>}
            <span className="display flex-none text-center" style={{ width: 34, fontSize: 20, color: dim ? "rgba(242,227,191,.5)" : "var(--ink-warm)" }}>
                {ordinal(place)}
            </span>
            <Avatar name={player.name} avatar={player.avatar} size={34} surface={dim ? "night" : "parchment"} dim={dim} />
            <span className="min-w-0 flex-1">
                <span className="block truncate" dir="auto" style={{ fontFamily: "var(--font-loud)", fontWeight: 800, fontSize: 14, color: dim ? "var(--parchment)" : "var(--ink-warm)" }}>
                    {player.name}
                </span>
                {dim && (
                    <span className="block" style={{ fontWeight: 600, fontSize: 10.5, color: "rgba(242,227,191,.4)" }}>
                        left without saying goodbye
                    </span>
                )}
            </span>
            <span className="display flex-none" style={{ fontSize: 18, color: dim ? "rgba(242,227,191,.5)" : "var(--magenta-ink)" }}>
                {fmt(player.score ?? 0)} ✦
            </span>
        </div>
    );
}

function pick(rec: Record<string, number> | undefined, mode: "min" | "max"): { id: string; value: number } | null {
    if (!rec) return null;
    let best: { id: string; value: number } | null = null;
    for (const [id, value] of Object.entries(rec)) {
        if (!best || (mode === "min" ? value < best.value : value > best.value)) best = { id, value };
    }
    return best;
}

/** 07 · End of the rite. */
export default function GameOver({ room, isHost, onPlayAgain, onLeave, onOpenHistory }: Props) {
    const ranked = [...room.players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const winner = ranked[0];
    // the design's podium reads 3rd · 1st · 2nd, left to right
    const podium = [
        { p: ranked[2], place: 3 },
        { p: ranked[0], place: 1 },
        { p: ranked[1], place: 2 },
    ].filter((s) => s.p);
    const rest = ranked.slice(3);

    const stats = room.stats;
    const nameOf = (id: string) => room.players.find((p) => p.id === id)?.name;
    const fastest = pick(stats?.guessMs, "min");
    const bestDoodle = pick(stats?.doodle, "max");
    const mostWrong = pick(stats?.wrong, "max");
    const awards: [string, string][] = [];
    if (fastest && nameOf(fastest.id)) awards.push(["fastest divination", `${nameOf(fastest.id)} · ${(fastest.value / 1000).toFixed(1)}s`]);
    if (bestDoodle && nameOf(bestDoodle.id)) awards.push(["finest scrawl", nameOf(bestDoodle.id)!]);
    if (mostWrong && nameOf(mostWrong.id)) awards.push(["most wrong", `${nameOf(mostWrong.id)} · ${mostWrong.value}`]);

    const straggler = ranked[3];

    return (
        <div className="flex flex-col items-center gap-7 py-4">
            <div className="text-center">
                <Eyebrow dim={0.42} size={11} style={{ letterSpacing: ".34em" }}>the candles are out</Eyebrow>
                <h2 className="display m-0 mt-3" dir="auto" style={{ fontSize: "clamp(34px, 8vw, 56px)", color: "var(--parchment)" }}>
                    {winner ? `${winner.name} ascends` : "nobody ascends"}
                </h2>
                <p className="m-0 mt-2" style={{ fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 16, color: "var(--gold-bright)" }}>
                    and is insufferable about it
                </p>
            </div>

            {/* desktop: the podium · phones: stacked standings */}
            <div className="hidden sm:flex items-end justify-center gap-[22px] flex-wrap">
                {podium.map(({ p, place }) => <PodiumSpot key={p!.id} player={p!} place={place} />)}
            </div>
            <div className="sm:hidden w-full flex flex-col gap-3">
                {ranked.slice(0, 3).map((p, i) => <StandingRow key={p.id} player={p} place={i + 1} />)}
            </div>

            {/* the footer line already names a lone straggler — only list a crowd */}
            {rest.length > 1 && (
                <div className="w-full max-w-[520px] flex flex-col gap-2.5">
                    {rest.map((p, i) => <StandingRow key={p.id} player={p} place={i + 4} />)}
                </div>
            )}

            {/* actions */}
            <div className="flex gap-3.5 flex-wrap justify-center items-center">
                {isHost && (
                    <Btn tone="gold" size={25} radius="32px 28px 32px 26px" style={{ padding: "15px 34px" }} onClick={onPlayAgain}>CAST AGAIN</Btn>
                )}
                <Btn2 night size={16} radius="28px 32px 26px 32px" style={{ minHeight: 56, padding: "15px 28px", fontWeight: 800 }} onClick={onLeave}>
                    back to the guild
                </Btn2>
                {onOpenHistory && (
                    <button
                        onClick={onOpenHistory}
                        className="cursor-pointer"
                        style={{
                            border: "2.5px dashed rgba(242,227,191,.35)", borderRadius: 28, background: "transparent",
                            color: "rgba(242,227,191,.6)", minHeight: 56, padding: "15px 24px",
                            fontFamily: "var(--font-loud)", fontWeight: 800, fontSize: 15,
                        }}
                    >
                        📜 add to chronicle
                    </button>
                )}
            </div>

            {awards.length > 0 && (
                <div className="flex gap-2.5 flex-wrap justify-center">
                    {awards.map(([label, who]) => (
                        <Card key={label} className="px-3.5 py-2.5" tilt={label.length % 2 ? -1.4 : 1.2} radius="11px 9px 12px 8px" shadow="3px 3px 0 rgba(0,0,0,.42)">
                            <span className="eyebrow block" style={{ fontSize: 8.5, color: "var(--magenta-ink)" }}>{label}</span>
                            <span className="block mt-1" dir="auto" style={{ fontFamily: "var(--font-loud)", fontWeight: 800, fontSize: 12.5, color: "var(--ink-warm)" }}>{who}</span>
                        </Card>
                    ))}
                </div>
            )}

            {straggler && (
                <p className="m-0 text-center" style={{ fontWeight: 600, fontSize: 12.5, color: "rgba(242,227,191,.4)" }}>
                    {straggler.name} came fourth and has left without saying goodbye
                </p>
            )}
        </div>
    );
}
