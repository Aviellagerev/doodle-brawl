import { Player } from "../../../../../packages/shared";
import Avatar from "../Avatar";
import { Eyebrow } from "../ui/Bits";

type Props = {
  players: Player[];
  currentDrawerId?: string;
  guessedIds?: string[];
  myPlayerId?: string;
};

const JOKES = [
  "“a wizard is never late,\nhe is merely still drawing”",
  "“the hand shakes; the spell does not care”",
  "“no one has ever guessed a kettle first”",
];

/** The coven — who is in the circle, and what they are doing about it. */
export default function PlayerList({ players, currentDrawerId, guessedIds = [], myPlayerId }: Props) {
  const joke = JOKES[players.length % JOKES.length];

  return (
    <>
      {/* MOBILE — a scrolling strip of chips; the caster's is a parchment card */}
      <div className="lg:hidden flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
        {players.map((p) => {
          const casting = p.id === currentDrawerId;
          const divined = guessedIds.includes(p.id);
          return (
            <div
              key={p.id}
              className={`flex-none flex items-center gap-2 ${casting ? "card" : "faint"}`}
              style={{
                padding: "6px 10px 6px 6px",
                borderRadius: 12,
                ...(casting ? { boxShadow: "3px 3px 0 rgba(0,0,0,.42)", transform: "rotate(-.6deg)" } : {}),
              }}
            >
              <Avatar name={p.name} avatar={p.avatar} size={26} surface={casting ? "parchment" : "night"} />
              <span className="min-w-0">
                <span
                  className="block truncate max-w-[84px]"
                  dir="auto"
                  style={{ fontFamily: "var(--font-loud)", fontWeight: 800, fontSize: 11, color: casting ? "var(--ink-warm)" : "var(--parchment)" }}
                >
                  {p.name}
                </span>
                <span
                  className="block"
                  style={{
                    fontWeight: 600,
                    fontSize: 9,
                    color: casting ? "rgba(58,47,38,.55)" : divined ? "var(--green)" : "rgba(242,227,191,.45)",
                  }}
                >
                  {casting ? "casting" : divined ? "divined ✦" : `${p.score ?? 0}`}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* DESKTOP — the coven column */}
      <div className="hidden lg:flex lg:flex-col gap-2.5 h-full">
        <Eyebrow dim={0.42} size={9.5} className="mb-1">the coven</Eyebrow>

        {players.map((p) => {
          const casting = p.id === currentDrawerId;
          const divined = guessedIds.includes(p.id);
          const you = p.id === myPlayerId;

          if (casting) {
            return (
              <div
                key={p.id}
                className="card tilt relative flex items-center gap-2.5"
                style={{
                  ["--tilt" as string]: "-.6deg",
                  border: "2.5px solid var(--ink)",
                  borderRadius: 13,
                  boxShadow: "4px 4px 0 rgba(0,0,0,.42)",
                  padding: "10px 11px",
                }}
              >
                <span className="absolute" style={{ top: -12, left: -8, fontSize: 19, transform: "rotate(-14deg)" }}>👑</span>
                <Avatar name={p.name} avatar={p.avatar} size={34} surface="parchment" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate" dir="auto" style={{ fontFamily: "var(--font-loud)", fontWeight: 800, fontSize: 13, color: "var(--ink-warm)" }}>
                    {p.name}{you && <span style={{ opacity: 0.5 }}> · you</span>}
                  </span>
                  <span className="block" style={{ fontWeight: 600, fontSize: 10, color: "rgba(58,47,38,.55)" }}>casting now</span>
                </span>
                <span className="display flex-none" style={{ fontSize: 17, color: "var(--magenta-ink)" }}>{p.score ?? 0}</span>
              </div>
            );
          }

          return (
            <div key={p.id} className="faint flex items-center gap-2.5" style={{ borderRadius: 13, padding: "9px 11px" }}>
              <Avatar name={p.name} avatar={p.avatar} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate" dir="auto" style={{ fontFamily: "var(--font-loud)", fontWeight: 800, fontSize: 13, color: "var(--parchment)" }}>
                  {p.name}{you && <span style={{ opacity: 0.5 }}> · you</span>}
                </span>
                <span className="block" style={{ fontWeight: 600, fontSize: 10, color: divined ? "var(--green)" : "rgba(242,227,191,.45)" }}>
                  {divined ? "divined it ✦" : "muttering…"}
                </span>
              </span>
              <span className="display flex-none" style={{ fontSize: 17, color: "var(--parchment)" }}>{p.score ?? 0}</span>
            </div>
          );
        })}

        <div
          className="mt-auto outline-only text-center whitespace-pre-line"
          style={{ padding: 12, fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 12, lineHeight: 1.4, color: "rgba(242,227,191,.5)" }}
        >
          {joke}
        </div>
      </div>
    </>
  );
}
