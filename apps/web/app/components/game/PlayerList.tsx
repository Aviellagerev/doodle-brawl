import { Player } from "../../../../../packages/shared";

// currentDrawerId is optional: in the lobby there's no drawer yet, so it's
// omitted and no one gets the ✏️. In-game, GameScreen passes it.
type Props = { players: Player[]; currentDrawerId?: string };

export default function PlayerList({ players, currentDrawerId }: Props) {
  return (
    <div className="bg-[#3c3836] rounded border border-[#504945] divide-y divide-[#504945]">
      {players.map((p) => (
        <div key={p.id} className="flex justify-between items-center p-2 text-sm">
          <span className="text-[#ebdbb2]">
            {p.name}
            {p.id === currentDrawerId ? " ✏️" : ""}
            {p.isHost ? " 👑" : ""}
          </span>
          <span className="text-[#b8bb26]">{p.score ?? 0}</span>
        </div>
      ))}
    </div>
  );
}
