"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChatMessage, Player, MAX_CHAT_LEN } from "../../../../../packages/shared";
import { chatColorOf } from "../../lib/avatar";
import { subscribeSound, getSoundOn, getServerSoundOn, setSoundOn } from "../../lib/sfx";
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
  placeholder?: string;
  className?: string;
};

/**
 * The murmurings. Five line types — guess, system aside, settings pill, the
 * green "divined it" pill, and the private "so close" note — newest at the
 * bottom.
 */
export default function Chat({
  messages,
  onSend,
  players = [],
  variant = "sidebar",
  title = "the murmurings",
  inputDisabled = false,
  disabledNote = "you may not speak — you cast",
  placeholder = "mutter something…",
  className = "",
}: Props) {
  const [draft, setDraft] = useState("");
  const soundOn = useSyncExternalStore(subscribeSound, getSoundOn, getServerSoundOn);
  const listRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);

  // Pin to the newest line, but don't yank the reader down mid-scroll.
  useEffect(() => {
    const el = listRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // …and keep it pinned when the list itself changes size — a phone keyboard
  // opening shrinks it, and the newest lines are the ones that must stay.
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (atBottomRef.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  const fill = variant === "fill";
  const outer = fill
    // on phones the murmurings take whatever the vellum leaves, but never so
    // little that the newest lines and the input stop fitting
    ? "order-3 w-full flex-1 min-h-[124px] lg:min-h-0 lg:order-3 lg:flex-none lg:w-[262px] lg:self-stretch"
    : "w-full lg:w-[300px] flex-none h-[46vh] lg:h-[620px] lg:max-h-[calc(100dvh_-_2rem)]";

  return (
    <div className={`${outer} flex flex-col min-w-0 ${className}`}>
      <div className={`flex items-center justify-between gap-3 mb-2.5 lg:mb-3.5 ${fill ? "when-roomy" : ""}`}>
        <Eyebrow dim={0.42} size={9.5}>{title}</Eyebrow>
        {/* the noises are each wizard's own business, not a rule of the rite,
            so their switch rides on the murmurings — in the lobby and the game */}
        <button
          type="button"
          onClick={() => setSoundOn(!soundOn)}
          aria-pressed={soundOn}
          className="eyebrow flex-none cursor-pointer"
          style={{
            background: "transparent", border: 0, padding: "10px 0 10px 12px", margin: "-10px 0",
            fontSize: 9.5, color: soundOn ? "rgba(242,227,191,.55)" : "rgba(242,227,191,.3)",
          }}
        >
          {soundOn ? "sound: on" : "sound: off"}
        </button>
      </div>

      <div
        ref={listRef}
        onScroll={onScroll}
        className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto overscroll-contain"
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
          if (m.kind === "close") {
            // your own guess, one letter off — nobody else was shown it
            return (
              <div
                key={i}
                style={{
                  border: "2px dashed rgba(255,214,140,.5)",
                  background: "rgba(255,196,90,.1)",
                  color: "var(--gold-bright)",
                  borderRadius: 10,
                  padding: "7px 10px",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                <span>✧ “<span dir="auto">{m.text}</span>” — so close! one letter astray</span>
                <span className="block" style={{ fontWeight: 600, fontSize: 10.5, color: "rgba(242,227,191,.5)" }}>
                  only you can see this
                </span>
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
          className="mt-2.5 lg:mt-3.5 outline-only text-center"
          style={{ padding: "13px 12px", fontStyle: "italic", fontWeight: 600, fontSize: 12, color: "rgba(242,227,191,.42)" }}
        >
          {disabledNote}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-2.5 lg:mt-3.5 flex gap-2.5">
          <input
            value={draft}
            dir="auto"
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            maxLength={MAX_CHAT_LEN}
            enterKeyHint="send"
            // no autofill bar: on a phone it sits on top of the keyboard and
            // eats the room the vellum needs
            autoComplete="off"
            // 16px on phones — iOS zooms into any smaller field, and stays zoomed
            className="field-box field-box-night flex-1 min-w-0 text-base lg:text-[12.5px]"
            style={{ minHeight: 46, padding: "10px 13px" }}
          />
          <button
            type="submit"
            aria-label="send"
            // keep the focus in the input, so the keyboard stays up for the next guess
            onMouseDown={(e) => e.preventDefault()}
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
