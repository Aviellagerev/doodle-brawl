// Loads the word bank from apps/server/words/<lang>_<tier>.txt at startup:
// one file per language and difficulty — easy, medium, hard — with words
// separated by commas and/or newlines. A word's difficulty is simply the file
// it lives in, and it lives in exactly one. Adding words = edit a file and
// restart the server (prod mounts this folder, so no rebuild).
import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { Difficulty } from "../../../../packages/shared/index.js";
import { foldGuess } from "./guess.js";

// the tier files, and the difficulty each one stands for
const TIER_FILES: Record<string, Difficulty> = { easy: "easy", medium: "normal", hard: "hard" };

/** One spell as it is stored: composed (NFC), single-spaced, trimmed. */
export function tidyWord(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

export interface WordEntry {
  word: string;
  lang: string;             // "en" | "he" | ...
  difficulty: Difficulty;
}

// words/ sits next to src/ — this file is src/game/words.ts, so ../../words.
// Overridable via WORDS_DIR (used by the volume mount in prod).
const WORDS_DIR =
  process.env.WORDS_DIR ??
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "words");

/** Words the files list twice (the first listing is kept). Should stay empty. */
export const WORDS_LISTED_TWICE: string[] = [];

function loadBank(): WordEntry[] {
  const entries: WordEntry[] = [];
  let files: string[];
  try {
    files = readdirSync(WORDS_DIR).filter((f) => f.endsWith(".txt")).sort();
  } catch (e) {
    console.error(`[words] could not read ${WORDS_DIR}:`, e);
    return entries;
  }
  const home = new Map<string, string>();   // "<lang>:<folded word>" → the file it is in
  const doubled = WORDS_LISTED_TWICE;
  for (const file of files) {
    const m = /^([a-z]{2})_(.+)\.txt$/.exec(file);
    const difficulty = m ? TIER_FILES[m[2]] : undefined;
    if (!m || !difficulty) {
      console.warn(`[words] skipping "${file}" — not <lang>_<easy|medium|hard>.txt`);
      continue;
    }
    const lang = m[1];
    const raw = readFileSync(path.join(WORDS_DIR, file), "utf8");
    // NFC, so an accented letter is one character however the file was saved —
    // the hint mask counts letters, and a stray combining mark would be a slot
    for (const word of raw.split(/[,\n]/).map(tidyWord).filter(Boolean)) {
      // one tier per word, as a guesser would type it: a second listing is a
      // mistake in the files, so say so and keep the first
      const key = `${lang}:${foldGuess(word) || word}`;
      const first = home.get(key);
      if (first) { doubled.push(`${word} (${first}, ${file})`); continue; }
      home.set(key, file);
      entries.push({ word, lang, difficulty });
    }
  }
  if (doubled.length) {
    console.warn(`[words] ${doubled.length} word(s) listed twice, kept the first: ${doubled.slice(0, 8).join("; ")}`);
  }
  console.log(`[words] loaded ${entries.length} words from ${files.length} file(s)`);
  return entries;
}

export const WORD_BANK: WordEntry[] = loadBank();

/** The tongues there are words for, e.g. ["en", "he"]. */
export const LANGUAGES: string[] = [...new Set(WORD_BANK.map((e) => e.lang))].sort();
