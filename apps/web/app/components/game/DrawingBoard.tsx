"use client";
import { useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { DrawSegment } from "../../../../../packages/shared";
type Props = { isDrawer: boolean; socket: Socket | null };

export default function DrawingBoard({ isDrawer, socket }: Props) {

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawingRef = useRef(false);                      // are we drawing (left click)
    const lastRef = useRef<{ x: number; y: number } | null>(null);
    function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
        const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
        return { x, y };
    }
    function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
        if (!isDrawer) return;                 // only the drawer draws
        const p = getPoint(e);
        if (!p) return;
        drawingRef.current = true;
        lastRef.current = p;
    }
    function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
        if (!drawingRef.current || !lastRef.current) return;
        const canvas = canvasRef.current;
        const p = getPoint(e);
        const ctx = canvas?.getContext("2d");
        if (!canvas || !p || !ctx) return;

        // draw locally (unchanged)
        ctx.beginPath();
        ctx.moveTo(lastRef.current.x, lastRef.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#ebdbb2";
        ctx.stroke();

        // NEW: send the same segment, normalized to 0..1
        socket?.emit("draw", {
            from: { x: lastRef.current.x / canvas.width, y: lastRef.current.y / canvas.height },
            to: { x: p.x / canvas.width, y: p.y / canvas.height },
            color: "#ebdbb2",
            width: 4,
        });

        lastRef.current = p;
    }

    function handlePointerUp() {
        drawingRef.current = false;
        lastRef.current = null;
    }
    useEffect(() => {
        if (!socket) return;

        function handleRemoteDraw(seg: DrawSegment) {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d");
            if (!canvas || !ctx) return;

            ctx.beginPath();
            ctx.moveTo(seg.from.x * canvas.width, seg.from.y * canvas.height);  // denormalize
            ctx.lineTo(seg.to.x * canvas.width, seg.to.y * canvas.height);
            ctx.lineWidth = seg.width;
            ctx.lineCap = "round";
            ctx.strokeStyle = seg.color;
            ctx.stroke();
        }

        socket.on("draw", handleRemoteDraw);
        return () => { socket.off("draw", handleRemoteDraw); };   // cleanup — critical
    }, [socket]);

    return (
        <canvas
            ref={canvasRef}
            width={800}
            height={600}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}   // pointer left the canvas → end the stroke
            className="w-full bg-white rounded touch-none cursor-crosshair"
        />
    );

}
