/**
 * What a stroke may look like on the wire.
 *
 * The caster's client sends these by the hundred every second, every other
 * client in the room draws them, and the whole turn is kept for late joiners
 * and saved for the chronicle's replay. So nothing is passed on, kept or stored
 * until it has been rebuilt here from checked parts: a megabyte "colour", a NaN
 * point or an extra field never gets past this file.
 */
import type { DrawSegment, DrawOp, Point } from "../../../../packages/shared/index.js";

// the palette's own forms: #rgb … #rrggbbaa, and oklch(L C H)
const COLOR = /^(?:#[0-9a-f]{3,8}|oklch\(\s*[0-9.]+%?\s+[0-9.]+\s+[0-9.]+\s*\))$/i;
const OP_KINDS: ReadonlySet<string> = new Set(["line", "rect", "ellipse", "fill"]);

function num(v: unknown, min: number, max: number): number | null {
    return typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : null;
}

// Points are fractions of the vellum. A stroke may stray past its edge (the
// caster's finger is followed off it), but not to infinity.
function point(v: unknown): Point | null {
    if (!v || typeof v !== "object") return null;
    const p = v as Record<string, unknown>;
    const x = num(p.x, -1, 2);
    const y = num(p.y, -1, 2);
    return x === null || y === null ? null : { x, y };
}

function color(v: unknown): string | null {
    return typeof v === "string" && v.length <= 40 && COLOR.test(v) ? v : null;
}

function strokeId(v: unknown): number | undefined {
    return typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : undefined;
}

/** A freehand segment, rebuilt — or null if any part of it is not one. */
export function cleanSegment(v: unknown): DrawSegment | null {
    if (!v || typeof v !== "object") return null;
    const s = v as Record<string, unknown>;
    const from = point(s.from);
    const to = point(s.to);
    const c = color(s.color);
    const width = num(s.width, 1, 64);   // the widest nib, as an eraser, is 55
    if (!from || !to || !c || width === null) return null;
    return { from, to, color: c, width, erase: s.erase === true, strokeId: strokeId(s.strokeId) };
}

/** A shape or a fill, rebuilt — or null. */
export function cleanOp(v: unknown): DrawOp | null {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    if (typeof o.kind !== "string" || !OP_KINDS.has(o.kind)) return null;
    const from = point(o.from);
    const to = point(o.to);
    const c = color(o.color);
    const width = num(o.width, 1, 64);
    if (!from || !to || !c || width === null) return null;
    return { kind: o.kind as DrawOp["kind"], from, to, color: c, width, strokeId: strokeId(o.strokeId) };
}
