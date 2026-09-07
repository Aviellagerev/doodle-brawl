import type { DrawSegment, DrawOp, DrawEntry } from "../../../../packages/shared";

export function drawSegment(
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
export function colorToRGBA(color: string): [number, number, number, number] {
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
export function floodFill(
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

export function paintEntries(canvas: HTMLCanvasElement, entries: DrawEntry[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const seg = (s: DrawSegment) =>
    drawSegment(ctx,
      { x: s.from.x * canvas.width, y: s.from.y * canvas.height },
      { x: s.to.x * canvas.width, y: s.to.y * canvas.height },
      s.color, s.width, !!s.erase);
  const op = (o: DrawOp) => {
    const f = { x: o.from.x * canvas.width, y: o.from.y * canvas.height };
    const t = { x: o.to.x * canvas.width, y: o.to.y * canvas.height };
    if (o.kind === "fill") { floodFill(ctx, canvas, f.x, f.y, colorToRGBA(o.color)); return; }
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = o.color; ctx.lineWidth = o.width;
    ctx.beginPath();
    if (o.kind === "line") { ctx.moveTo(f.x, f.y); ctx.lineTo(t.x, t.y); }
    else if (o.kind === "rect") ctx.rect(f.x, f.y, t.x - f.x, t.y - f.y);
    else ctx.ellipse((f.x + t.x) / 2, (f.y + t.y) / 2, Math.abs(t.x - f.x) / 2, Math.abs(t.y - f.y) / 2, 0, 0, Math.PI * 2);
    ctx.stroke(); ctx.restore();
  };
  for (const e of entries) {
    if (e.kind === "stroke") for (const s of e.segs) seg(s);
    else op(e.op);
  }
}
