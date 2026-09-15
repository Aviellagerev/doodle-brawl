"use client";

import { Night, Card, Btn, Btn2 } from "../ui/Bits";

/**
 * 09 · The spell fizzled — the connection dropped mid-rite.
 * Room-not-found and room-full are handled inline on the join field, per the
 * handoff; this is the one screen where a raw error code is allowed on show.
 */

function BrokenWand() {
  return (
    <svg viewBox="0 0 170 96" width="190" height="108" aria-hidden style={{ maxWidth: "100%" }}>
      {/* the two halves, flung apart */}
      <path d="M12 84 L68 44" stroke="var(--ink-warm)" strokeWidth="15" strokeLinecap="round" fill="none" />
      <path d="M100 46 L154 34" stroke="var(--ink-warm)" strokeWidth="15" strokeLinecap="round" fill="none" />
      {/* the spark that got away */}
      <path d="M78 40 L86 26" stroke="var(--magenta)" strokeWidth="5" strokeLinecap="round" />
      <path d="M84 44 L98 44" stroke="var(--magenta)" strokeWidth="5" strokeLinecap="round" />
      <path d="M76 52 L70 64" stroke="var(--magenta)" strokeWidth="5" strokeLinecap="round" />
      <path d="M150 8 L160 2" stroke="var(--magenta)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function Fizzled({
  secondsLeft,
  code,
  errorCode = "SOCKET-1331",
  onReconnect,
  onGiveUp,
}: {
  secondsLeft?: number;
  code?: string;
  errorCode?: string;
  onReconnect: () => void;
  onGiveUp: () => void;
}) {
  return (
    <Night className="grid place-items-center p-5" glow="oklch(0.45 0.16 350 / .3)" x="50%" y="40%">
      <Card
        className="torn-md relative w-full max-w-[648px] text-center p-[26px] sm:p-[40px_44px_36px]"
        tilt={1}
        radius={20}
      >
        <div className="flex justify-center mb-5">
          <BrokenWand />
        </div>

        <h2 className="display m-0" style={{ fontSize: "clamp(32px, 8vw, 48px)", color: "var(--ink-warm)" }}>The spell fizzled</h2>
        <p className="m-0 mt-3" style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.55, color: "rgba(58,47,38,.65)" }}>
          We lost the thread to the circle. Your drawing is safe in the vellum; the coven
          simply cannot see it right now.
        </p>

        <div className="flex justify-center mt-5">
          <span
            className="eyebrow"
            style={{
              border: "2px dashed rgba(58,47,38,.4)", borderRadius: 9, padding: "7px 11px",
              fontSize: 9.5, letterSpacing: ".14em", color: "rgba(58,47,38,.55)",
            }}
          >
            ERR · {errorCode}{code ? ` · ${code}` : ""}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <Btn tone="magenta" size={19} radius="30px 26px 32px 28px" className="w-full sm:w-auto" onClick={onReconnect}>
            TRY THE INCANTATION AGAIN
          </Btn>
          <Btn2 size={15} radius="26px 30px 24px 28px" className="w-full sm:w-auto" onClick={onGiveUp}>
            back to the guild
          </Btn2>
        </div>

        {secondsLeft != null && (
          <p className="m-0 mt-4" style={{ fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 13, color: "rgba(58,47,38,.5)" }}>
            retrying in {secondsLeft}…
          </p>
        )}
      </Card>
    </Night>
  );
}

/** The empty chronicle, and any other "nothing here" panel. */
export function EmptyNote({ title, body }: { title: string; body?: string }) {
  return (
    <div className="outline-only text-center" style={{ padding: "40px 24px" }}>
      <span className="display block" style={{ fontSize: 24, color: "var(--parchment)" }}>{title}</span>
      {body && (
        <span className="block mt-2" style={{ fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 14, color: "rgba(242,227,191,.5)" }}>
          {body}
        </span>
      )}
    </div>
  );
}

export function LoadingNote({ text }: { text: string }) {
  return (
    <p className="m-0" style={{ fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 15, color: "rgba(242,227,191,.5)" }}>
      {text}
    </p>
  );
}

/** Join-field copy, kept next to the screen it replaces. */
export const JOIN_ERRORS = {
  notFound: "no circle by that name",
  full: "that circle is full",
};
