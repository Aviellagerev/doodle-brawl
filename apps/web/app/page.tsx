"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { v4 as uuidv4 } from 'uuid';
import { RoomResponse, RoomState, ChatMessage, RoomSettings } from "../../../packages/shared";
import JoinScreen from "./components/JoinScreen";
import Lobby from "./components/Lobby";
import GameScreen from "./components/game/GameScreen";
import GameOver from "./components/game/GameOver";
import Chat from "./components/game/Chat";
export default function Home() {
  const [status, setStatus] = useState<string>("connecting...");
  const [socketId, setSocketId] = useState<string>("(none)");
  const [log, setLog] = useState<string[]>([]);
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const socketRef = useRef<Socket | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [wordLists, setWordLists] = useState<Record<string, string[]>>({});
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  const addLog = (line: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString([], { hour12: false })}] ${line}`]);
  };

  // Local system line straight into the chat feed (connect/disconnect etc.)
  const addSystem = (text: string) =>
    setMessages((prev) => [...prev, { author: "System", text, kind: "system" }]);

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
    setPlayerId(getPermanentPlayerId());
    socket.on("connect", () => {
      setStatus("connected");
      setSocketId(socket.id ?? "(unknown)");
      addLog(`connected with id ${socket.id}`);
      addSystem("connected");
    });

    socket.on("disconnect", () => {
      setStatus("disconnected");
      addLog("disconnected");
      addSystem("disconnected");
    });

    socket.on("pong", (counter) => {
      addLog(`server response: ${JSON.stringify(counter)}`);
    });
    socket.on("room_update", (room: RoomState) => setRoomState(room));
    socket.on("system_message", (msg: string) => addLog(msg));

    socket.on("chat_message", (m: ChatMessage) => setMessages((prev) => [...prev, m]));
    socket.on("word_meta", (m: Record<string, string[]>) => setWordLists(m));
    socket.on("player_count", (n: number) => setPlayerCount(n));
    return () => {
      socket.disconnect();
    };

  }, []);
  const handleSendMessage = (text: string) => {
  const socket = socketRef.current;
  if (!socket) return;
  socket.emit("send_message", { text });
};

  const handleChooseWord = (word: string) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit("choose_word", { word });

  };
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

  const handleStart = () => {
    const socket = socketRef.current;
    if (!socket || !roomState) return;
    socket.emit("start_game", roomState.roomId);

  };

  const handleUpdateSettings = (settings: RoomSettings) => {
    socketRef.current?.emit("update_settings", settings);
  };

  const handlePlayAgain = () => {
    socketRef.current?.emit("play_again");
  };

  function renderScreen() {
    // level 1: not in a room yet
    if (roomState === null) {
      return <JoinScreen onCreate={handleCreate} onJoin={handleJoin} playerCount={playerCount} />;
    }

    const isHost = roomState.players.find((p) => p.isHost)?.id === playerId;

    // level 2: in a room — pick the screen for the current phase
    switch (roomState.status) {
      case "waiting":
        return <Lobby room={roomState} isHost={isHost} wordLists={wordLists} onLeave={handleLeave} onStart={handleStart} onUpdateSettings={handleUpdateSettings} />;
      case "playing":
        return <GameScreen room={roomState} myPlayerId={playerId} onChooseWord={handleChooseWord} socket={socketRef.current} onLeave={handleLeave} />;
      case "finished":
        return <GameOver room={roomState} isHost={isHost} onPlayAgain={handlePlayAgain} onLeave={handleLeave} />;
    }
  }


  return (
    <main className="paper-bg min-h-screen text-ink">
      {roomState === null ? (
        // full-frame screens (join) own their own layout
        renderScreen()
      ) : (
        // in a room: the screen + chat side by side, stacking on mobile
        <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-4">
          <div className="flex-1 min-w-0">{renderScreen()}</div>
          <Chat messages={messages} onSend={handleSendMessage} />
        </div>
      )}
    </main>
  );
}