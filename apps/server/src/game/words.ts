// Loads the word bank from apps/server/words/<lang>_<list>.txt at startup.
// One file per (language, list); words separated by commas and/or newlines.
// Adding a new list = drop in a new file (and restart) — no code change.
import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { Difficulty } from "../../../../packages/shared/index.js";

// Map a word-list name to a difficulty tier. Only the explicit tier lists carry
// non-normal difficulty; every topic list (animals/food/politics/...) is normal.
export function difficultyForList(list: string): Difficulty {
  if (list === "easy") return "easy";
  if (list === "hard") return "hard";
  // "medium" and all topic lists → normal
  return "normal";
}

export interface WordEntry {
  word: string;
  lang: string;   // "en" | "he" | ...
  list: string;   // "easy" | "hard" | "animals" | ...
}

// words/ sits next to src/ — this file is src/game/words.ts, so ../../words.
// Overridable via WORDS_DIR (used by the volume mount in prod).
const WORDS_DIR =
  process.env.WORDS_DIR ??
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "words");

function loadBank(): WordEntry[] {
  const entries: WordEntry[] = [];
  let files: string[];
  try {
    files = readdirSync(WORDS_DIR).filter((f) => f.endsWith(".txt"));
  } catch (e) {
    console.error(`[words] could not read ${WORDS_DIR}:`, e);
    return entries;
  }
  for (const file of files) {
    const m = /^([a-z]{2})_(.+)\.txt$/.exec(file);
    if (!m) {
      console.warn(`[words] skipping "${file}" — not <lang>_<list>.txt`);
      continue;
    }
    const [, lang, list] = m;
    const raw = readFileSync(path.join(WORDS_DIR, file), "utf8");
    for (const w of raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean)) {
      entries.push({ word: w, lang, list });
    }
  }
  console.log(`[words] loaded ${entries.length} words from ${files.length} file(s)`);
  return entries;
}

export const WORD_BANK: WordEntry[] = loadBank();

// available list names per language, e.g. { en: ["animals","easy",...], he: [...] }
export const WORD_LISTS: Record<string, string[]> = (() => {
  const byLang: Record<string, Set<string>> = {};
  for (const e of WORD_BANK) (byLang[e.lang] ??= new Set()).add(e.list);
  const out: Record<string, string[]> = {};
  for (const lang of Object.keys(byLang)) out[lang] = [...byLang[lang]].sort();
  return out;
})();
