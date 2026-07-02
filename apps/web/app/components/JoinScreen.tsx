"use client";

import { useState } from "react";

type JoinScreenProps = {
  onCreate: (name: string) => void;
  onJoin: (name: string, code: string) => void;
};

export default function JoinScreen({ onCreate, onJoin }: JoinScreenProps) {
  const [playerName, setPlayerName] = useState<string>("");
  const [roomCode, setRoomCode] = useState<string>("");

  return (
    <div className="bg-[#3c3836] p-6 rounded border border-[#504945] space-y-4">
      <div className="space-y-2">
        <label className="block text-sm text-[#a89984]">Player Name</label>
        <input
          type="text"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Enter your name"
          className="w-full bg-[#1d2021] border border-[#504945] p-2 rounded text-[#ebdbb2] focus:outline-none focus:border-[#83a598] transition-colors"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm text-[#a89984]">Room Code (for joining)</label>
        <input
          type="text"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          placeholder="e.g. ABCD"
          className="w-full bg-[#1d2021] border border-[#504945] p-2 rounded text-[#ebdbb2] focus:outline-none focus:border-[#83a598] transition-colors uppercase"
        />
      </div>

      <div className="flex gap-4 pt-2">
        <button
          onClick={() => onCreate(playerName)}
          className="flex-1 bg-[#98971a] hover:bg-[#b8bb26] text-[#282828] font-bold py-2 px-4 rounded transition-colors"
        >
          Create Room
        </button>
        <button
          onClick={() => onJoin(playerName, roomCode)}
          className="flex-1 bg-[#458588] hover:bg-[#83a598] text-[#282828] font-bold py-2 px-4 rounded transition-colors"
        >
          Join Room
        </button>
      </div>
    </div>
  );
}
