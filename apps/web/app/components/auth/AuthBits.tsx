"use client";

import { useState } from "react";

export const hardShadow = (x: number, y: number) => ({ boxShadow: `${x}px ${y}px 0 var(--outline)` });
export const EYEBROW = { fontWeight: 700, fontSize: 10, letterSpacing: ".12em" } as const;

export const FIELD =
  "font-loud w-full box-border outline-none paper-bg text-ink " +
  "border-[2.5px] border-dashed border-ink/35 placeholder:text-ink/30";
export const FIELD_STYLE = { borderRadius: 12, padding: "11px 14px", fontWeight: 700, fontSize: 16.5 } as const;

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="block mb-1.5 font-mono uppercase text-ink/45" style={EYEBROW}>{children}</label>;
}

export function Wordmark({ size = 46 }: { size?: number }) {
  return (
    <div className="relative inline-block" style={{ transform: "rotate(-1.5deg)" }}>
      <span className="tape absolute" style={{ top: -11, left: -12, width: 62, height: 22, transform: "rotate(-13deg)" }} />
      <h1 className="font-loud m-0" style={{ fontWeight: 800, fontSize: size, lineHeight: 0.95, letterSpacing: "-0.5px" }}>
        Doodle <span className="text-orange">Brawl</span>
      </h1>
    </div>
  );
}

export function ErrorSticker({ text }: { text: string }) {
  return (
    <span className="inline-block mt-3 font-bold bg-card text-rose"
          style={{ border: "2px solid var(--rose)", borderRadius: 9, padding: "5px 11px", fontSize: 12.5, transform: "rotate(-1.2deg)" }}>
      {text}
    </span>
  );
}

export function PasswordField({
  value, onChange, placeholder, autoComplete,
}: { value: string; onChange: (v: string) => void; placeholder: string; autoComplete: string }) {
  const [reveal, setReveal] = useState(false);
  return (
    <>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="font-mono uppercase text-ink/45" style={EYEBROW}>Password</label>
        <button type="button" onClick={() => setReveal(!reveal)}
                className="font-mono uppercase cursor-pointer text-ink/45 hover:text-ink" style={{ ...EYEBROW, fontSize: 9.5 }}>
          {reveal ? "hide" : "reveal"}
        </button>
      </div>
      <input type={reveal ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)}
             placeholder={placeholder} autoComplete={autoComplete} className={FIELD} style={FIELD_STYLE} />
    </>
  );
}
