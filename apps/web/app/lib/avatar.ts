// Deterministic initial-blob avatar helpers, shared everywhere avatars render
// so the same name always gets the same colour + initials.
export const BLOB_COLORS = [
  "oklch(0.70 0.15 315)", // magenta
  "oklch(0.68 0.13 200)", // cyan
  "oklch(0.75 0.14 110)", // lime
  "oklch(0.68 0.16 35)",  // orange
  "oklch(0.62 0.14 285)", // violet
];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function colorOf(name: string): string {
  if (!name) return BLOB_COLORS[0];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) | 0;
  return BLOB_COLORS[Math.abs(h) % BLOB_COLORS.length];
}
