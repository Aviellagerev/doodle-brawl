"use client";

import type { ReactNode } from "react";

/**
 * Empty / error states — screen #1h.
 * Pure presentational components. No sockets, no hooks — every action is a prop.
 * Each renders a self-contained centered panel (paper hatch ground) so it can be
 * dropped straight into a full-frame slot, a 2x2 grid cell, or a reconnect overlay.
 */

const hardShadow = (color: string) => `5px 5px 0 ${color}`;
const btnShadow = "4px 4px 0 var(--outline)";

/** Centered panel with the craft-paper hatch — sized to fill its container. */
function Panel({ children }: { children: ReactNode }) {
  return (
    <div
      className="paper-bg grid place-items-center w-full h-full box-border text-ink"
      style={{ minHeight: 300, padding: 24 }}
    >
      <div className="text-center" style={{ maxWidth: 440 }}>{children}</div>
    </div>
  );
}

/** The rotated headline sticker. */
function Sticker({
  children,
  rotate,
  shadowColor,
  dashed,
  filled,
}: {
  children: ReactNode;
  rotate: number;
  shadowColor?: string;  // hard-shadow color; omit for the dashed no-shadow variant
  dashed?: boolean;      // 3px dashed ink/45 border, no fill highlight
  filled?: string;       // background fill (e.g. "var(--rose)") with white text
}) {
  return (
    <div
      className={`font-loud inline-block mb-4 ${filled ? "text-card" : "text-ink"} ${dashed ? "" : "bg-card"}`}
      style={{
        transform: `rotate(${rotate}deg)`,
        border: dashed
          ? "3px dashed color-mix(in srgb, var(--ink) 45%, transparent)"
          : "3px solid var(--outline)",
        borderRadius: 14,
        background: filled ?? undefined,
        boxShadow: shadowColor ? hardShadow(shadowColor) : undefined,
        padding: "10px 18px",
        fontWeight: 800,
        fontSize: 22,
      }}
    >
      {children}
    </div>
  );
}

function Body({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 mb-4 text-ink/65" style={{ fontWeight: 600, fontSize: 13.5, lineHeight: 1.5 }}>
      {children}
    </p>
  );
}

/** A pill action button. `variant` picks the fill; card/text default to ink text. */
function ActionButton({
  children,
  onClick,
  variant,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant: "orange" | "cyan" | "lime" | "card";
}) {
  // Static class strings so Tailwind's JIT keeps them.
  const fill = {
    orange: "bg-orange text-card",
    cyan: "bg-cyan text-card",
    lime: "bg-lime text-ink",
    card: "bg-card text-ink",
  }[variant];
  return (
    <button
      onClick={onClick}
      className={`font-loud cursor-pointer ${fill}`}
      style={{
        border: "2.5px solid var(--outline)",
        borderRadius: 24,
        boxShadow: btnShadow,
        padding: "10px 18px",
        fontWeight: variant === "card" ? 700 : 800,
        fontSize: 14,
      }}
    >
      {children}
    </button>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex gap-2.5 justify-center items-center flex-wrap">{children}</div>;
}

/* ── The four states ─────────────────────────────────────────────── */

export function RoomNotFound({
  code,
  onRetry,
  onFindPublic,
}: {
  code: string;
  onRetry: () => void;
  onFindPublic?: () => void;
}) {
  return (
    <Panel>
      <Sticker rotate={-3} shadowColor="var(--rose)">no room here</Sticker>
      <Body>
        Nothing answers to{" "}
        <b dir="auto" style={{ letterSpacing: ".14em" }}>{code}</b>. Either it closed, or someone
        typed it wrong. Probably you.
      </Body>
      <Actions>
        <ActionButton variant="orange" onClick={onRetry}>Try another code</ActionButton>
        {onFindPublic && (
          <ActionButton variant="card" onClick={onFindPublic}>Find a public room</ActionButton>
        )}
      </Actions>
    </Panel>
  );
}

export function RoomFull({
  onSpectate,
  onLeave,
}: {
  onSpectate?: () => void;
  onLeave: () => void;
}) {
  return (
    <Panel>
      <Sticker rotate={2} shadowColor="var(--amber)">room&apos;s packed — 12/12</Sticker>
      <Body>
        You can lurk until someone rage-quits, which historically takes about 90 seconds.
      </Body>
      <Actions>
        {onSpectate && (
          <ActionButton variant="cyan" onClick={onSpectate}>Watch as spectator</ActionButton>
        )}
        <ActionButton variant="card" onClick={onLeave}>Leave</ActionButton>
      </Actions>
    </Panel>
  );
}

export function LobbyOfOne({
  code,
  onCopyInvite,
}: {
  code: string;
  onCopyInvite: () => void;
}) {
  return (
    <Panel>
      <Sticker rotate={-1.5} dashed>just you in here</Sticker>
      <Body>
        A one-player brawl is called drawing. Send the code to at least one friend.
      </Body>
      <Actions>
        <span
          className="font-loud text-ink"
          style={{
            border: "2.5px solid var(--outline)",
            borderRadius: 12,
            background: "var(--tape)",
            boxShadow: "3px 3px 0 var(--outline)",
            padding: "9px 14px",
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: ".2em",
          }}
          dir="auto"
        >
          {code}
        </span>
        <ActionButton variant="orange" onClick={onCopyInvite}>Copy invite</ActionButton>
      </Actions>
    </Panel>
  );
}

export function Disconnected({
  secondsLeft,
  onReconnect,
  onGiveUp,
}: {
  secondsLeft?: number;
  onReconnect: () => void;
  onGiveUp: () => void;
}) {
  return (
    <Panel>
      <Sticker rotate={2.5} filled="var(--rose)" shadowColor="var(--outline)">you dropped out</Sticker>
      <Body>
        Connection died mid-round. Your seat is held for 30 seconds, then the crab takes it.
      </Body>
      <Actions>
        <ActionButton variant="lime" onClick={onReconnect}>
          {secondsLeft == null ? "Reconnect" : `Reconnect (${secondsLeft})`}
        </ActionButton>
        <button
          onClick={onGiveUp}
          className="cursor-pointer text-ink/50 underline"
          style={{ border: 0, background: "transparent", fontWeight: 700, fontSize: 12.5 }}
        >
          give up
        </button>
      </Actions>
    </Panel>
  );
}
