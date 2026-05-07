"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { v4 as uuidv4 } from 'uuid';
import { RoomResponse, Player } from "../../../packages/shared";
export default function Home() {
  const [status, setStatus] = useState<string>("connecting...");
  const [socketId, setSocketId] = useState<string>("(none)");
  const [log, setLog] = useState<string[]>([]);


  const [playerName, setPlayerName] = useState<string>("");
  const [roomCode, setRoomCode] = useState<string>("");

  const socketRef = useRef<Socket | null>(null);

  const addLog = (line: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString([], { hour12: false })}] ${line}`]);
  };

  function getPermanentPlayerId() {
    let playerId = localStorage.getItem("skribbl_player_id");
    if (!playerId) {
      playerId = uuidv4(); 
      localStorage.setItem("skribbl_player_id", playerId);
    }
    return playerId;
  }
  useEffect(() => {
    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("connected");
      setSocketId(socket.id ?? "(unknown)");
      addLog(`connected with id ${socket.id}`);
    });

    socket.on("disconnect", () => {
      setStatus("disconnected");
      addLog("disconnected");
    });

    socket.on("pong", (counter) => {
      addLog(`server response: ${JSON.stringify(counter)}`);
    });
    socket.on("user_join", (data) => {
      addLog(`${data} join the channel`);
    });

    return () => {
      socket.disconnect();
    };
  
  }, []);

  const handleCreate = () => {
    const socket = socketRef.current;
    if (!socket || !playerName) {
      addLog("Error: Name is required to create a room.");
      return;
    }
    addLog(`Creating room for ${playerName}...`);

    socket.emit("create_room", { id:getPermanentPlayerId(),name: playerName }, (res: RoomResponse) => {
      if (res.success) {
        setStatus(`Rooms ID: ${res.roomId}`);
      }
    });
  };

  const handleJoin = () => {
    const socket = socketRef.current;
    if (!socket || !playerName || !roomCode) {
      addLog("Error: Name and Room Code are required to join.");
      return;
    }
    addLog(`${playerName} attempting to join room: ${roomCode}...`);

    socket.emit("join_room", {id:getPermanentPlayerId(), name: playerName, code: roomCode }, (res: RoomResponse) => {
      if (res.success) {
        setStatus(`Rooms ID: ${res.roomId}`);
      }
    });
  };

  return (
    <main className="min-h-screen p-8 font-mono bg-[#282828] text-[#ebdbb2]">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-[#b8bb26] mb-4">Skribbl Lobby</h1>

        {/* Connection Status */}
        <div className="flex justify-between items-center bg-[#3c3836] p-3 rounded border border-[#504945]">
          <div>
            <span className="text-[#a89984]">Status:</span>{" "}
            <span className={`font-bold ${status === 'disconnected' ? 'text-[#fb4934]' : 'text-[#b8bb26]'}`}>
              {status}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-[#a89984]">ID:</span> <span className="text-[#83a598]">{socketId}</span>
          </div>
        </div>

        {/* Controls */}
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
              onClick={handleCreate}
              className="flex-1 bg-[#98971a] hover:bg-[#b8bb26] text-[#282828] font-bold py-2 px-4 rounded transition-colors"
            >
              Create Room
            </button>
            <button
              onClick={handleJoin}
              className="flex-1 bg-[#458588] hover:bg-[#83a598] text-[#282828] font-bold py-2 px-4 rounded transition-colors"
            >
              Join Room
            </button>
          </div>
        </div>

        {/* Logs */}
        <div className="mt-6">
          <h2 className="text-lg font-bold mb-2 text-[#d3869b]">Logs</h2>
          <div className="bg-[#1d2021] border border-[#504945] p-3 rounded text-sm space-y-1 h-48 overflow-y-auto">
            {log.length === 0 ? (
              <div className="text-[#7c6f64] italic">Waiting for events...</div>
            ) : (
              log.map((line, i) => (
                <div key={i} className="text-[#a89984] font-mono whitespace-pre-wrap">
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}