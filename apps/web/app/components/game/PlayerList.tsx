import { Player } from "../../../../../packages/shared";
import Avatar from "../Avatar";
import { colorOf, initialsOf } from "../../lib/avatar";

// currentDrawerId + guessedIds are optional: the lobby omits them (no drawer /
// guesses yet). In-game, GameScreen passes both plus myPlayerId (marks "you").
type Props = {
  players: Player[];
  currentDrawerId?: string;
  guessedIds?: string[];
  myPlayerId?: string;
};

export default function PlayerList({ players, currentDrawerId, guessedIds = [], myPlayerId }: Props) {
  const guessers = players.filter((p) => p.id !== currentDrawerId);
  const guessedCount = guessers.filter((p) => guessedIds.includes(p.id)).length;

  return (
    <>
      {/* MOBILE — horizontal scrolling strip of 40px avatars + one caption each (#1i) */}
      <div className="lg:hidden flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1">
        {players.map((p) => {
          const isDrawer = p.id === currentDrawerId;
          const guessed = guessedIds.includes(p.id);
          const isYou = p.id === myPlayerId;
          const border = guessed
            ? "2.5px solid var(--lime)"
            : isYou && !isDrawer
              ? "2.5px dashed color-mix(in srgb, var(--ink) 45%, transparent)"
              : "2.5px solid var(--outline)";
          const caption = isDrawer ? "✎ draws" : guessed ? "✓ got it" : isYou ? "you" : `${p.score ?? 0}`;
          const capColor = guessed
            ? "color-mix(in srgb, var(--ink) 45%, var(--lime))"
            : "color-mix(in srgb, var(--ink) 55%, transparent)";
          return (
            <div key={p.id} className="flex-none flex flex-col items-center gap-1" style={{ width: 52 }}>
              <span
                className="grid place-items-center font-loud text-card"
                style={{ width: 40, height: 40, borderRadius: "50%", background: colorOf(p.name), border, textShadow: "0 1px 2px rgba(0,0,0,.35)", fontWeight: 800, fontSize: 13 }}
              >
                {initialsOf(p.name)}
              </span>
              <span className="font-bold truncate max-w-full text-center" style={{ fontSize: 9, color: capColor }}>
                {caption}
              </span>
            </div>
          );
        })}
      </div>

      {/* DESKTOP — vertical list card */}
      <div className="hidden lg:flex lg:flex-col gap-2 bg-card" style={{ borderRadius: "8px 18px 8px 18px", boxShadow: "0 8px 20px rgba(58,47,38,.12)", padding: 12 }}>
        <div className="font-mono uppercase text-ink/45" style={{ fontWeight: 700, fontSize: 10, letterSpacing: ".12em" }}>
          Players — {players.length}
        </div>

        {players.map((p) => {
          const isDrawer = p.id === currentDrawerId;
          const guessed = guessedIds.includes(p.id);
          const isYou = p.id === myPlayerId;
          const rowStyle = isDrawer
            ? { background: "color-mix(in srgb, var(--amber) 30%, transparent)", border: "2.5px solid var(--outline)" }
            : guessed
              ? { background: "color-mix(in srgb, var(--lime) 25%, transparent)", border: "2.5px solid var(--lime)" }
              : isYou
                ? { border: "2.5px dashed color-mix(in srgb, var(--ink) 40%, transparent)" }
                : { border: "2.5px solid transparent" };

          return (
            <div key={p.id} className="flex flex-row items-center gap-2.5 p-2" style={{ borderRadius: 12, ...rowStyle }}>
              <Avatar name={p.name} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block font-bold truncate text-xs">
                  {p.name}
                  {isYou && <span className="text-ink/45 font-semibold"> (you)</span>}
                </span>
                <span
                  className="block font-semibold text-[10px]"
                  style={{ color: guessed ? "color-mix(in srgb, var(--ink) 55%, var(--lime))" : "color-mix(in srgb, var(--ink) 50%, transparent)" }}
                >
                  {isDrawer ? "drawing" : guessed ? "guessed!" : `${p.score ?? 0} pts`}
                </span>
              </span>
              {isDrawer && <span className="text-[13px]">✎</span>}
              {guessed && <span className="text-[13px]" style={{ color: "color-mix(in srgb, var(--ink) 55%, var(--lime))" }}>✓</span>}
            </div>
          );
        })}

        {currentDrawerId && (
          <div className="mt-auto pt-2.5 font-loud italic text-ink/45" style={{ borderTop: "2px dotted color-mix(in srgb, var(--ink) 20%, transparent)", fontSize: 11.5 }}>
            {guessedCount} of {guessers.length} have guessed it
          </div>
        )}
      </div>
    </>
  );
}
