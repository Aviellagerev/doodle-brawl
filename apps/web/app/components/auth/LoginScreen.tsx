"use client";

import { useState } from "react";
import { Night, Starfield, Card, Tape, InkEyebrow, Btn, Ghost, DashDivider } from "../ui/Bits";
import { LogoTile, Wordmark } from "../ui/Logo";
import { TextField, SecretField, ErrorLine, FootLink } from "./AuthBits";

type Props = {
  authError?: string | null;
  onLogin: (email: string, password: string) => void | Promise<void>;
  onGoSignup: () => void;
  onCancel: () => void;
};

/** Enter the guild — for wizards who already have papers. */
export default function LoginScreen({ authError, onLogin, onGoSignup, onCancel }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [edited, setEdited] = useState(false);
  const error = edited ? null : authError;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setEdited(false);
    try { await onLogin(email.trim(), password); } finally { setBusy(false); }
  }

  return (
    <Night
      className="relative grid place-items-center px-4 py-10 sm:px-8"
      glow="rgba(255,214,140,.16)" x="50%" y="12%"
      bloom="oklch(0.45 0.16 320 / .3)" bloomX="85%" bloomY="84%"
    >
      <Starfield top={130} left={40} />

      <div className="relative z-10 w-full max-w-[430px]">
        <div className="flex flex-col items-center gap-4 mb-7">
          <LogoTile size={86} fill="magenta" />
          <div className="text-center">
            <Wordmark size={38} onNight />
          </div>
        </div>

        <Card className="relative p-[26px] sm:p-[32px]" tilt={-0.9} radius="20px 15px 22px 14px">
          <form onSubmit={submit}>
            <Tape w={108} h={30} rotate={-2} top={-16} />

            <InkEyebrow dim={0.45} size={10} className="mt-1">the guild remembers you</InkEyebrow>
            <h2 className="display m-0 mt-2 mb-6" style={{ fontSize: 38, color: "var(--ink-warm)" }}>Enter the guild</h2>

            <div className="flex flex-col gap-5">
              <TextField
                label="Sigil (email)"
                type="email"
                value={email}
                onChange={(v) => { setEmail(v); setEdited(true); }}
                placeholder="gorbo@thefens.example"
                autoComplete="email"
                size={19}
              />
              <SecretField
                value={password}
                onChange={(v) => { setPassword(v); setEdited(true); }}
                placeholder="••••••••"
                autoComplete="current-password"
                size={19}
              />
            </div>

            {error && <ErrorLine text={error} />}

            <Btn type="submit" tone="magenta" onLight className="w-full mt-7" size={24} radius="34px 28px 32px 30px" disabled={busy}>
              {busy ? "…" : "CAST ME IN ✦"}
            </Btn>

            <p className="text-center m-0 mt-4" style={{ fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 13, color: "rgba(58,47,38,.5)" }}>
              forgotten the word? it happens to the best of us
            </p>
          </form>
        </Card>

        <div className="my-6">
          <DashDivider label="or" />
        </div>

        <Ghost onClick={onCancel} className="w-full" style={{ minHeight: 52 }}>
          play as a wandering stranger
        </Ghost>

        <FootLink lead="no account?" action="conjure one" onClick={onGoSignup} />
      </div>
    </Night>
  );
}
