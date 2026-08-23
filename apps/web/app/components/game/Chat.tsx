"use client";
import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "../../../../../packages/shared";
import { colorOf } from "../../lib/avatar";

type Props = {
  messages: ChatMessage[];
  onSend: (text: string) => void;

  variant?: "sidebar" | "fill";
  title?: string;               // mono-caps header label (default "Chat")
  
  inputDisabled?: boolean;
  disabledNote?: string;
};

export default function Chat({ messages, onSend, variant = "sidebar", title = "Chat", inputDisabled = false, disabledNote = "no typing — you know the word" }: Props) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);

  // Pin to the newest message, but don't yank the user down while they've
  // scrolled up to read history.
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
    atBottomRef.current = true; // sending my own message always jumps to it
    onSend(text);
    setDraft("");
  }

  // outer sizing differs by variant; the inner flex column is identical.
  // fill (in-game): mobile fills the remaining column height, desktop self-stretches
  //   to the viewport-bounded game row so the pinned input is always on screen.
  // sidebar (lobby / game-over): capped to the viewport so the input stays reachable.
  const outer =
    variant === "fill"
      ? "order-3 w-full flex-1 min-h-0 lg:order-3 lg:flex-none lg:w-[284px] lg:self-stretch"
      : "w-full lg:w-[284px] flex-none h-[46vh] lg:h-[620px] lg:max-h-[calc(100dvh_-_2rem)]";

  return (
    <div
      className={`${outer} bg-card flex flex-col`}
      style={{ borderRadius: "18px 8px 18px 8px", boxShadow: "0 8px 20px rgba(58,47,38,.12)", padding: 14 }}
    >
      <div className="font-mono uppercase text-ink/45 mb-3" style={{ fontWeight: 700, fontSize: 10, letterSpacing: ".12em" }}>
        {title}
      </div>

      <div ref={listRef} onScroll={onScroll} className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto" style={{ fontSize: 12.5, lineHeight: 1.4 }}>
        {messages.map((m, i) => {
          if (m.kind === "chat") {
            return (
              <div key={i}>
                <b style={{ color: colorOf(m.author), fontWeight: 700 }}>{m.author}</b> <span dir="auto">{m.text}</span>
              </div>
            );
          }
          if (m.kind === "correct") {
            return (
              <div key={i} className="font-bold" style={{ background: "color-mix(in srgb, var(--lime) 30%, transparent)", border: "2px solid var(--lime)", borderRadius: 11, padding: "7px 10px", color: "color-mix(in srgb, var(--ink) 80%, var(--lime))" }}>
                {m.text}
              </div>
            );
          }
          // system
          return (
            <div key={i} className="font-loud italic text-ink/45" style={{ fontSize: 12 }}>
              {m.text}
            </div>
          );
        })}
      </div>

      {inputDisabled ? (
        <div
          className="mt-3 paper-bg font-loud italic text-ink/40"
          style={{ border: "2.5px dashed color-mix(in srgb, var(--ink) 30%, transparent)", borderRadius: 12, padding: "11px 13px", fontSize: 12, fontWeight: 600 }}
        >
          {disabledNote}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <input
            value={draft}
            dir="auto"
            onChange={(e) => setDraft(e.target.value)}
            placeholder="say something…"
            className="flex-1 min-w-0 paper-bg text-ink outline-none placeholder:text-ink/35"
            style={{ border: "2.5px dashed color-mix(in srgb, var(--ink) 30%, transparent)", borderRadius: 12, padding: "9px 12px", fontSize: 12.5 }}
          />
          <button
            type="submit"
            className="font-bold text-card cursor-pointer bg-cyan"
            style={{ border: "2.5px solid var(--outline)", borderRadius: 12, boxShadow: "2.5px 2.5px 0 var(--outline)", padding: "0 13px", fontSize: 12 }}
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
