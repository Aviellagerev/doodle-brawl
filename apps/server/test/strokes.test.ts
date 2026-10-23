import test from "node:test";
import assert from "node:assert/strict";
import { cleanSegment, cleanOp } from "../src/game/strokes.js";

/** Pure logic: a stroke is rebuilt from checked parts, or it is nothing. */

const good = { from: { x: 0.1, y: 0.2 }, to: { x: 0.3, y: 0.4 }, color: "oklch(0.55 0.19 25)", width: 8, strokeId: 3 };

test("an honest stroke comes through unchanged", () => {
  assert.deepEqual(cleanSegment(good), { ...good, erase: false });
  assert.deepEqual(cleanSegment({ ...good, color: "#2b1c12", erase: true }), { ...good, color: "#2b1c12", erase: true });
  assert.deepEqual(cleanOp({ ...good, kind: "ellipse" }), { ...good, kind: "ellipse" });
});

test("anything that is not a stroke is nothing", () => {
  for (const bad of [
    null, 42, "draw", [],
    { ...good, color: "x".repeat(50_000) },
    { ...good, color: "url(javascript:alert(1))" },
    { ...good, from: { x: NaN, y: 0 } },
    { ...good, to: null },
    { ...good, width: "8" },
  ]) {
    assert.equal(cleanSegment(bad), null, JSON.stringify(bad)?.slice(0, 60));
  }
  assert.equal(cleanOp({ ...good, kind: "explode" }), null, "an op of no known kind");
});

test("extra fields are dropped, and wild numbers held in bounds", () => {
  const out = cleanSegment({ ...good, width: 1e9, from: { x: -50, y: 1e12 }, junk: "y".repeat(1000), strokeId: -4 });
  assert.deepEqual(out, { from: { x: -1, y: 2 }, to: good.to, color: good.color, width: 64, erase: false, strokeId: undefined });
});
