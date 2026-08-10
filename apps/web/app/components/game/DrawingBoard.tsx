"use client";
import { useRef } from "react";

type Props = { isDrawer: boolean };

export default function DrawingBoard({ isDrawer }: Props) {
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
        const p = getPoint(e);
        const ctx = canvasRef.current?.getContext("2d");
        if (!p || !ctx) return;

        ctx.beginPath();
        ctx.moveTo(lastRef.current.x, lastRef.current.y);  // from the last point
        ctx.lineTo(p.x, p.y);                              // to the new point
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#ebdbb2";
        ctx.stroke();

        lastRef.current = p;                               // advance
    }
    function handlePointerUp() {
        drawingRef.current = false;
        lastRef.current = null;
    }
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
