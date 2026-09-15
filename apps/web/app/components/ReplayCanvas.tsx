"use client";

import { useEffect, useRef, useState } from "react";
import type { DrawEntry } from "../../../../packages/shared";
import { paintEntries } from "../lib/draw";

const SERVER = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001";

export default function ReplayCanvas({ turnId }: { turnId: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "fail">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${SERVER}/api/replay/${turnId}`, { credentials: "include" });
        const entries = (await res.json()) as DrawEntry[];
        if (cancelled) return;
        if (!res.ok || !Array.isArray(entries)) { setState("fail"); return; }
        const c = ref.current;
        if (c) paintEntries(c, entries);
        setState("ok");
      } catch {
        if (!cancelled) setState("fail");
      }
    })();
    return () => { cancelled = true; };
  }, [turnId]);

  return (
    <div className="relative mt-3" style={{ borderRadius: 10, overflow: "hidden", border: "3px solid var(--ink-warm)" }}>
      <canvas ref={ref} width={640} height={400} className="block w-full h-auto" style={{ background: "var(--parchment-bright)", backgroundImage: "repeating-linear-gradient(118deg, rgba(120,95,60,.05) 0 2px, transparent 2px 8px)" }} />
      {state !== "ok" && (
        <div className="absolute inset-0 grid place-items-center" style={{ fontFamily: "var(--font-loud)", fontStyle: "italic", fontWeight: 700, fontSize: 14, color: "rgba(58,47,38,.5)" }}>
          {state === "loading" ? "unrolling…" : "the vellum is lost"}
        </div>
      )}
    </div>
  );
}
