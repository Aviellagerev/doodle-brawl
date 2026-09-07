"use client";

import { useState } from "react";
import ThemeToggle from "../ThemeToggle";
import { hardShadow, EYEBROW, FIELD, FIELD_STYLE, Label, Wordmark, ErrorSticker, PasswordField } from "./AuthBits";

type Props = {
  authError?: string | null;
  onSignup: (email: string, password: string, username: string) => void | Promise<void>;
  onGoLogin: () => void;
  onCancel: () => void;
};

const PERKS: [string, string, string][] = [
  ["I", "Keep your record", "Matches, scores and every drawing stay attached to you."],
  ["II", "Play anywhere", "The same history on your phone and your laptop."],
  ["III", "Never start over", "Clearing cookies stops costing you everything."],
];

export default function SignupScreen({ authError, onSignup, onGoLogin, onCancel }: Props) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [edited, setEdited] = useState(false);
  const error = edited ? null : authError;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setEdited(false);
    try { await onSignup(email.trim(), password, username.trim()); } finally { setBusy(false); }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center gap-10 lg:gap-16 flex-wrap p-5 sm:p-10">
      <div className="absolute top-5 right-6"><ThemeToggle /></div>

      <form
        onSubmit={submit}
        className="relative bg-card box-border w-full max-w-[460px] order-2 lg:order-1"
        style={{ border: "2.5px solid var(--outline)", borderRadius: "18px 26px 16px 24px", ...hardShadow(5, 5), padding: "26px 28px 24px", transform: "rotate(-0.8deg)" }}
      >
        <span className="tape absolute" style={{ top: -15, left: 30, width: 96, height: 27, transform: "rotate(-7deg)" }} />

        <span className="block font-mono uppercase text-ink/45 mb-1" style={EYEBROW}>join the brawl</span>
        <h2 className="font-loud m-0 mb-5" style={{ fontWeight: 800, fontSize: 32, lineHeight: 1.02 }}>
          Make an <span className="text-orange">account</span>
        </h2>

        <Label>Display name</Label>
        <input value={username} onChange={(e) => { setUsername(e.target.value); setEdited(true); }}
               placeholder="Jelly Bandit" autoComplete="nickname" className={FIELD + " mb-3.5"} style={FIELD_STYLE} />

        <Label>Email</Label>
        <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setEdited(true); }}
               placeholder="you@example.com" autoComplete="email" className={FIELD + " mb-3.5"} style={FIELD_STYLE} />

        <PasswordField value={password} onChange={(v) => { setPassword(v); setEdited(true); }}
                       placeholder="at least 10 characters" autoComplete="new-password" />

        {error && <ErrorSticker text={error} />}

        <button type="submit" disabled={busy}
                className="w-full font-loud cursor-pointer bg-orange text-card mt-5 disabled:opacity-60"
                style={{ border: "2.5px solid var(--outline)", borderRadius: "17px 13px 18px 12px", ...hardShadow(4, 4), padding: "13px 15px", fontWeight: 800, fontSize: 19 }}>
          {busy ? "…" : "Create account"}
        </button>

        <div className="flex items-center gap-2.5 mt-5 mb-4">
          <span className="flex-1" style={{ borderTop: "2px dashed color-mix(in srgb, var(--ink) 25%, transparent)" }} />
          <span className="font-mono uppercase text-ink/35" style={{ ...EYEBROW, fontSize: 9 }}>or</span>
          <span className="flex-1" style={{ borderTop: "2px dashed color-mix(in srgb, var(--ink) 25%, transparent)" }} />
        </div>

        <button type="button" onClick={onCancel}
                className="w-full font-bold cursor-pointer bg-card text-ink"
                style={{ border: "2.5px solid var(--outline)", borderRadius: 13, ...hardShadow(3, 3), padding: "10px 14px", fontSize: 13 }}>
          Keep playing as a guest
        </button>

        <p className="font-loud text-ink/55 text-center m-0 mt-4" style={{ fontWeight: 700, fontSize: 13.5 }}>
          Already have one?{" "}
          <button type="button" onClick={onGoLogin} className="underline cursor-pointer text-orange" style={{ fontWeight: 800 }}>
            Log in
          </button>
        </p>
      </form>

      <div className="w-full max-w-[360px] order-1 lg:order-2">
        <Wordmark size={40} />
        <p className="font-loud italic text-ink/55 m-0 mt-3.5 mb-7" style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.35 }}>
          Guests can play forever. An account just means it counts for something.
        </p>

        <ul className="list-none p-0 m-0 flex flex-col gap-5">
          {PERKS.map(([n, title, body]) => (
            <li key={n} className="flex gap-3.5 items-start">
              <span className="font-loud flex-none text-amber" style={{ fontWeight: 800, fontSize: 22, lineHeight: 1, minWidth: 30 }}>{n}</span>
              <span className="min-w-0">
                <span className="font-loud block text-ink" style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.25 }}>{title}</span>
                <span className="block text-ink/50" style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.4 }}>{body}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
