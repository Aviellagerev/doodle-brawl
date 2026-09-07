"use client";

import { useState } from "react";
import ThemeToggle from "./ThemeToggle";
import { initialsOf, colorOf } from "../lib/avatar";
import type { PublicUser } from "../../../../packages/shared";

type JoinScreenProps = {
  onCreate: (name: string) => void;
  onJoin: (name: string, code: string) => void;
  playerCount?: number | null;
  joinError?: string | null;
  inviteCode?: string | null;
  user?: PublicUser | null;      // null = playing as a guest
  onLogout: () => void | Promise<void>;
  onOpenLogin: () => void;
  onOpenSignup: () => void;
  onOpenHistory: () => void;
};


export default function JoinScreen({ onCreate, onJoin, playerCount, joinError, inviteCode, user, onLogout, onOpenLogin, onOpenSignup, onOpenHistory }: JoinScreenProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [blob, setBlob] = useState(0);      // reroll counter for the avatar colour
  const [showHelp, setShowHelp] = useState(false);
  const [nameError, setNameError] = useState(false);   // set when an action is attempted with an empty name

  const hardShadow = (x: number, y: number) => ({ boxShadow: `${x}px ${y}px 0 var(--outline)` });
  // shared look for the small header buttons — sized so login + signup + theme
  // still fit on one row at 390px (Samsung A53) without wrapping onto the logo
  const chip = { border: "2.5px solid var(--outline)", borderRadius: 12, ...hardShadow(3, 3), padding: "7px 11px", fontSize: 12 };

  // Guard onCreate/onJoin behind a name check; returns true when the name is valid.
  const requireName = () => {
    if (!name.trim()) {
      setNameError(true);
      return false;
    }
    return true;
  };
  const tryJoin = () => { if (requireName()) onJoin(name, code); };
  const tryCreate = () => { if (requireName()) onCreate(name); };
  // invite mode: name is the only field; the room code comes from the invite link.
  const invite = !!inviteCode;
  const tryInviteJoin = () => { if (inviteCode && requireName()) onJoin(name, inviteCode); };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      {/* header — in normal flow, not absolute, so it can never sit on top of the wordmark */}
      <header className="flex items-center justify-end gap-2 flex-none px-4 pt-4 sm:px-6 sm:pt-5">
        {user ? (
          <>
            <span className="font-loud text-ink/60 max-w-[110px] sm:max-w-[150px] truncate" style={{ fontWeight: 700, fontSize: 12.5 }}>
              {user.username || user.email}
            </span>
            <button onClick={onLogout} className="font-bold cursor-pointer bg-card text-ink whitespace-nowrap" style={chip}>
              Log out
            </button>
          </>
        ) : (
          <>
            <span className="font-loud text-ink/45 hidden sm:inline" style={{ fontWeight: 700, fontSize: 12 }}>already playing?</span>
            <button onClick={onOpenLogin} className="font-bold cursor-pointer bg-card text-ink whitespace-nowrap" style={chip}>
              Log in
            </button>
            <button onClick={onOpenSignup} className="font-bold cursor-pointer bg-lime text-ink whitespace-nowrap" style={chip}>
              Sign up
            </button>
          </>
        )}
        <ThemeToggle />
      </header>

      <div className="flex-1 flex items-center justify-center gap-8 sm:gap-14 flex-wrap px-4 pt-6 pb-8 sm:px-10 sm:pb-10">
        {/* left — wordmark, tagline, stat stickers */}
        <div className="w-full max-w-[430px]">
          <div className="relative inline-block mb-3.5" style={{ transform: "rotate(-2deg)" }}>
            <span
              className="tape absolute"
              style={{ top: -13, left: -14, width: 78, height: 26, transform: "rotate(-14deg)" }}
            />
            <h2 className="font-loud m-0" style={{ fontWeight: 800, fontSize: "clamp(46px, 12.5vw, 74px)", lineHeight: 0.92, letterSpacing: "-1px" }}>
              Doodle
              <br />
              <span className="text-orange">Brawl</span>
            </h2>
          </div>
          <p className="font-loud italic text-ink/60 m-0 mb-6" style={{ fontWeight: 700, fontSize: 19, lineHeight: 1.35, maxWidth: 340 }}>
            Draw badly. Guess loudly. Win somehow.
          </p>
          <div className="flex gap-2 flex-wrap items-center">
            <span
              className="bg-lime text-ink px-3 py-1.5 font-bold text-xs"
              style={{ border: "2.5px solid var(--outline)", borderRadius: 11, ...hardShadow(3, 3), transform: "rotate(-1.5deg)" }}
            >
              {playerCount == null ? "…" : playerCount.toLocaleString()} playing now
            </span>
            <span
              className="bg-card text-ink px-3 py-1.5 font-bold text-xs"
              style={{ border: "2.5px solid var(--outline)", borderRadius: 11, ...hardShadow(3, 3), transform: "rotate(1.5deg)" }}
            >
              up to 12 per room
            </span>
          </div>

          {/* the two real actions of this column, grouped so the stickers above stay labels */}
          <div className="mt-7 max-w-[380px] flex gap-2 items-stretch">
            <span className="inline-block flex-1 min-w-0" style={{ transform: "rotate(0.4deg)" }}>
              <button
                type="button"
                onClick={onOpenHistory}
                className="w-full h-full font-bold cursor-pointer bg-card text-ink transition-transform hover:-translate-y-[1.5px] active:translate-y-[2px]"
                style={{ border: "2.5px solid var(--outline)", borderRadius: 12, ...hardShadow(3, 3), padding: "11px 14px", fontSize: 13.5 }}
              >
                📜 Your match history
              </button>
            </span>
            <span className="inline-block flex-none" style={{ transform: "rotate(-0.8deg)" }}>
              <button
                type="button"
                onClick={() => setShowHelp(true)}
                className="w-full h-full font-bold cursor-pointer bg-orange text-card whitespace-nowrap inline-flex items-center gap-1.5 transition-transform hover:-translate-y-[1.5px] active:translate-y-[2px]"
                style={{ border: "2.5px solid var(--outline)", borderRadius: 12, ...hardShadow(3, 3), padding: "11px 13px 11px 11px", fontSize: 13.5 }}
              >
                <span className="grid place-items-center rounded-full bg-card text-orange flex-none"
                  style={{ width: 17, height: 17, fontSize: 11.5, fontWeight: 800, lineHeight: 1 }}>?</span>
                How to play
              </button>
            </span>
          </div>
        </div>

        {/* right — the card */}
        <div
          className="relative bg-card box-border w-full max-w-[436px] p-[22px] sm:p-[30px] sm:pb-7"
          style={{ transform: "rotate(1deg)", borderRadius: "10px 26px 12px 24px", boxShadow: "0 16px 34px rgba(58,47,38,.18)" }}
        >
          <span
            className="tape absolute"
            style={{ top: -15, left: "50%", transform: "translateX(-50%) rotate(-2deg)", width: 118, height: 30 }}
          />

          {/* invite mode heading — the room code came from the link, so we only ask for a name */}
          {invite && (
            <div style={{ margin: "8px 0 4px" }}>
              <span className="font-mono uppercase text-ink/45 block mb-1" style={{ fontWeight: 700, fontSize: 10.5, letterSpacing: ".12em" }}>
                You're invited
              </span>
              <h3 className="font-loud m-0" style={{ fontWeight: 800, fontSize: 26, lineHeight: 1.1 }}>
                Join room{" "}
                <span dir="auto" className="text-orange" style={{ letterSpacing: ".08em" }}>{inviteCode}</span>
              </h3>
            </div>
          )}

          {/* name + avatar */}
          <div className="flex gap-3 sm:gap-4 items-center" style={{ margin: "12px 0 18px" }}>
            <div className="relative flex-none">
              <div
                className="grid place-items-center font-loud text-card w-20 h-20 sm:w-24 sm:h-24 text-[26px] sm:text-[30px]"
                style={{ borderRadius: "50%", background: colorOf(name, blob), boxShadow: "0 0 0 3px var(--card), 0 0 0 6px var(--outline)", fontWeight: 800, transform: "rotate(3deg)" }}
              >
                {initialsOf(name)}
              </div>
              <button
                onClick={() => setBlob((b) => b + 1)}
                title="New look"
                className="absolute grid place-items-center cursor-pointer font-bold bg-lime text-ink"
                style={{ right: -8, bottom: -8, width: 34, height: 34, border: "2.5px solid var(--outline)", borderRadius: 12, boxShadow: "2px 2px 0 var(--outline)", fontSize: 15 }}
              >
                ↻
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <label className="block mb-1.5 font-mono uppercase text-ink/45" style={{ fontWeight: 700, fontSize: 10.5, letterSpacing: ".12em" }}>
                Your name
              </label>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); if (nameError) setNameError(false); }}
                placeholder="Jelly Bandit"
                className="font-loud w-full bg-transparent outline-none text-ink border-b-[3px] border-dashed border-ink/40 placeholder:text-ink/30 text-[21px] sm:text-[24px]"
                style={{ padding: "2px 2px 9px", fontWeight: 700 }}
              />
              {nameError && (
                <span
                  className="inline-block mt-2 font-bold bg-card text-rose"
                  style={{ border: "2px solid var(--rose)", borderRadius: 9, padding: "3px 9px", fontSize: 12, transform: "rotate(-1.5deg)" }}
                >
                  pick a name first
                </span>
              )}
            </div>
          </div>

          {/* room code — hidden in invite mode (the code comes from the link) */}
          {!invite && (
            <>
              <label className="block mb-1.5 font-mono uppercase text-ink/45" style={{ fontWeight: 700, fontSize: 10.5, letterSpacing: ".12em" }}>
                Room code
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PLZ-4NT"
                className="font-loud w-full box-border outline-none paper-bg text-ink border-[2.5px] border-dashed border-ink/35 placeholder:text-ink/30 mb-5"
                style={{ borderRadius: 14, padding: "13px 15px", fontWeight: 700, fontSize: 19, letterSpacing: ".2em" }}
              />
            </>
          )}

          {/* server-side error (e.g. room not found), shown inline above the actions */}
          {joinError && (
            <div
              className="font-bold bg-card text-rose mb-4"
              style={{ border: "2px solid var(--rose)", borderRadius: 10, padding: "8px 12px", fontSize: 13, transform: "rotate(-0.8deg)" }}
            >
              {joinError}
            </div>
          )}

          {/* actions */}
          {invite ? (
            // invite mode: a single primary button that joins the linked room
            <button
              onClick={tryInviteJoin}
              className="font-loud w-full text-card cursor-pointer bg-orange text-[22px] sm:text-[24px]"
              style={{ border: "3px solid var(--outline)", borderRadius: "34px 30px 34px 28px", padding: "16px 0", fontWeight: 800, ...hardShadow(5, 6) }}
            >
              Join <span dir="auto">{inviteCode}</span>
            </button>
          ) : (
            // normal mode: join the entered code, or make a fresh room
            <>
              <button
                onClick={tryJoin}
                className="font-loud w-full mb-3 text-card cursor-pointer bg-orange text-[24px] sm:text-[27px]"
                style={{ border: "3px solid var(--outline)", borderRadius: "34px 30px 34px 28px", padding: "16px 0", fontWeight: 800, ...hardShadow(5, 6) }}
              >
                Play now!
              </button>
              <button
                onClick={tryCreate}
                className="font-loud w-full text-ink cursor-pointer bg-card text-[16px] sm:text-[17px]"
                style={{ border: "3px solid var(--outline)", borderRadius: "30px 34px 28px 34px", padding: "13px 0", fontWeight: 700, ...hardShadow(5, 6) }}
              >
                Make a room
              </button>
            </>
          )}
        </div>
      </div>

      {showHelp && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4 sm:p-5"
          style={{ background: "rgba(58,47,38,.45)" }}
          onClick={() => setShowHelp(false)}
        >
          <div
            className="relative bg-card w-full max-w-[420px] p-[22px] sm:p-[26px]"
            onClick={(e) => e.stopPropagation()}
            style={{ border: "3px solid var(--outline)", borderRadius: "18px 8px 20px 10px", boxShadow: "0 16px 34px rgba(58,47,38,.3)", transform: "rotate(-1deg)" }}
          >
            <span className="tape absolute" style={{ top: -13, left: 24, width: 96, height: 26, transform: "rotate(-4deg)" }} />
            <h3 className="font-loud m-0 mb-3" style={{ fontWeight: 800, fontSize: 26 }}>How to play</h3>
            <ul className="m-0 pl-5 text-ink/80 list-disc marker:text-orange space-y-2" style={{ fontSize: 14, lineHeight: 1.55, fontWeight: 500 }}>
              <li>One player draws a secret word — everyone else races to guess it in chat.</li>
              <li>Guess sooner to score more. The drawer earns points for each correct guess.</li>
              <li>Letters get revealed as hints while the clock winds down.</li>
              <li>Most points after the final round wins the brawl.</li>
              <li>Every finished match is saved — drawings and chat included — even when you play as a guest. Sign up to keep that history on an account instead of just this browser.</li>
            </ul>
            <button
              onClick={() => setShowHelp(false)}
              className="font-loud w-full mt-5 text-card cursor-pointer bg-orange"
              style={{ border: "3px solid var(--outline)", borderRadius: "28px 32px 28px 32px", padding: "12px 0", fontWeight: 800, fontSize: 18, ...hardShadow(4, 5) }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
