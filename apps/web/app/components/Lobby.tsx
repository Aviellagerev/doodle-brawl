import { RoomState, RoomSettings } from "../../../../packages/shared";
import PlayerList from "./game/PlayerList";

type LobbyProps = {
    room: RoomState;
    isHost: boolean;
    onLeave: () => void;
    onStart: () => void;
    onUpdateSettings: (settings: RoomSettings) => void;
};

export default function Lobby({ room, isHost, onLeave, onStart, onUpdateSettings }: LobbyProps) {
    const s = room.settings;
    // change one field → send the whole (merged) settings object to the server
    const set = (patch: Partial<RoomSettings>) => onUpdateSettings({ ...s, ...patch });

    return (
        <div className="bg-[#3c3836] p-6 rounded border border-[#504945] space-y-4">
            <header className="text-lg text-[#a89984]">
                Lobby code: <span className="text-[#b8bb26] font-bold">{room.roomId}</span>
            </header>

            <PlayerList players={room.players} />

            <div className="space-y-2">
                <h3 className="text-sm font-bold text-[#d3869b]">Settings</h3>
                <SettingRow label="Rounds" value={s.rounds} min={1} max={10} disabled={!isHost}
                    onChange={(v) => set({ rounds: v })} />
                <SettingRow label="Draw time (s)" value={Math.round(s.drawTimeMs / 1000)} min={15} max={300} disabled={!isHost}
                    onChange={(v) => set({ drawTimeMs: v * 1000 })} />
                <SettingRow label="Word choices" value={s.wordChoices} min={1} max={5} disabled={!isHost}
                    onChange={(v) => set({ wordChoices: v })} />
                <SettingRow label="Max players" value={s.maxPlayers} min={2} max={20} disabled={!isHost}
                    onChange={(v) => set({ maxPlayers: v })} />
                {!isHost && <p className="text-xs italic text-[#7c6f64]">Only the host can change settings.</p>}
            </div>

            <div className="flex gap-3">
                <button onClick={onLeave}
                    className="bg-[#504945] hover:bg-[#665c54] text-[#ebdbb2] font-bold py-2 px-4 rounded transition-colors">
                    Leave
                </button>
                {isHost && (
                    <button onClick={onStart}
                        className="bg-[#98971a] hover:bg-[#b8bb26] text-[#282828] font-bold py-2 px-4 rounded transition-colors">
                        Start
                    </button>
                )}
            </div>
        </div>
    );
}

function SettingRow({ label, value, min, max, disabled, onChange }: {
    label: string; value: number; min: number; max: number; disabled: boolean; onChange: (v: number) => void;
}) {
    return (
        <div className="flex justify-between items-center text-sm">
            <span className="text-[#ebdbb2]">{label}</span>
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                disabled={disabled}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-20 bg-[#1d2021] border border-[#504945] rounded p-1 text-right text-[#ebdbb2] disabled:opacity-60"
            />
        </div>
    );
}
