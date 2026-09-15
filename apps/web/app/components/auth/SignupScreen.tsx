"use client";

import { useState } from "react";
import { Night, Starfield, Card, Tape, InkEyebrow, Btn } from "../ui/Bits";
import { Lockup } from "../ui/Logo";
import { TextField, SecretField, ErrorLine, FootLink } from "./AuthBits";

type Props = {
  authError?: string | null;
  onSignup: (email: string, password: string, username: string) => void | Promise<void>;
  onGoLogin: () => void;
  onCancel: () => void;
};

const BENEFITS: [string, string, string][] = [
  ["1.", "Keep your chronicle", "Every rite, placement and disgrace, recorded."],
  ["2.", "Summon private circles", "Your own grimoire, your own rules."],
  ["3.", "Hoard your familiars", "Unlocked by winning. Mostly by losing."],
];

/** 04 · Register — apprenticeship papers. */
export default function SignupScreen({ authError, onSignup, onGoLogin, onCancel }: Props) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [edited, setEdited] = useState(false);
  const error = edited ? null : authError;

  const matches = confirm.length > 0 && confirm === password;
  const mismatch = confirm.length > 0 && confirm !== password ? "those two words differ" : null;
  const canSubmit = !busy && accepted && matches;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setEdited(false);
    try { await onSignup(email.trim(), password, username.trim()); } finally { setBusy(false); }
  }

  return (
    <Night
      className="relative flex items-center justify-center gap-10 lg:gap-[70px] flex-wrap px-5 py-12 lg:px-[90px]"
      glow="rgba(255,214,140,.14)" x="30%" y="18%"
      bloom="oklch(0.45 0.16 320 / .3)"
    >
      <Starfield top={110} left={60} wide />

      <Card
        className="torn-md relative box-border w-full max-w-[608px] order-2 lg:order-1 p-[26px] sm:p-[34px] md:p-[42px_44px_38px]"
        tilt={-1.1}
        radius={18}
      >
        <form onSubmit={submit}>
          <Tape w={124} h={34} rotate={1.6} top={-19} />

          <InkEyebrow dim={0.45} size={10} className="mt-1">apprenticeship papers</InkEyebrow>
          <h2 className="display m-0 mt-2 mb-7" style={{ fontSize: 46, lineHeight: 0.95, color: "var(--ink-warm)" }}>
            Conjure an account
          </h2>

          <div className="flex flex-col gap-5">
            <TextField
              label="Wizard name"
              value={username}
              onChange={(v) => { setUsername(v); setEdited(true); }}
              placeholder="Gorbo the Damp"
              autoComplete="nickname"
              maxLength={24}
            />
            <TextField
              label="Sigil (email)"
              type="email"
              value={email}
              onChange={(v) => { setEmail(v); setEdited(true); }}
              placeholder="gorbo@thefens.example"
              autoComplete="email"
              size={19}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <SecretField
                value={password}
                onChange={(v) => { setPassword(v); setEdited(true); }}
                placeholder="ten runes at least"
                autoComplete="new-password"
                size={17}
              />
              <SecretField
                label="Say it again"
                value={confirm}
                onChange={(v) => { setConfirm(v); setEdited(true); }}
                placeholder="ten runes at least"
                autoComplete="new-password"
                valid={matches}
                error={mismatch}
                size={17}
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 mt-6 cursor-pointer" style={{ fontWeight: 600, fontSize: 12.5, lineHeight: 1.4, color: "rgba(58,47,38,.65)" }}>
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 flex-none"
              style={{ width: 17, height: 17, accentColor: "var(--magenta)" }}
            />
            I accept that my drawings will be judged harshly and forever
          </label>

          {error && <ErrorLine text={error} />}

          <Btn type="submit" tone="magenta" onLight className="w-full mt-6" size={24} radius="34px 30px 32px 28px" disabled={!canSubmit}>
            {busy ? "…" : "SIGN THE REGISTER"}
          </Btn>

          <p className="text-center m-0 mt-4" style={{ fontWeight: 600, fontSize: 12.5, color: "rgba(58,47,38,.5)" }}>
            already sworn in?{" "}
            <button
              type="button"
              onClick={onGoLogin}
              className="cursor-pointer underline"
              style={{ background: "transparent", border: 0, color: "var(--magenta-deep)", fontFamily: "var(--font-loud)", fontWeight: 700, fontSize: 13 }}
            >
              enter the guild
            </button>
          </p>
        </form>
      </Card>

      <div className="relative z-10 w-full max-w-[360px] order-1 lg:order-2">
        <Lockup tile={70} size={30} fill="gold" onNight />

        <ul className="list-none p-0 m-0 mt-9 flex flex-col gap-6">
          {BENEFITS.map(([n, title, body]) => (
            <li key={n} className="flex gap-4 items-start">
              <span className="display flex-none" style={{ fontSize: 20, color: "var(--gold-bright)", minWidth: 28 }}>{n}</span>
              <span className="min-w-0">
                <span className="block" style={{ fontFamily: "var(--font-loud)", fontWeight: 800, fontSize: 15, color: "var(--parchment)" }}>{title}</span>
                <span className="block mt-1" style={{ fontWeight: 600, fontSize: 12.5, lineHeight: 1.5, color: "rgba(242,227,191,.55)" }}>{body}</span>
              </span>
            </li>
          ))}
        </ul>

        <FootLink lead="in a hurry?" action="play as a wandering stranger" onClick={onCancel} />
      </div>
    </Night>
  );
}
