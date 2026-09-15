"use client";

import { useState, useSyncExternalStore } from "react";
import Avatar from "./Avatar";
import { Night, Starfield, Card, Tape, Eyebrow, InkEyebrow, Btn, Btn2, Ghost, DashDivider } from "./ui/Bits";
import { Wordmark } from "./ui/Logo";
import CandleOrnament from "./ui/CandleOrnament";
import { subscribeMyAvatar, getMyAvatar, getServerAvatar, rerollMyAvatar } from "../lib/myAvatar";
import type { PublicUser } from "../../../../packages/shared";

type JoinScreenProps = {
  onCreate: (name: string, emphasizeCode?: boolean) => void;
  onJoin: (name: string, code: string) => void;
  playerCount?: number | null;
  joinError?: string | null;
  inviteCode?: string | null;
  user?: PublicUser | null;      // null = playing as a wandering stranger
  onLogout: () => void | Promise<void>;
  onOpenLogin: () => void;
  onOpenSignup: () => void;
  onOpenHistory: () => void;
};

/** 01 · Enter the guild. */
export default function JoinScreen({ onCreate, onJoin, playerCount, joinError, inviteCode, user, onLogout, onOpenLogin, onOpenSignup, onOpenHistory }: JoinScreenProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const mine = useSyncExternalStore(subscribeMyAvatar, getMyAvatar, getServerAvatar);   // rolled once, kept until rerolled
  const [showHelp, setShowHelp] = useState(false);
  const [nameError, setNameError] = useState(false);

  const requireName = () => {
    if (!name.trim()) { setNameError(true); return false; }
    return true;
  };
  // both doors make a room — the private one lands in the lobby with the code
  // emphasised, which is the only difference the handoff draws between them
  const tryQuick = () => { if (requireName()) onCreate(name); };
  const tryPrivate = () => { if (requireName()) onCreate(name, true); };
  const tryJoin = () => { if (requireName()) onJoin(name, code); };
  const invite = !!inviteCode;
  const tryInviteJoin = () => { if (inviteCode && requireName()) onJoin(name, inviteCode); };

  return (
    <Night
      className="relative flex flex-col overflow-x-hidden"
      glow="rgba(255,214,140,.16)" x="30%" y="22%"
      bloom="oklch(0.45 0.16 320 / .32)" bloomX="78%" bloomY="78%"
    >
      <Starfield top={120} left={56} wide />
      <span
        aria-hidden
        className="absolute pointer-events-none"
        style={{ bottom: -90, left: -70, width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, oklch(0.6 0.18 300 / .35), transparent 65%)" }}
      />

      {/* already sworn in? */}
      <header className="relative z-10 flex items-center justify-between gap-3 flex-none px-4 pt-4 sm:px-7 sm:pt-6">
        <Ghost onClick={onOpenHistory} title="the chronicle" style={{ minHeight: 42, padding: "0 16px", fontWeight: 700, fontSize: 12.5 }}>
          📜<span className="ml-2">the chronicle</span>
        </Ghost>

        <div className="flex items-center gap-3">
        {user ? (
          <>
            <span
              className="max-w-[110px] sm:max-w-[170px] truncate"
              style={{ fontFamily: "var(--font-loud)", fontWeight: 700, fontSize: 12.5, color: "rgba(242,227,191,.55)" }}
            >
              {user.username || user.email}
            </span>
            <Ghost onClick={onLogout} style={{ minHeight: 42, padding: "0 20px", fontWeight: 800, fontSize: 13 }}>abjure</Ghost>
          </>
        ) : (
          <>
            <span className="hidden sm:inline" style={{ fontWeight: 600, fontSize: 12.5, color: "rgba(242,227,191,.5)" }}>
              already sworn in?
            </span>
            <Ghost onClick={onOpenLogin} style={{ minHeight: 42, padding: "0 20px", fontWeight: 800, fontSize: 13 }}>log in</Ghost>
          </>
        )}
        </div>
      </header>

      <div className="relative z-10 flex-1 grid place-items-center px-4 pb-10 pt-4 sm:px-8">
        <div className="w-full max-w-[612px]">
          {/* mobile: the wordmark sits on night, above the card */}
          <div className="md:hidden text-center mb-6">
            <Eyebrow dim={0.42} size={9.5} style={{ letterSpacing: ".3em" }}>est. the third age of doodling</Eyebrow>
            <div className="mt-2">
              <Wordmark size={50} onNight />
            </div>
            <p className="m-0 mt-3" style={{ fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 14.5, color: "rgba(242,227,191,.55)" }}>
              Cast badly. Divine loudly. Ascend anyway.
            </p>
          </div>

          <Card
            className="torn-md relative box-border w-full p-[26px] sm:p-[34px] md:p-[44px_46px_40px]"
            tilt={-1.1}
            radius={18}
          >
            <Tape w={124} h={34} rotate={1.6} top={-19} />

            {/* desktop heading, inside the card */}
            <div className="hidden md:block text-center" style={{ marginBottom: 26 }}>
              <InkEyebrow dim={0.42} size={11} style={{ letterSpacing: ".34em" }}>est. the third age of doodling</InkEyebrow>
              <h1 className="display m-0" style={{ margin: "6px 0 2px", fontSize: 66, lineHeight: 0.9, color: "var(--ink-warm)" }}>
                Scrawl <span style={{ color: "var(--magenta-deep)" }}>&amp;</span> Sorcery
              </h1>
              <p className="m-0" style={{ marginTop: 8, fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 17, lineHeight: 1.3, color: "rgba(58,47,38,.62)" }}>
                Cast badly. Divine loudly. Ascend anyway.
              </p>
            </div>

            {invite && (
              <div className="mb-5">
                <InkEyebrow dim={0.45} size={10}>the circle has summoned you</InkEyebrow>
                <h2 className="display m-0 mt-1.5" style={{ fontSize: 32, color: "var(--ink-warm)" }}>
                  Join <span dir="auto" style={{ color: "var(--magenta-deep)", letterSpacing: ".08em" }}>{inviteCode}</span>
                </h2>
              </div>
            )}

            {/* the apprentice */}
            <div className="flex items-center gap-4 md:gap-[18px]" style={{ marginBottom: 24 }}>
              <div className="relative flex-none">
                <span className="md:hidden inline-grid">
                  <Avatar name={name || "apprentice"} avatar={mine} size={88} ring surface="parchment" />
                </span>
                <span className="hidden md:inline-grid">
                  <Avatar name={name || "apprentice"} avatar={mine} size={104} ring surface="parchment" />
                </span>
                <button
                  onClick={rerollMyAvatar}
                  title="another look"
                  className="absolute grid place-items-center cursor-pointer"
                  style={{
                    right: -12, bottom: -6, width: 38, height: 38,
                    border: "2.5px solid var(--ink-warm)", borderRadius: "13px 11px 14px 10px",
                    background: "var(--green)", color: "var(--ink-warm)",
                    boxShadow: "2px 2px 0 var(--ink-warm)", fontSize: 16, fontWeight: 700,
                  }}
                >
                  ↻
                </button>
              </div>

              <div className="flex-1 min-w-0">
                <InkEyebrow dim={0.45} size={10.5} className="mb-1.5" style={{ letterSpacing: ".12em" }}>Thy name, apprentice</InkEyebrow>
                <input
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (nameError) setNameError(false); }}
                  placeholder="Gorbo the Damp"
                  maxLength={24}
                  className={`field ${nameError ? "field-invalid" : ""}`}
                  style={{ fontSize: "clamp(16px, 4.6vw, 25px)" }}
                />
                {nameError ? (
                  <p className="m-0 mt-2" style={{ fontWeight: 600, fontSize: 11.5, color: "var(--red)" }}>
                    a wizard without a name divines nothing
                  </p>
                ) : (
                  <p className="m-0" style={{ marginTop: 9, fontWeight: 500, fontSize: 12, lineHeight: 1, color: "rgba(58,47,38,.45)" }}>
                    ↻ conjures a new familiar
                  </p>
                )}
              </div>
            </div>

            {joinError && (
              <p className="m-0 mb-4" style={{ fontWeight: 600, fontSize: 12, color: "var(--red)" }}>{joinError}</p>
            )}

            {invite ? (
              <Btn tone="magenta" className="w-full" size={24} radius="34px 30px 34px 28px" onClick={tryInviteJoin}>
                CAST ME IN ✦
              </Btn>
            ) : (
              <>
                <Btn tone="magenta" className="w-full" size={26} radius="34px 30px 34px 28px" style={{ minHeight: 62 }} onClick={tryQuick}>
                  CAST ME IN ✦
                </Btn>
                <Btn2 className="w-full mt-3" size={16} radius="30px 34px 28px 32px" onClick={tryPrivate}>
                  summon a private circle
                </Btn2>

                <div className="my-5">
                  <DashDivider label="or speak the word" night={false} />
                </div>

                <div className="flex gap-2.5 items-stretch">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") tryJoin(); }}
                    placeholder="ᛗ Ø R B — 4 2"
                    className="field-box flex-1 min-w-0"
                    style={{ fontSize: "clamp(14px, 4.2vw, 17px)", letterSpacing: ".14em", minHeight: 52 }}
                    dir="auto"
                  />
                  <Btn
                    tone="teal"
                    size={20}
                    radius="16px 20px 14px 18px"
                    onClick={tryJoin}
                    style={{ minHeight: 52, padding: "0 20px", boxShadow: "3px 3px 0 var(--ink-warm)" }}
                  >
                    GO
                  </Btn>
                </div>
              </>
            )}
          </Card>

          {playerCount != null && (
            <p className="lg:hidden text-center m-0 mt-6" style={{ fontWeight: 600, fontSize: 12, color: "rgba(242,227,191,.35)" }}>
              {playerCount.toLocaleString()} {playerCount === 1 ? "wizard is" : "wizards are"} awake in the third age
            </p>
          )}

          {!user && (
            <div className="sm:hidden flex items-center justify-center gap-2.5 mt-7">
              <span style={{ fontWeight: 600, fontSize: 12.5, color: "rgba(242,227,191,.5)" }}>no papers yet?</span>
              <button onClick={onOpenSignup} className="cursor-pointer underline" style={{ background: "transparent", border: 0, fontFamily: "var(--font-loud)", fontWeight: 700, fontSize: 13, color: "var(--gold-bright)" }}>
                conjure an account
              </button>
            </div>
          )}
        </div>
      </div>

      {/* the corners: what the guild remembers, and what it is burning */}
      <button
        onClick={() => setShowHelp(true)}
        className="absolute z-10 cursor-pointer"
        style={{ left: 22, bottom: 26, background: "transparent", border: 0, fontWeight: 600, fontSize: 12.5, color: "rgba(242,227,191,.5)" }}
      >
        the rules of the rite
      </button>

      <span className="hidden lg:block">
        <CandleOrnament playerCount={playerCount} />
      </span>

      {showHelp && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 fade-in" style={{ background: "rgba(13,7,24,.7)" }} onClick={() => setShowHelp(false)}>
          <Card
            className="relative w-full max-w-[440px] p-[24px] sm:p-[28px]"
            tilt={-1}
            radius="20px 14px 22px 12px"
            style={{ boxShadow: "6px 7px 0 rgba(0,0,0,.5)" }}
          >
            <div onClick={(e) => e.stopPropagation()}>
              <Tape w={96} h={26} rotate={-4} top={-13} left={24} />
              <InkEyebrow dim={0.45} size={10} className="mt-1">the rules of the rite</InkEyebrow>
              <h3 className="display m-0 mt-1.5 mb-4" style={{ fontSize: 34, color: "var(--ink-warm)" }}>How one plays</h3>
              <ul className="m-0 pl-5 list-disc space-y-2.5" style={{ color: "rgba(58,47,38,.75)", fontSize: 13.5, lineHeight: 1.5, fontWeight: 600 }}>
                <li>Each round one wizard is the <b>caster</b>: they pick a spell and draw it, badly.</li>
                <li>Everyone else <b>divines</b> — type your guess into the murmurings. Sooner is worth more.</li>
                <li>Letters surface as the candle burns. The caster earns from every wizard who gets it.</li>
                <li>Highest score when the candles go out <b>ascends</b>, and is insufferable about it.</li>
                <li>Every rite is written to the chronicle — even for wandering strangers. An account keeps it beyond this browser.</li>
              </ul>
              <Btn tone="gold" className="w-full mt-6" size={20} radius="28px 32px 26px 30px" onClick={() => setShowHelp(false)}>
                UNDERSTOOD
              </Btn>
            </div>
          </Card>
        </div>
      )}
    </Night>
  );
}
