"use client";

import { useState } from "react";
import { InkEyebrow } from "../ui/Bits";

/** Field kit for the parchment cards — no boxes, just a dashed rule under the value. */

export function Label({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mb-2">
      <InkEyebrow dim={0.5} size={9.5}>{children}</InkEyebrow>
      {right}
    </div>
  );
}

export function TextField({
  label, value, onChange, placeholder, type = "text", autoComplete, valid, error, size = 20, maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  valid?: boolean;
  error?: string | null;
  size?: number;
  maxLength?: number;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          className={`field ${valid ? "field-valid" : ""} ${error ? "field-invalid" : ""}`}
          style={{ fontSize: size, paddingRight: valid ? 24 : undefined }}
        />
        {valid && (
          <span className="absolute right-0 bottom-2.5" style={{ color: "oklch(0.55 0.16 145)", fontSize: 16, fontWeight: 700 }}>✓</span>
        )}
      </div>
      {error && <p className="m-0 mt-2" style={{ fontWeight: 600, fontSize: 11.5, color: "var(--red)" }}>{error}</p>}
    </div>
  );
}

export function SecretField({
  label = "Secret word", value, onChange, placeholder, autoComplete, valid, error, size = 20,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  valid?: boolean;
  error?: string | null;
  size?: number;
}) {
  const [reveal, setReveal] = useState(false);
  return (
    <div>
      <Label
        right={
          <button
            type="button"
            onClick={() => setReveal(!reveal)}
            className="eyebrow cursor-pointer"
            style={{ fontSize: 9, color: "rgba(58,47,38,.45)", background: "transparent", border: 0 }}
          >
            {reveal ? "conceal" : "reveal"}
          </button>
        }
      >
        {label}
      </Label>
      <div className="relative">
        <input
          type={reveal ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`field ${valid ? "field-valid" : ""} ${error ? "field-invalid" : ""}`}
          style={{ fontSize: size, paddingRight: valid ? 24 : undefined }}
        />
        {valid && (
          <span className="absolute right-0 bottom-2.5" style={{ color: "oklch(0.55 0.16 145)", fontSize: 16, fontWeight: 700 }}>✓</span>
        )}
      </div>
      {error && <p className="m-0 mt-2" style={{ fontWeight: 600, fontSize: 11.5, color: "var(--red)" }}>{error}</p>}
    </div>
  );
}

/** A server-side failure, in the caster's own hand. */
export function ErrorLine({ text }: { text: string }) {
  return (
    <p className="m-0 mt-4" style={{ fontWeight: 600, fontSize: 12, color: "var(--red)", lineHeight: 1.4 }}>
      {text}
    </p>
  );
}

/** The link-shaped line under a card. */
export function FootLink({ lead, action, onClick }: { lead: string; action: string; onClick: () => void }) {
  return (
    <p className="text-center m-0 mt-6" style={{ fontWeight: 600, fontSize: 12.5, color: "rgba(242,227,191,.5)" }}>
      {lead}{" "}
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer underline"
        style={{ background: "transparent", border: 0, color: "var(--gold-bright)", fontFamily: "var(--font-loud)", fontWeight: 700, fontSize: 13 }}
      >
        {action}
      </button>
    </p>
  );
}
