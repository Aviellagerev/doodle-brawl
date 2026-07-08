"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { v4 as uuidv4 } from 'uuid';
import { RoomResponse, RoomState } from "../../../packages/shared";
import JoinScreen from "./components/JoinScreen";
import Lobby from "./components/Lobby";
export default function Home() {
  const [status, setStatus] = useState<string>("connecting...");
  const [socketId, setSocketId] = useState<string>("(none)");
  const [log, setLog] = useState<string[]>([]);
  const [roomState, setRoomState] = useState<RoomState | null>(null)
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
    const socket = io(process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001");
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
    socket.on("room_update", (room: RoomState) => setRoomState(room));
    socket.on("system_message", (msg: string) => addLog(msg));

    socket.on("word_pick",(words:string[])=>{
      console.log("only the starting player sees this words",words);
    })

    return () => {
      socket.disconnect();
    };

  }, []);

  const handleCreate = (name: string) => {
    const socket = socketRef.current;
    if (!socket || !name) {
      addLog("Error: Name is required to create a room.");
      return;
    }
    addLog(`Creating room for ${name}...`);

    socket.emit("create_room", { id: getPermanentPlayerId(), name }, (res: RoomResponse) => {
      if (res.success) {
        setRoomState(res.room ?? null)
        setStatus(`Rooms ID: ${res.roomId}`);
      }
    });
  };

  const handleJoin = (name: string, code: string) => {
    const socket = socketRef.current;
    if (!socket || !name || !code) {
      addLog("Error: Name and Room Code are required to join.");
      return;
    }
    addLog(`${name} attempting to join room: ${code}...`);

    socket.emit("join_room", { id: getPermanentPlayerId(), name, code }, (res: RoomResponse) => {
      if (res.success) {
        setRoomState(res.room ?? null)
        setStatus(`Rooms ID: ${res.roomId}`);
      }
    });
  };
  const handleLeave = () => {
    const socket = socketRef.current;
    if (!socket || !roomState) return;               // guard: need socket + a room
    socket.emit("leave_room",
      { id: getPermanentPlayerId(), roomId: roomState.roomId },
      () => setRoomState(null)                        // ← back to JoinScreen
    );
  };

  const handleStart = () =>{
       const socket = socketRef.current;
       if (!socket || !roomState) return; 
       socket.emit("start_game",roomState.roomId);
       

  };

  function renderScreen() {
    // level 1: not in a room yet
    if (roomState === null) {
      return <JoinScreen onCreate={handleCreate} onJoin={handleJoin} />;
    }

    // level 2: in a room — pick the screen for the current phase
    switch (roomState.status) {
      case "waiting":
        return <Lobby room={roomState} onLeave={handleLeave} onStart={handleStart}/>;
    }
  }


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
        {renderScreen()}

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