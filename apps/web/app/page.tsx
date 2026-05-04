"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

export default function Home() {
  const [status, setStatus] = useState<string>("connecting...");
  const [socketId, setSocketId] = useState<string>("(none)");
  const [log, setLog] = useState<string[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const addLog = (line: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${line}`]);
  };

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
    socket.on("pong",(counter)=>{
      addLog(`button pressed: ${JSON.stringify(counter)}`);
    });
    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendPing = () => {
    console.log("got in");
    const socket = socketRef.current;
    if (!socket) { return };
    addLog("sending ping...");
    socket.emit("ping", { msg: "hello", at: Date.now() }, (response: Response) => {
      addLog(`got response: ${JSON.stringify(response)}`);
    });
  };

  return (
    <main className="min-h-screen p-8 font-mono">
      <h1 className="text-2xl font-bold mb-4">Skribbl WebSocket Test</h1>

      <div className="mb-4 space-y-1">
        <div>Status: <span className="font-bold">{status}</span></div>
        <div>Socket ID: <span className="font-bold">{socketId}</span></div>
      </div>

      <button
        onClick={sendPing}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
      >
        Send Ping
      </button>

      <div className="mt-6">
        <h2 className="text-lg font-bold mb-2">Log:</h2>
        <div className="bg-gray-800 p-3 rounded text-sm space-y-1 max-h-96 overflow-y-auto">
          {log.length === 0 ? (
            <div className="text-gray-500">no events yet</div>
          ) : (
            log.map((line, i) => <div key={i}>{line}</div>)
          )}
        </div>
      </div>
    </main>
  );
}