"use client";
import { useEffect, useRef, useState } from "react";
import { ChatMessage, Player } from "../../../../../packages/shared";
import { chatColorOf } from "../../lib/avatar";
import { Eyebrow } from "../ui/Bits";

type Props = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  /** so a name can be tinted with that player's own familiar */
  players?: Player[];
  variant?: "sidebar" | "fill";
  title?: string;
  inputDisabled?: boolean;
  disabledNote?: string;
};

/**
 * The murmurings. Four line types — guess, system aside, settings pill and the
 * green "divined it" pill — newest at the bottom.
 */
export default function Chat({
  messages,
  onSend,
  players = [],
  variant = "sidebar",
  title = "the murmurings",
  inputDisabled = false,
  disabledNote = "you may not speak — you cast",
}: Props) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);

  // Pin to the newest line, but don't yank the reader down mid-scroll.
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    atBottomRef.current = true;
    onSend(text);
    setDraft("");
  }

  const outer =
    variant === "fill"
      ? "order-3 w-full flex-1 min-h-0 lg:order-3 lg:flex-none lg:w-[262px] lg:self-stretch"
      : "w-full lg:w-[300px] flex-none h-[46vh] lg:h-[620px] lg:max-h-[calc(100dvh_-_2rem)]";

  return (
    <div className={`${outer} flex flex-col min-w-0`}>
      <Eyebrow dim={0.42} size={9.5} className="mb-3.5">{title}</Eyebrow>

      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto"
        style={{ fontSize: 12.5, lineHeight: 1.45 }}
      >
        {messages.map((m, i) => {
          if (m.kind === "chat") {
            return (
              <div key={i} style={{ fontWeight: 600, color: "rgba(242,227,191,.78)" }}>
                <b style={{ color: chatColorOf(m.author, players.find((p) => p.id === m.playerId || p.name === m.author)?.avatar), fontWeight: 700 }}>{m.author}</b>{" "}
                <span dir="auto">{m.text}</span>
              </div>
            );
          }
          if (m.kind === "correct") {
            return (
              <div
                key={i}
                style={{
                  background: "var(--green-bg)",
                  color: "var(--green-text)",
                  borderRadius: 10,
                  padding: "8px 11px",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                ✦ {m.text}
              </div>
            );
          }
          // a settings change reads as a pill; everything else is a murmured aside
          if (m.text.startsWith("⚙")) {
            return (
              <div
                key={i}
                style={{
                  background: "rgba(242,227,191,.08)",
                  color: "rgba(242,227,191,.55)",
                  borderRadius: 9,
                  padding: "8px 11px",
                  fontWeight: 600,
                  fontSize: 11.5,
                }}
              >
                {m.text}
              </div>
            );
          }
          return (
            <div key={i} style={{ fontStyle: "italic", fontWeight: 600, fontSize: 12, color: "rgba(242,227,191,.5)" }}>
              {m.text}
            </div>
          );
        })}
      </div>

      {inputDisabled ? (
        <div
          className="mt-3.5 outline-only text-center"
          style={{ padding: "13px 12px", fontStyle: "italic", fontWeight: 600, fontSize: 12, color: "rgba(242,227,191,.42)" }}
        >
          {disabledNote}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3.5 flex gap-2.5">
          <input
            value={draft}
            dir="auto"
            onChange={(e) => setDraft(e.target.value)}
            placeholder="mutter something…"
            className="field-box field-box-night flex-1 min-w-0"
            style={{ fontSize: 12.5, minHeight: 46, padding: "10px 13px" }}
          />
          <button
            type="submit"
            aria-label="send"
            className="btn btn-magenta flex-none grid place-items-center"
            style={{ width: 46, height: 46, borderRadius: "14px 12px 15px 13px", fontSize: 17, boxShadow: "3px 3px 0 var(--ink-warm)" }}
          >
            ↑
          </button>
        </form>
      )}
    </div>
  );
}
