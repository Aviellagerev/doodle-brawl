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
import { RoomNotFound, RoomFull, Disconnected } from "./components/game/StateScreens";
export default function Home() {
  const [status, setStatus] = useState<string>("connecting...");
  const [socketId, setSocketId] = useState<string>("(none)");
  const [log, setLog] = useState<string[]>([]);
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const socketRef = useRef<Socket | null>(null);
  const roomStateRef = useRef<RoomState | null>(null);   // latest room, readable inside socket handlers
  const [playerId, setPlayerId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [wordLists, setWordLists] = useState<Record<string, string[]>>({});
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  // failed-join state → full-frame RoomNotFound / RoomFull screens
  const [joinFail, setJoinFail] = useState<{ kind: "notfound" | "full"; code: string } | null>(null);
  // dropped connection while in a room → the reconnect overlay
  const [disconnected, setDisconnected] = useState(false);
  const [reconnectSeconds, setReconnectSeconds] = useState(30);

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

  // keep a ref of the room so the (once-bound) socket handlers can read it
  useEffect(() => { roomStateRef.current = roomState; }, [roomState]);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001");
    socketRef.current = socket;
    setPlayerId(getPermanentPlayerId());
    socket.on("connect", () => {
      setStatus("connected");
      setSocketId(socket.id ?? "(unknown)");
      addLog(`connected with id ${socket.id}`);
      const rs = roomStateRef.current;
      if (rs) {
        // socket dropped while we were in a room — rejoin with the stored ids so the
        // server re-binds our new socket to the same player, then drop the overlay.
        const me = rs.players.find((p) => p.id === getPermanentPlayerId());
        socket.emit("join_room", { id: getPermanentPlayerId(), name: me?.name ?? "Player", code: rs.roomId }, (res: RoomResponse) => {
          if (res.success && res.room) setRoomState(res.room);
        });
        setDisconnected(false);
        addSystem("reconnected");
      } else {
        addSystem("connected");
      }
    });

    socket.on("disconnect", () => {
      setStatus("disconnected");
      addLog("disconnected");
      // only surface the overlay if we were actually in a room (not on first load)
      if (roomStateRef.current) {
        setDisconnected(true);
        addSystem("connection lost — reconnecting…");
      }
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

  // reconnect countdown for the overlay's "Reconnect (N)" label
  useEffect(() => {
    if (!disconnected) { setReconnectSeconds(30); return; }
    setReconnectSeconds(30);
    const id = setInterval(() => setReconnectSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [disconnected]);

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
        setJoinFail(null);
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
        setJoinFail(null);
        setRoomState(res.room ?? null)
        setStatus(`Rooms ID: ${res.roomId}`);
      } else {
        // route the server error to the matching full-frame state screen
        const msg = typeof res.error === "string" ? res.error.toLowerCase() : "";
        setJoinFail({ kind: msg.includes("full") ? "full" : "notfound", code });
      }
    });
  };
  const handleLeave = () => {
    const socket = socketRef.current;
    if (!socket || !roomState) return;               // guard: need socket + a room
    socket.emit("leave_room",
      { id: getPermanentPlayerId(), roomId: roomState.roomId },
      () => { setDisconnected(false); setRoomState(null); }   // ← back to JoinScreen
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

  function renderBody() {
    // level 1: not in a room yet
    if (roomState === null) {
      // a join attempt bounced — show the matching error screen instead of the form
      if (joinFail) {
        return (
          <div className="min-h-screen grid place-items-center p-5">
            {joinFail.kind === "full"
              ? <RoomFull onLeave={() => setJoinFail(null)} />
              : <RoomNotFound code={joinFail.code} onRetry={() => setJoinFail(null)} />}
          </div>
        );
      }
      return <JoinScreen onCreate={handleCreate} onJoin={handleJoin} playerCount={playerCount} />;
    }

    const isHost = roomState.players.find((p) => p.isHost)?.id === playerId;

    // the in-game screen owns its own full layout (including the guess feed) so the
    // word and chat stay co-visible on mobile.
    if (roomState.status === "playing") {
      return (
        <GameScreen
          room={roomState}
          myPlayerId={playerId}
          onChooseWord={handleChooseWord}
          socket={socketRef.current}
          onLeave={handleLeave}
          messages={messages}
          onSend={handleSendMessage}
        />
      );
    }

    // lobby / game-over: the screen with the chat sidebar (stacks on mobile)
    const screen = roomState.status === "waiting"
      ? <Lobby room={roomState} isHost={isHost} wordLists={wordLists} onLeave={handleLeave} onStart={handleStart} onUpdateSettings={handleUpdateSettings} />
      : <GameOver room={roomState} isHost={isHost} onPlayAgain={handlePlayAgain} onLeave={handleLeave} />;

    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-4">
        <div className="flex-1 min-w-0">{screen}</div>
        <Chat messages={messages} onSend={handleSendMessage} />
      </div>
    );
  }

  return (
    <main className="paper-bg min-h-screen text-ink">
      {renderBody()}

      {/* dropped-connection overlay — socket.io auto-reconnects; the button forces it */}
      {disconnected && roomState && (
        <div className="fixed inset-0 z-50 grid place-items-center p-5" style={{ background: "rgba(58,47,38,.55)" }}>
          <div
            className="w-full max-w-[460px] overflow-hidden"
            style={{ border: "3px solid var(--outline)", borderRadius: "18px 8px 20px 10px", boxShadow: "0 16px 34px rgba(58,47,38,.35)" }}
          >
            <Disconnected
              secondsLeft={reconnectSeconds}
              onReconnect={() => socketRef.current?.connect()}
              onGiveUp={() => { setDisconnected(false); setRoomState(null); }}
            />
          </div>
        </div>
      )}
    </main>
  );
}
