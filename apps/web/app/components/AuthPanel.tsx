"use client";

import { useState } from "react";
import type { PublicUser } from "../../../../packages/shared";

type AuthPanelProps = {
  user?: PublicUser | null;
  authError?: string | null;
  onSignup: (email: string, password: string, username: string) => void | Promise<void>;
  onLogin: (email: string, password: string) => void | Promise<void>;
  onLogout: () => void | Promise<void>;
};

const hardShadow = (x: number, y: number) => ({ boxShadow: `${x}px ${y}px 0 var(--outline)` });

const LABEL = "block mb-1.5 font-mono uppercase text-ink/45";
const LABEL_STYLE = { fontWeight: 700, fontSize: 10.5, letterSpacing: ".12em" } as const;

const FIELD =
  "font-loud w-full box-border outline-none paper-bg text-ink " +
  "border-[2.5px] border-dashed border-ink/35 placeholder:text-ink/30";
const FIELD_STYLE = { borderRadius: 12, padding: "10px 13px", fontWeight: 700, fontSize: 16 } as const;

export default function AuthPanel({ user, authError, onSignup, onLogin, onLogout }: AuthPanelProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [edited, setEdited] = useState(false);

  // hide a stale error the moment they start fixing it
  const error = edited ? null : authError;

  const touch = () => { if (!edited) setEdited(true); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setEdited(false);
    try {
      if (mode === "login") await onLogin(email.trim(), password);
      else await onSignup(email.trim(), password, username.trim());
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    try { await onLogout(); } finally { setBusy(false); }
  }

  // ── signed in ───────────────────────────────────────────────────────────
  if (user) {
    return (
      <div
        className="relative bg-card box-border w-full"
        style={{ border: "2.5px solid var(--outline)", borderRadius: "14px 20px 14px 22px", ...hardShadow(4, 4), padding: "14px 16px", transform: "rotate(-0.6deg)" }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="bg-lime text-ink px-2.5 py-1 font-bold text-xs flex-none"
            style={{ border: "2.5px solid var(--outline)", borderRadius: 10, ...hardShadow(2, 2), transform: "rotate(-2deg)" }}
          >
            signed in
          </span>
          <span className="font-loud text-ink min-w-0 truncate" style={{ fontWeight: 800, fontSize: 18 }}>
            {user.username || user.email}
          </span>
          <button
            onClick={logout}
            disabled={busy}
            className="ml-auto font-bold cursor-pointer bg-card text-ink disabled:opacity-50"
            style={{ border: "2.5px solid var(--outline)", borderRadius: 11, ...hardShadow(3, 3), padding: "7px 12px", fontSize: 12 }}
          >
            {busy ? "…" : "Log out"}
          </button>
        </div>
        <p className="font-loud italic text-ink/50 m-0 mt-2" style={{ fontWeight: 700, fontSize: 12.5 }}>
          Your matches are being saved.
        </p>
      </div>
    );
  }

  // ── signed out ──────────────────────────────────────────────────────────
  return (
    <form
      onSubmit={submit}
      className="relative bg-card box-border w-full"
      style={{ border: "2.5px solid var(--outline)", borderRadius: "16px 22px 14px 24px", ...hardShadow(4, 4), padding: "16px 18px 18px", transform: "rotate(-0.6deg)" }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <h4 className="font-loud m-0" style={{ fontWeight: 800, fontSize: 19 }}>
          {mode === "login" ? "Welcome back" : "Keep your scores"}
        </h4>
        <button
          type="button"
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setEdited(true); }}
          className="font-bold cursor-pointer bg-card text-ink flex-none"
          style={{ border: "2.5px solid var(--outline)", borderRadius: 10, ...hardShadow(2, 2), padding: "5px 10px", fontSize: 11 }}
        >
          {mode === "login" ? "Sign up" : "Log in"}
        </button>
      </div>

      {mode === "signup" && (
        <>
          <label className={LABEL} style={LABEL_STYLE}>Display name</label>
          <input
            value={username}
            onChange={(e) => { setUsername(e.target.value); touch(); }}
            placeholder="Jelly Bandit"
            autoComplete="nickname"
            className={FIELD + " mb-3"}
            style={FIELD_STYLE}
          />
        </>
      )}

      <label className={LABEL} style={LABEL_STYLE}>Email</label>
      <input
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); touch(); }}
        placeholder="you@example.com"
        autoComplete="email"
        className={FIELD + " mb-3"}
        style={FIELD_STYLE}
      />

      <label className={LABEL} style={LABEL_STYLE}>Password</label>
      <input
        type="password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); touch(); }}
        placeholder={mode === "signup" ? "at least 10 characters" : "••••••••"}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        className={FIELD}
        style={FIELD_STYLE}
      />

      {error && (
        <span
          className="inline-block mt-3 font-bold bg-card text-rose"
          style={{ border: "2px solid var(--rose)", borderRadius: 9, padding: "4px 10px", fontSize: 12, transform: "rotate(-1.2deg)" }}
        >
          {error}
        </span>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full font-loud cursor-pointer bg-orange text-card mt-4 disabled:opacity-60"
        style={{ border: "2.5px solid var(--outline)", borderRadius: 14, ...hardShadow(4, 4), padding: "11px 14px", fontWeight: 800, fontSize: 17 }}
      >
        {busy ? "…" : mode === "login" ? "Log in" : "Create account"}
      </button>

      <p className="font-loud italic text-ink/45 m-0 mt-2.5 text-center" style={{ fontWeight: 700, fontSize: 12 }}>
        {mode === "login" ? "or keep playing as a guest" : "guests can play — accounts keep your history"}
      </p>
    </form>
  );
}
