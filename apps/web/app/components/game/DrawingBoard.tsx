"use client";
import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { DrawSegment } from "../../../../../packages/shared";

type Props = { isDrawer: boolean; socket: Socket | null };

const PALETTE = [
    // row 1 — brights
    "#3a2f26", "#8a8178", "#fffdf7",
    "oklch(0.55 0.19 20)", "oklch(0.68 0.16 35)", "oklch(0.82 0.15 85)",
    "oklch(0.75 0.14 110)", "oklch(0.55 0.13 155)", "oklch(0.68 0.13 200)",
    "oklch(0.50 0.16 265)", "oklch(0.60 0.16 315)",
    // row 2 — muted + deep (from the concept sheet)
    "#5c5349", "#c4bcb0", "oklch(0.40 0.14 25)",
    "oklch(0.72 0.19 20)", "oklch(0.80 0.13 45)", "oklch(0.90 0.13 95)",
    "oklch(0.60 0.15 135)", "oklch(0.42 0.10 175)", "oklch(0.50 0.14 230)",
    "oklch(0.65 0.14 290)", "oklch(0.75 0.13 340)",
];
const SIZES = [4, 8, 14, 22];

// draw one segment; `erase` clears (destination-out) instead of painting so the
// paper + dot-grid behind the canvas shows through.
function drawSegment(
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number }, to: { x: number; y: number },
    color: string, width: number, erase: boolean,
) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.lineCap = "round";
    ctx.lineWidth = width;
    if (erase) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "rgba(0,0,0,1)";
    } else {
        ctx.strokeStyle = color;
    }
    ctx.stroke();
    ctx.restore();
}

