"use client";
import { useState } from "react";
import { ChatMessage } from "../../../../../packages/shared";

type Props = { messages: ChatMessage[]; onSend: (text: string) => void };

export default function Chat({ messages, onSend }: Props) {
  const [draft, setDraft] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();                 // stop the form from reloading the page
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");                       // clear the box after sending
  }

  return (
    <div className="w-64 flex flex-col bg-[#1d2021] border border-[#504945] rounded">
      <div className="flex-1 overflow-y-auto p-2 space-y-1 text-sm">
        {messages.map((m, i) =>
          m.kind === "system" ? (
            <div key={i} className="italic text-[#7c6f64]">{m.text}</div>
          ) : (
            <div key={i}><span className="text-[#83a598] font-bold">{m.author}:</span> {m.text}</div>
          )
        )}
      </div>
      <form onSubmit={submit} className="border-t border-[#504945] p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a guess…"
          className="w-full bg-[#282828] border border-[#504945] rounded p-1 text-[#ebdbb2] focus:outline-none"
        />
      </form>
    </div>
  );
}
