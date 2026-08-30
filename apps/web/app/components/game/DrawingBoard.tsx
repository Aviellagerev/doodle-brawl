"use client";
import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { DrawSegment, DrawOp, DrawEntry } from "../../../../../packages/shared";

type Props = { isDrawer: boolean; socket: Socket | null };

type Tool = "pencil" | "eraser" | "line" | "rect" | "ellipse" | "fill";

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

const TOOLS: { id: Tool; glyph: string; title: string }[] = [
    { id: "pencil", glyph: "✎", title: "Brush" },
    { id: "line", glyph: "▬", title: "Line" },
    { id: "rect", glyph: "◻", title: "Rectangle" },
    { id: "ellipse", glyph: "◯", title: "Ellipse" },
    { id: "fill", glyph: "▨", title: "Fill" },
    { id: "eraser", glyph: "⌫", title: "Eraser" },
];

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

// resolve any CSS color (hex / oklch / rgb) to concrete [r,g,b,a] via the browser
function colorToRGBA(color: string): [number, number, number, number] {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const cx = c.getContext("2d");
    if (!cx) return [0, 0, 0, 255];
    cx.fillStyle = color;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
}

// scanline flood fill from (seedX,seedY) with fillColor, tolerant of AA edges.
function floodFill(
    ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement,
    seedX: number, seedY: number, fillColor: [number, number, number, number],
) {
    const w = canvas.width, h = canvas.height;
    const sx = Math.round(seedX), sy = Math.round(seedY);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    const t0 = (sy * w + sx) * 4;
    const target = [data[t0], data[t0 + 1], data[t0 + 2], data[t0 + 3]];
    const [fr, fg, fb, fa] = fillColor;
    // already the fill color → nothing to do (and avoids an infinite loop)
    if (Math.abs(target[0] - fr) + Math.abs(target[1] - fg) +
        Math.abs(target[2] - fb) + Math.abs(target[3] - fa) <= 4) return;
    const tol = 40 * 40;
    const match = (i: number) => {
        const dr = data[i] - target[0], dg = data[i + 1] - target[1];
        const db = data[i + 2] - target[2], da = data[i + 3] - target[3];
        return dr * dr + dg * dg + db * db + da * da <= tol;
    };
    const stack: [number, number][] = [[sx, sy]];
    while (stack.length) {
        const [x, y0] = stack.pop()!;
        let y = y0;
        // climb to the top of this vertical span
        while (y >= 0 && match((y * w + x) * 4)) y--;
        y++;
        let spanLeft = false, spanRight = false;
        while (y < h && match((y * w + x) * 4)) {
            const p = (y * w + x) * 4;
            data[p] = fr; data[p + 1] = fg; data[p + 2] = fb; data[p + 3] = fa;
            if (x > 0) {
                if (match((y * w + x - 1) * 4)) { if (!spanLeft) { stack.push([x - 1, y]); spanLeft = true; } }
                else spanLeft = false;
            }
            if (x < w - 1) {
                if (match((y * w + x + 1) * 4)) { if (!spanRight) { stack.push([x + 1, y]); spanRight = true; } }
                else spanRight = false;
            }
            y++;
        }
    }
    ctx.putImageData(img, 0, 0);
}

