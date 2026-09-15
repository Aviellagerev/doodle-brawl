"use client";

import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { RoomResponse, RoomState, ChatMessage, RoomSettings, PublicUser, MatchSummary, PlayerStats, MatchDetail } from "../../../packages/shared";
import JoinScreen from "./components/JoinScreen";
import Lobby from "./components/Lobby";
import GameScreen from "./components/game/GameScreen";
import GameOver from "./components/game/GameOver";
import Chat from "./components/game/Chat";
import { Fizzled, JOIN_ERRORS } from "./components/game/StateScreens";
import { Night } from "./components/ui/Bits";
import { getMyAvatar } from "./lib/myAvatar";
import HistoryScreen from "./components/HistoryScreen";
import LoginScreen from "./components/auth/LoginScreen";
import SignupScreen from "./components/auth/SignupScreen";
import MatchDetailScreen from "./components/MatchDetailScreen";

const SERVER = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";
const PAGE = 20;   // the handoff pages the chronicle 20 rites at a time
export default function Home() {
  const [roomState, setRoomState] = useState<RoomState | null>(null)
  const socketRef = useRef<Socket | null>(null);
  const roomStateRef = useRef<RoomState | null>(null);   // latest room, readable inside socket handlers
  const playerIdRef = useRef("");                        // ditto, for the identity check
  const [playerId, setPlayerId] = useState("");
const [user, setUser] = useState<PublicUser | null>(null);
const [authError, setAuthError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [authView, setAuthView] = useState<null | "login" | "signup">(null);
  const [history, setHistory] = useState<MatchSummary[]>([]);
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(PAGE);
  const [historyDone, setHistoryDone] = useState(false);
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [wordLists, setWordLists] = useState<Record<string, string[]>>({});
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  // failed-join state → full-frame RoomNotFound / RoomFull screens
  const [joinFail, setJoinFail] = useState<{ kind: "notfound" | "full"; code: string } | null>(null);
 const [disconnected, setDisconnected] = useState(false);
  const [reconnectSeconds, setReconnectSeconds] = useState(30);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [emphasizeCode, setEmphasizeCode] = useState(false);

  // Debug trail only. This used to be React state that nothing rendered, so
  // every socket event re-rendered the whole app and grew an array for ever.
  const addLog = (line: string) => console.debug("[scrawl]", line);

 
  const addSystem = (text: string) =>
    setMessages((prev) => [...prev, { author: "System", text, kind: "system" }]);


  useEffect(() => { roomStateRef.current = roomState; }, [roomState]);
  useEffect(() => { playerIdRef.current = playerId; }, [playerId]);

  
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("room");
    if (code) setInviteCode(code.toUpperCase());
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
     
      const meRes = await fetch(`${SERVER}/api/me`, { credentials: "include" });
      const meJson = await meRes.json();
      if (cancelled) return;
      const myId: string = meJson.playerId ?? "";   // "" = a visitor the server has never met
      setPlayerId(myId);
      playerIdRef.current = myId;
      setUser(meJson.user ?? null);
      const socket = io(SERVER, { withCredentials: true });
      socketRef.current = socket;
      socket.on("connect", () => {
        addLog(`connected with id ${socket.id}`);
        const rs = roomStateRef.current;
        if (rs) {

          const me = rs.players.find((p) => p.id === playerIdRef.current);
          socket.emit("join_room", { name: me?.name ?? "Player", code: rs.roomId, avatar: getMyAvatar() }, (res: RoomResponse) => {
            if (res.success && res.room) setRoomState(res.room);
          });
          setDisconnected(false);
          addSystem("the circle has you again");
        } else {
          addSystem("the circle is open");
        }
      });

      socket.on("disconnect", () => {
        addLog("disconnected");
        // only surface the overlay if we were actually in a room (not on first load)
        if (roomStateRef.current) {
          setDisconnected(true);
          addSystem("the thread frayed — reaching for you…");
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
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  // reconnect countdown for the overlay's "Reconnect (N)" label
  useEffect(() => {
    if (!disconnected) { setReconnectSeconds(30); return; }
    setReconnectSeconds(30);
    const id = setInterval(() => setReconnectSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [disconnected]);

  /** Wait for the socket to come back up after a cookie change. */
  const reconnectAndWait = () => new Promise<void>((resolve) => {
    const s = socketRef.current;
    if (!s) return resolve();
    const done = () => { s.off("connect", done); resolve(); };
    s.once("connect", done);
    s.disconnect();
    s.connect();
    setTimeout(done, 4000);
  });

  /**
   * Become someone, if we are not already.
   *
   * Looking at the front page mints nothing — the server only knows you once
   * you summon a circle or walk into one. The new cookie arrives over HTTP, so
   * the socket has to shake hands again before it counts as anyone.
   */
  const ensureIdentity = async (): Promise<string | null> => {
    if (playerIdRef.current) return playerIdRef.current;
    try {
      const res = await fetch(`${SERVER}/api/me`, { method: "POST", credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      const id: string = data.playerId;
      setPlayerId(id);
      playerIdRef.current = id;
      setUser(data.user ?? null);
      await reconnectAndWait();
      return id;
    } catch {
      return null;
    }
  };

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
  const handleCreate = async (name: string, emphasizeCode = false) => {
    const socket = socketRef.current;
    if (!socket || !name) {
      addLog("Error: Name is required to create a room.");
      return;
    }
    if (!(await ensureIdentity())) { setJoinFail({ kind: "notfound", code: "" }); return; }
    addLog(`Creating room for ${name}...`);

    socket.emit("create_room", { name, avatar: getMyAvatar() }, (res: RoomResponse) => {
      if (res.success) {
        setJoinFail(null);
        setRoomState(res.room ?? null)
        setEmphasizeCode(emphasizeCode);   // "summon a private circle" → show the code off
      }
    });
  };

  const handleJoin = async (name: string, code: string) => {
    const socket = socketRef.current;
    if (!socket || !name || !code) {
      addLog("Error: Name and Room Code are required to join.");
      return;
    }
    if (!(await ensureIdentity())) { setJoinFail({ kind: "notfound", code }); return; }
    addLog(`${name} attempting to join room: ${code}...`);

    socket.emit("join_room", { name, code, avatar: getMyAvatar() }, (res: RoomResponse) => {
      if (res.success) {
        setJoinFail(null);
        setRoomState(res.room ?? null)
        // clean the invite param so a refresh doesn't re-trigger the invite flow
        setInviteCode(null);
        window.history.replaceState({}, "", window.location.pathname);
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
      { roomId: roomState.roomId },
      () => { setDisconnected(false); setRoomState(null); }   // ← back to JoinScreen
    );
  };

  const handleStart = () => {
    const socket = socketRef.current;
    if (!socket || !roomState) return;
    socket.emit("start_game", roomState.roomId);

  };
  async function post(path: string, body?: unknown) {
    const res = await fetch(`${SERVER}${path}`, {
      method: "POST",
      credentials: "include",
      // only declare a JSON body when there IS one — Fastify rejects a request
      // that says application/json and then sends nothing (logout has no body)
      ...(body === undefined
        ? {}
        : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
  }
  function authMessage(status: number, data: any): string {
    if (status === 400) {
      const first = data?.details && Object.values(data.details)[0];
      return (first as string) ?? data?.message ?? "Check your details.";
    }
    if (status === 409) return "That email is already registered.";
    if (status === 401) return "Invalid email or password.";
    if (status === 429) return "Too many attempts. Try again in a few minutes.";
    return "Something went wrong. Try again.";
  } 
  // One page at a time, and the two requests land independently so the stats
  // don't wait on the list. Whatever was already fetched stays on screen while
  // a refresh is in flight.
  const fetchHistory = async (limit: number) => {
    setHistoryLoading(true);
    try {
      const rows = await fetch(`${SERVER}/api/history?limit=${limit}`, { credentials: "include" }).then((r) => r.json());
      const list = Array.isArray(rows) ? rows : [];
      setHistory(list);
      setHistoryLimit(limit);
      setHistoryDone(list.length < limit);
    } catch {
      setHistoryDone(true);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = () => {
    setShowHistory(true);
    fetchHistory(PAGE);
    fetch(`${SERVER}/api/stats`, { credentials: "include" })
      .then((r) => r.json())
      .then((st) => setStats(st && typeof st === "object" && "matchesPlayed" in st ? st : null))
      .catch(() => setStats(null));
  };

  const loadOlderRites = () => fetchHistory(historyLimit + PAGE);

  const openMatch = async (id: string) => {
    setDetailOpen(true);
    setMatchDetail(null);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${SERVER}/api/match/${id}`, { credentials: "include" });
      const d = await res.json();
      setMatchDetail(res.ok && d && "turns" in d ? d : null);
    } catch {
      setMatchDetail(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const reconnect = () => {
    const s = socketRef.current;
    if (!s) return;
    s.disconnect();
    s.connect();       // re-runs the handshake → re-reads the cookie
  };
    // NO reconnect — same player, it was claimed not replaced
  const handleSignup = async (email: string, password: string, username: string) => {
    setAuthError(null);
    // signing the register claims the guest you already are, so be someone first
    if (!(await ensureIdentity())) return setAuthError("Could not reach the guild. Try again.");
    const { ok, status, data } = await post("/api/signup", { email, password, username });
    if (!ok) return setAuthError(authMessage(status, data));
    setUser(data.user);
    setPlayerId(data.playerId);
    setAuthView(null);
  };
  const handleLogin = async(email:string,password:string)=>{
    setAuthError(null);
    const { ok, status, data } = await post("/api/login", { email, password });
    if (!ok) return setAuthError(authMessage(status, data));
    setUser(data.user);
    setPlayerId(data.playerId);
    setAuthView(null);
    reconnect();
  }
    const handleLogout = async()=>{
    setAuthError(null);
    const { ok, data} = await post("/api/logout");
    if (!ok) return setAuthError("Could not log out ");
    setUser(null);
    setPlayerId(data.playerId);
    reconnect();
  }

  const handleUpdateSettings = (settings: RoomSettings) => {
    socketRef.current?.emit("update_settings", settings);
  };

  const handlePlayAgain = () => {
    socketRef.current?.emit("play_again");
  };

  function renderBody() {
    // level 1: not in a room yet
    if (authView === "login") {
      return (
        <LoginScreen
          authError={authError}
          onLogin={handleLogin}
          onGoSignup={() => { setAuthError(null); setAuthView("signup"); }}
          onCancel={() => { setAuthError(null); setAuthView(null); }}
        />
      );
    }

    if (authView === "signup") {
      return (
        <SignupScreen
          authError={authError}
          onSignup={handleSignup}
          onGoLogin={() => { setAuthError(null); setAuthView("login"); }}
          onCancel={() => { setAuthError(null); setAuthView(null); }}
        />
      );
    }

    if (detailOpen) {
      return (
        <MatchDetailScreen
          detail={matchDetail}
          loading={historyLoading}
          onClose={() => setDetailOpen(false)}
        />
      );
    }

    if (showHistory) {
      return (
        <HistoryScreen
          matches={history}
          stats={stats}
          user={user}
          loading={historyLoading}
          hasMore={!historyDone}
          onLoadMore={loadOlderRites}
          onOpenMatch={openMatch}
          onClose={() => setShowHistory(false)}
        />
      );
    }

    if (roomState === null) {
      // a bounced join reads on the field itself — the handoff never sends it full-frame
      return <JoinScreen
        onCreate={handleCreate} onJoin={handleJoin}
        playerCount={playerCount} inviteCode={inviteCode}
        joinError={joinFail ? (joinFail.kind === "full" ? JOIN_ERRORS.full : JOIN_ERRORS.notFound) : null}
        user={user} onLogout={handleLogout}
        onOpenLogin={() => { setAuthError(null); setAuthView("login"); }}
        onOpenSignup={() => { setAuthError(null); setAuthView("signup"); }}
        onOpenHistory={openHistory}
      />
    }

    const isHost = roomState.players.find((p) => p.isHost)?.id === playerId;


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
    const waiting = roomState.status === "waiting";
    const screen = waiting
      ? <Lobby room={roomState} isHost={isHost} wordLists={wordLists} onLeave={handleLeave} onStart={handleStart} onUpdateSettings={handleUpdateSettings} onOpenHistory={openHistory} emphasizeCode={emphasizeCode} />
      : <GameOver room={roomState} isHost={isHost} onPlayAgain={handlePlayAgain} onLeave={handleLeave} onOpenHistory={openHistory} />;

    return (
      <Night className="p-4 sm:p-7" glow="rgba(255,214,140,.13)" x="50%" y={waiting ? "0%" : "22%"}>
        <div className="max-w-[1240px] mx-auto flex flex-col lg:flex-row gap-6">
          <div className="flex-1 min-w-0">{screen}</div>
          <div className="flex-none lg:pl-4 lg:border-l-2 lg:border-dashed lg:border-parchment/20 flex">
            <Chat messages={messages} onSend={handleSendMessage} players={roomState.players} />
          </div>
        </div>
      </Night>
    );
  }

  return (
    <main className="flex-1 flex flex-col">
      {renderBody()}

      {/* 09 · the spell fizzled — socket.io auto-reconnects; the button forces it */}
      {disconnected && roomState && (
        <div className="fixed inset-0 z-50 overflow-auto">
          <Fizzled
            secondsLeft={reconnectSeconds}
            code={roomState.roomId}
            onReconnect={() => socketRef.current?.connect()}
            onGiveUp={() => { setDisconnected(false); setRoomState(null); }}
          />
        </div>
      )}
    </main>
  );
}