export default function DrawingBoard({ isDrawer, socket }: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const lastRef = useRef<{ x: number; y: number } | null>(null);
    // stroke history (segments in normalized 0..1 coords) so we can undo + repaint.
    const strokesRef = useRef<{ id: number; segs: DrawSegment[] }[]>([]);
    const strokeIdRef = useRef(0);

    const [color, setColor] = useState(PALETTE[0]);
    const [width, setWidth] = useState(SIZES[1]);
    const [erasing, setErasing] = useState(false);
    const [canUndo, setCanUndo] = useState(false);

    function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return {
            x: ((e.clientX - rect.left) / rect.width) * canvas.width,
            y: ((e.clientY - rect.top) / rect.height) * canvas.height,
        };
    }

    // paint a single normalized segment onto the canvas
    function paintSeg(seg: DrawSegment) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        drawSegment(
            ctx,
            { x: seg.from.x * canvas.width, y: seg.from.y * canvas.height },
            { x: seg.to.x * canvas.width, y: seg.to.y * canvas.height },
            seg.color, seg.width, !!seg.erase,
        );
    }

    // record a segment into the current stroke (grouped by strokeId) and paint it
    function pushSegment(seg: DrawSegment) {
        const list = strokesRef.current;
        const last = list[list.length - 1];
        if (last && last.id === seg.strokeId) last.segs.push(seg);
        else list.push({ id: seg.strokeId ?? 0, segs: [seg] });
        paintSeg(seg);
        setCanUndo(list.length > 0);
    }

    function repaint() {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const st of strokesRef.current) for (const seg of st.segs) paintSeg(seg);
    }

    function undo() {
        if (!strokesRef.current.length) return;
        strokesRef.current.pop();
        repaint();
        setCanUndo(strokesRef.current.length > 0);
        socket?.emit("undo");
    }

    function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
        if (!isDrawer) return;
        const p = getPoint(e);
        if (!p) return;
        drawingRef.current = true;
        lastRef.current = p;
        strokeIdRef.current += 1;   // new stroke
    }

    function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
        if (!drawingRef.current || !lastRef.current) return;
        const canvas = canvasRef.current;
        const p = getPoint(e);
        if (!canvas || !p) return;

        const segWidth = erasing ? width * 2.5 : width;
        const seg: DrawSegment = {
            from: { x: lastRef.current.x / canvas.width, y: lastRef.current.y / canvas.height },
            to: { x: p.x / canvas.width, y: p.y / canvas.height },
            color, width: segWidth, erase: erasing, strokeId: strokeIdRef.current,
        };
        pushSegment(seg);          // records + paints locally
        socket?.emit("draw", seg);
        lastRef.current = p;
    }

    function handlePointerUp() {
        drawingRef.current = false;
        lastRef.current = null;
    }

    function clearCanvas() {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function handleClear() {
        strokesRef.current = [];
        setCanUndo(false);
        clearCanvas();
        socket?.emit("clear");
    }

    // receive + replay remote strokes, clears and undos
    useEffect(() => {
        if (!socket) return;
        function onRemoteDraw(seg: DrawSegment) { pushSegment(seg); }
        function onRemoteClear() { strokesRef.current = []; setCanUndo(false); clearCanvas(); }
        function onRemoteUndo() {
            if (!strokesRef.current.length) return;
            strokesRef.current.pop();
            repaint();
            setCanUndo(strokesRef.current.length > 0);
        }
        socket.on("draw", onRemoteDraw);
        socket.on("clear", onRemoteClear);
        socket.on("undo", onRemoteUndo);
        return () => {
            socket.off("draw", onRemoteDraw);
            socket.off("clear", onRemoteClear);
            socket.off("undo", onRemoteUndo);
        };
    }, [socket]);

    // Ctrl/Cmd+Z undoes the last stroke (drawer only, ignored while typing)
    useEffect(() => {
        if (!isDrawer) return;
        function onKey(e: KeyboardEvent) {
            if (!((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z")) return;
            const el = document.activeElement;
            if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
            e.preventDefault();
            undo();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isDrawer]);

    return (
        <div className="flex-1 min-w-0 flex flex-col gap-3">
            <canvas
                ref={canvasRef}
                width={800}
                height={600}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className="w-full touch-none cursor-crosshair h-[320px] sm:h-[400px] lg:h-[460px]"
                style={{
                    background: "var(--canvas)",
                    backgroundImage: "radial-gradient(rgba(58,47,38,.09) 1.2px, transparent 1.2px)",
                    backgroundSize: "26px 26px",
                    border: "3px solid var(--outline)",
                    borderRadius: 6,
                    boxShadow: "0 10px 22px rgba(58,47,38,.14)",
                }}
            />

            {isDrawer && (
                <div className="bg-card flex items-center flex-wrap gap-x-3 gap-y-2" style={{ borderRadius: 16, boxShadow: "0 8px 20px rgba(58,47,38,.12)", padding: "12px 14px" }}>
                    {/* palette */}
                    <div className="grid" style={{ gridTemplateColumns: "repeat(11, 18px)", gridAutoRows: 18, gap: 3 }}>
                        {PALETTE.map((c) => {
                            const active = color === c && !erasing;
                            return (
                                <button
                                    key={c}
                                    onClick={() => { setColor(c); setErasing(false); }}
                                    className="cursor-pointer"
                                    style={{ borderRadius: 5, background: c, boxShadow: active ? "0 0 0 2.5px var(--ink), 0 0 0 4.5px var(--card)" : "inset 0 0 0 1px rgba(58,47,38,.25)" }}
                                />
                            );
                        })}
                    </div>

                    <span style={{ width: 2, height: 34, background: "color-mix(in srgb, var(--ink) 15%, transparent)", borderRadius: 2 }} />

                    {/* tools — pencil + eraser (concept also shows shape tools; not built yet) */}
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setErasing(false)} title="Pencil" className="grid place-items-center cursor-pointer text-ink"
                            style={{ width: 34, height: 34, borderRadius: 11, fontSize: 15, border: `2.5px solid ${!erasing ? "var(--outline)" : "color-mix(in srgb, var(--ink) 30%, transparent)"}`, background: !erasing ? "var(--amber)" : "var(--paper)", boxShadow: !erasing ? "2.5px 2.5px 0 var(--outline)" : "none" }}>
                            ✎
                        </button>
                        <button onClick={() => setErasing(true)} title="Eraser" className="grid place-items-center cursor-pointer text-ink"
                            style={{ width: 34, height: 34, borderRadius: 11, fontSize: 15, border: `2.5px solid ${erasing ? "var(--outline)" : "color-mix(in srgb, var(--ink) 30%, transparent)"}`, background: erasing ? "var(--amber)" : "var(--paper)", boxShadow: erasing ? "2.5px 2.5px 0 var(--outline)" : "none" }}>
                            ⌫
                        </button>
                    </div>

                    <span style={{ width: 2, height: 34, background: "color-mix(in srgb, var(--ink) 15%, transparent)", borderRadius: 2 }} />

                    {/* brush sizes */}
                    <div className="flex items-center gap-1.5">
                        {SIZES.map((sz) => (
                            <button key={sz} onClick={() => setWidth(sz)} className="grid place-items-center cursor-pointer" style={{ width: 30, height: 30 }}>
                                <span style={{ width: sz, height: sz, borderRadius: "50%", background: "var(--ink)", boxShadow: width === sz ? "0 0 0 2px var(--card), 0 0 0 4px var(--ink)" : undefined }} />
                            </button>
                        ))}
                    </div>

                    {/* undo + clear */}
                    <div className="flex items-center gap-2 ml-auto">
                        <button
                            onClick={undo}
                            disabled={!canUndo}
                            title="Undo (Ctrl+Z)"
                            className="font-bold cursor-pointer text-ink disabled:opacity-40 disabled:cursor-default"
                            style={{ border: "2.5px solid var(--outline)", borderRadius: 11, background: "var(--card)", padding: "7px 11px", fontSize: 12, boxShadow: canUndo ? "2.5px 2.5px 0 var(--outline)" : "none" }}
                        >
                            ↶ Undo
                        </button>
                        <button
                            onClick={handleClear}
                            className="font-bold cursor-pointer text-card bg-rose"
                            style={{ border: "2.5px solid var(--outline)", borderRadius: 11, boxShadow: "2.5px 2.5px 0 var(--outline)", padding: "8px 12px", fontSize: 11.5 }}
                        >
                            Clear all
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