export default function DrawingBoard({ isDrawer, socket }: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);
    const lastRef = useRef<{ x: number; y: number } | null>(null);
    // pixel start point of an in-progress shape (line/rect/ellipse)
    const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
    // stroke/op history (normalized 0..1 coords) so we can undo + repaint.
    const strokesRef = useRef<DrawEntry[]>([]);
    const strokeIdRef = useRef(0);
    // keep the live tool available inside pointer handlers without re-binding
    const toolRef = useRef<Tool>("pencil");

    const [color, setColor] = useState(PALETTE[0]);
    const [width, setWidth] = useState(SIZES[1]);
    const [tool, setTool] = useState<Tool>("pencil");
    const [canUndo, setCanUndo] = useState(false);

    useEffect(() => { toolRef.current = tool; }, [tool]);

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

    // paint a committed op (shape or fill), coords normalized 0..1
    function paintOp(op: DrawOp) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        const f = { x: op.from.x * canvas.width, y: op.from.y * canvas.height };
        const t = { x: op.to.x * canvas.width, y: op.to.y * canvas.height };
        if (op.kind === "fill") {
            floodFill(ctx, canvas, f.x, f.y, colorToRGBA(op.color));
            return;
        }
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = op.width;
        ctx.strokeStyle = op.color;
        ctx.beginPath();
        if (op.kind === "line") {
            ctx.moveTo(f.x, f.y);
            ctx.lineTo(t.x, t.y);
        } else if (op.kind === "rect") {
            ctx.rect(Math.min(f.x, t.x), Math.min(f.y, t.y), Math.abs(t.x - f.x), Math.abs(t.y - f.y));
        } else if (op.kind === "ellipse") {
            const cx = (f.x + t.x) / 2, cy = (f.y + t.y) / 2;
            ctx.ellipse(cx, cy, Math.abs(t.x - f.x) / 2, Math.abs(t.y - f.y) / 2, 0, 0, Math.PI * 2);
        }
        ctx.stroke();
        ctx.restore();
    }

    // record a segment into the current freehand stroke (grouped by strokeId) and paint it
    function pushSegment(seg: DrawSegment) {
        const list = strokesRef.current;
        const last = list[list.length - 1];
        if (last && last.kind === "stroke" && last.id === seg.strokeId) last.segs.push(seg);
        else list.push({ kind: "stroke", id: seg.strokeId ?? 0, segs: [seg] });
        paintSeg(seg);
        setCanUndo(list.length > 0);
    }

    // record a committed op as ONE history entry and paint it
    function pushOp(op: DrawOp) {
        strokesRef.current.push({ kind: "op", id: op.strokeId ?? 0, op });
        paintOp(op);
        setCanUndo(strokesRef.current.length > 0);
    }

    function repaint() {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const e of strokesRef.current) {
            if (e.kind === "stroke") for (const seg of e.segs) paintSeg(seg);
            else paintOp(e.op);
        }
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
        const canvas = canvasRef.current;
        const p = getPoint(e);
        if (!canvas || !p) return;
        const t = toolRef.current;
        strokeIdRef.current += 1;   // new stroke / op group

        if (t === "fill") {
            const op: DrawOp = {
                kind: "fill",
                from: { x: p.x / canvas.width, y: p.y / canvas.height },
                to: { x: p.x / canvas.width, y: p.y / canvas.height },
                color, width, strokeId: strokeIdRef.current,
            };
            pushOp(op);
            socket?.emit("draw_op", op);
            return;
        }
        if (t === "line" || t === "rect" || t === "ellipse") {
            drawingRef.current = true;
            shapeStartRef.current = p;
            return;
        }
        // pencil / eraser — freehand
        drawingRef.current = true;
        lastRef.current = p;
    }

    function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
        if (!drawingRef.current) return;
        const canvas = canvasRef.current;
        const p = getPoint(e);
        if (!canvas || !p) return;
        const t = toolRef.current;

        if (t === "line" || t === "rect" || t === "ellipse") {
            const s = shapeStartRef.current;
            if (!s) return;
            // rubber-band: redraw committed history, then the in-progress shape on top
            repaint();
            paintOp({
                kind: t,
                from: { x: s.x / canvas.width, y: s.y / canvas.height },
                to: { x: p.x / canvas.width, y: p.y / canvas.height },
                color, width,
            });
            return;
        }

        // pencil / eraser
        if (!lastRef.current) return;
        const erasing = t === "eraser";
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

    function handlePointerUp(e?: React.PointerEvent<HTMLCanvasElement>) {
        const t = toolRef.current;
        if (drawingRef.current && (t === "line" || t === "rect" || t === "ellipse")) {
            const canvas = canvasRef.current;
            const s = shapeStartRef.current;
            const p = e ? getPoint(e) : null;
            if (canvas && s && p) {
                const op: DrawOp = {
                    kind: t,
                    from: { x: s.x / canvas.width, y: s.y / canvas.height },
                    to: { x: p.x / canvas.width, y: p.y / canvas.height },
                    color, width, strokeId: strokeIdRef.current,
                };
                repaint();            // drop the live preview
                pushOp(op);           // commit as one undoable entry
                socket?.emit("draw_op", op);
            } else {
                repaint();            // no valid end point — discard preview
            }
        }
        drawingRef.current = false;
        lastRef.current = null;
        shapeStartRef.current = null;
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

    // receive + replay remote strokes, ops, clears and undos
    useEffect(() => {
        if (!socket) return;
        function onRemoteDraw(seg: DrawSegment) { pushSegment(seg); }
        function onRemoteOp(op: DrawOp) { pushOp(op); }
        function onRemoteClear() { strokesRef.current = []; setCanUndo(false); clearCanvas(); }
        function onRemoteUndo() {
            if (!strokesRef.current.length) return;
            strokesRef.current.pop();
            repaint();
            setCanUndo(strokesRef.current.length > 0);
        }
        // authoritative snapshot for a late join / reconnect: replace history + repaint.
        // (any live op that arrived before this is included; ops after it arrive later
        // and append, so no double-paint.)
        function onCanvasState(entries: DrawEntry[]) {
            strokesRef.current = entries;
            repaint();
            setCanUndo(entries.length > 0);
        }
        socket.on("draw", onRemoteDraw);
        socket.on("draw_op", onRemoteOp);
        socket.on("clear", onRemoteClear);
        socket.on("undo", onRemoteUndo);
        socket.on("canvas_state", onCanvasState);
        socket.emit("request_canvas");   // get the drawing so far (empty at turn start)
        return () => {
            socket.off("draw", onRemoteDraw);
            socket.off("draw_op", onRemoteOp);
            socket.off("clear", onRemoteClear);
            socket.off("undo", onRemoteUndo);
            socket.off("canvas_state", onCanvasState);
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
                            const active = color === c && tool !== "eraser";
                            return (
                                <button
                                    key={c}
                                    onClick={() => { setColor(c); if (tool === "eraser") setTool("pencil"); }}
                                    className="cursor-pointer"
                                    style={{ borderRadius: 5, background: c, boxShadow: active ? "0 0 0 2.5px var(--ink), 0 0 0 4.5px var(--card)" : "inset 0 0 0 1px rgba(58,47,38,.25)" }}
                                />
                            );
                        })}
                    </div>

                    <span style={{ width: 2, height: 34, background: "color-mix(in srgb, var(--ink) 15%, transparent)", borderRadius: 2 }} />

                    {/* tools — brush, line, rect, ellipse, fill, eraser */}
                    <div className="flex items-center gap-1.5">
                        {TOOLS.map((tl) => {
                            const active = tool === tl.id;
                            return (
                                <button
                                    key={tl.id}
                                    onClick={() => setTool(tl.id)}
                                    title={tl.title}
                                    className="grid place-items-center cursor-pointer text-ink"
                                    style={{
                                        width: 34, height: 34, borderRadius: 11, fontSize: 15,
                                        border: `2.5px solid ${active ? "var(--outline)" : "color-mix(in srgb, var(--ink) 30%, transparent)"}`,
                                        background: active ? "var(--amber)" : "var(--paper)",
                                        boxShadow: active ? "2.5px 2.5px 0 var(--outline)" : "none",
                                    }}
                                >
                                    {tl.glyph}
                                </button>
                            );
                        })}
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
