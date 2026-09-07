"use client";

import { useState } from "react";
import ThemeToggle from "../ThemeToggle";
import { hardShadow, EYEBROW, FIELD, FIELD_STYLE, Label, Wordmark, ErrorSticker, PasswordField } from "./AuthBits";

type Props = {
  authError?: string | null;
  onLogin: (email: string, password: string) => void | Promise<void>;
  onGoSignup: () => void;
  onCancel: () => void;
};

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
    <div className="relative min-h-screen grid place-items-center p-5 sm:p-10">
      <div className="absolute top-5 right-6"><ThemeToggle /></div>

      <div className="w-full max-w-[440px]">
        <div className="text-center mb-6">
          <Wordmark size={44} />
          <p className="font-loud italic text-ink/55 m-0 mt-3" style={{ fontWeight: 700, fontSize: 15 }}>
            Pick up where you left off.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="relative bg-card box-border w-full"
          style={{ border: "2.5px solid var(--outline)", borderRadius: "18px 26px 16px 24px", ...hardShadow(5, 5), padding: "26px 26px 24px", transform: "rotate(-0.7deg)" }}
        >
          <span className="tape absolute" style={{ top: -15, left: "50%", width: 108, height: 28, transform: "translateX(-50%) rotate(-2deg)" }} />

          <span className="block font-mono uppercase text-ink/45 mb-1" style={EYEBROW}>welcome back</span>
          <h2 className="font-loud m-0 mb-5" style={{ fontWeight: 800, fontSize: 30, lineHeight: 1.05 }}>Log in</h2>

          <Label>Email</Label>
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setEdited(true); }}
                 placeholder="you@example.com" autoComplete="email" className={FIELD + " mb-3.5"} style={FIELD_STYLE} />

          <PasswordField value={password} onChange={(v) => { setPassword(v); setEdited(true); }}
                         placeholder="••••••••" autoComplete="current-password" />

          {error && <ErrorSticker text={error} />}

          <button type="submit" disabled={busy}
                  className="w-full font-loud cursor-pointer bg-orange text-card mt-5 disabled:opacity-60"
                  style={{ border: "2.5px solid var(--outline)", borderRadius: "17px 13px 18px 12px", ...hardShadow(4, 4), padding: "13px 15px", fontWeight: 800, fontSize: 19 }}>
            {busy ? "…" : "Log in"}
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
        </form>

        <p className="font-loud text-ink/55 text-center m-0 mt-5" style={{ fontWeight: 700, fontSize: 14 }}>
          No account?{" "}
          <button onClick={onGoSignup} className="underline cursor-pointer text-orange" style={{ fontWeight: 800 }}>
            Make one
          </button>
        </p>
      </div>
    </div>
  );
}
