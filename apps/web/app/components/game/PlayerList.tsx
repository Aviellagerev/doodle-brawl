import { Player } from "../../../../../packages/shared";
import Avatar from "../Avatar";

// currentDrawerId + guessedIds are optional: the lobby omits them (no drawer /
// guesses yet). In-game, GameScreen passes both.
type Props = {
  players: Player[];
  currentDrawerId?: string;
  guessedIds?: string[];
};

export default function PlayerList({ players, currentDrawerId, guessedIds = [] }: Props) {
  const guessers = players.filter((p) => p.id !== currentDrawerId);
  const guessedCount = guessers.filter((p) => guessedIds.includes(p.id)).length;

  return (
    // mobile: horizontal scrolling strip · desktop: vertical list
    <div className="bg-card flex gap-2 overflow-x-auto lg:flex-col lg:overflow-x-visible" style={{ borderRadius: "8px 18px 8px 18px", boxShadow: "0 8px 20px rgba(58,47,38,.12)", padding: 12 }}>
      <div className="hidden lg:block font-mono uppercase text-ink/45" style={{ fontWeight: 700, fontSize: 10, letterSpacing: ".12em" }}>
        Players — {players.length}
      </div>

      {players.map((p) => {
        const isDrawer = p.id === currentDrawerId;
        const guessed = guessedIds.includes(p.id);
        const rowStyle = isDrawer
          ? { background: "color-mix(in srgb, var(--amber) 30%, transparent)", border: "2.5px solid var(--outline)" }
          : guessed
            ? { background: "color-mix(in srgb, var(--lime) 25%, transparent)", border: "2.5px solid var(--lime)" }
            : { border: "2.5px solid transparent" };

        return (
          <div
            key={p.id}
            className="flex-none w-16 flex flex-col items-center text-center gap-1 p-1.5 lg:w-auto lg:flex-row lg:items-center lg:text-left lg:gap-2.5 lg:p-2"
            style={{ borderRadius: 12, ...rowStyle }}
          >
            <Avatar name={p.name} size={30} />
            <span className="min-w-0 w-full lg:flex-1">
              <span className="block font-bold truncate text-[10px] lg:text-xs">{p.name}</span>
              <span
                className="block font-semibold text-[9px] lg:text-[10px]"
                style={{ color: guessed ? "color-mix(in srgb, var(--ink) 55%, var(--lime))" : "color-mix(in srgb, var(--ink) 50%, transparent)" }}
              >
                {isDrawer ? "drawing" : guessed ? "guessed!" : `${p.score ?? 0}`}
              </span>
            </span>
            {isDrawer && <span className="text-[11px] lg:text-[13px]">✏️</span>}
            {guessed && <span className="text-[11px] lg:text-[13px]" style={{ color: "color-mix(in srgb, var(--ink) 55%, var(--lime))" }}>✓</span>}
          </div>
        );
      })}

      {currentDrawerId && (
        <div className="hidden lg:block mt-auto pt-2.5 font-loud italic text-ink/45" style={{ borderTop: "2px dotted color-mix(in srgb, var(--ink) 20%, transparent)", fontSize: 11.5 }}>
          {guessedCount} of {guessers.length} have guessed it
        </div>
      )}
    </div>
  );
}
