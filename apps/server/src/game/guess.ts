/**
 * Judging a guess.
 *
 * A guess has to survive the phone it was typed on. The same "café" arrives as
 * one precomposed é (a long-press on the keyboard) or as e + a combining accent;
 * iOS quietly turns ' into ’; a Hebrew keyboard types the geresh as ׳ while the
 * word lists spell it '. So neither side is ever compared as typed: both are
 * folded to a key, and the keys are compared.
 */

// Letters Unicode will not take apart, spelled the way a plain keyboard would.
const LATIN_FOLDS: Record<string, string> = {
    "ß": "ss", "æ": "ae", "œ": "oe", "ø": "o", "đ": "d", "ð": "d", "ł": "l", "ı": "i", "þ": "th",
};

// Hebrew writes five letters differently at the end of a word. It is the same
// letter, the way a capital is, so which key the guesser hit should not matter.
const HEBREW_FINALS: Record<string, string> = { "ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ" };

// A "so close" on a two-letter spell would give it away.
const CLOSE_MIN = 3;

/**
 * The key a guess is compared by: accents and niqqud dropped, case and Hebrew
 * final letters folded, and everything that is not a letter or a digit —
 * spaces, hyphens, every kind of apostrophe, invisible direction marks — gone.
 * "Go-Kart" → "gokart", "café" → "cafe", "צ׳יפס" → "ציפס".
 */
export function foldGuess(text: string): string {
    return text
        .normalize("NFKD")              // é → e + ◌́ · ﬁ → fi · full-width → plain
        .replace(/\p{M}/gu, "")         // the accents themselves, and niqqud
        .toLowerCase()
        .replace(/[ßæœøđðłıþ]/g, (c) => LATIN_FOLDS[c])
        .replace(/[ךםןףץ]/g, (c) => HEBREW_FINALS[c])
        .replace(/[^\p{L}\p{N}]/gu, "");
}

/** Exactly one typo apart: one letter wrong, missing, extra, or two swapped. */
export function oneEditApart(a: string, b: string): boolean {
    const x = [...a];
    const y = [...b];
    if (Math.abs(x.length - y.length) > 1) return false;

    let i = 0;
    while (i < x.length && i < y.length && x[i] === y[i]) i++;
    const tail = (s: string[], from: number) => s.slice(from).join("");

    if (x.length === y.length) {
        if (i === x.length) return false;                           // identical
        if (tail(x, i + 1) === tail(y, i + 1)) return true;         // one letter wrong
        return x[i] === y[i + 1] && x[i + 1] === y[i]               // two letters swapped
            && tail(x, i + 2) === tail(y, i + 2);
    }
    const [long, short] = x.length > y.length ? [x, y] : [y, x];
    return tail(long, i + 1) === tail(short, i);                    // one letter missing, or one extra
}

export type Verdict = "exact" | "close" | "miss";

export function judgeGuess(guess: string, word: string): Verdict {
    const w = foldGuess(word);
    if (!w) {
        // a host's word with no letters at all (emoji, say): nothing to fold,
        // so it has to be typed the way it was written
        const plain = (s: string) => s.normalize("NFC").trim().toLowerCase();
        return plain(guess) === plain(word) ? "exact" : "miss";
    }
    const g = foldGuess(guess);
    if (g === w) return "exact";
    if ([...w].length >= CLOSE_MIN && oneEditApart(g, w)) return "close";
    return "miss";
}

/**
 * Would this line hand the spell to someone still guessing? The spell itself,
 * a typo of it, or a sentence with it inside. Asked of the caster and of those
 * who have already divined it — the wizards who know.
 */
export function revealsWord(text: string, word: string): boolean {
    if (judgeGuess(text, word) !== "miss") return true;
    const w = foldGuess(word);
    if ([...w].length >= CLOSE_MIN && foldGuess(text).includes(w)) return true;

    // …or a typo of it somewhere in the line: try every run of words about as
    // long as the spell ("kettel lol", "haha ice crem")
    const words = text.split(/\s+/).filter(Boolean);
    const span = word.split(/\s+/).filter(Boolean).length;
    for (let n = Math.max(1, span - 1); n <= span + 1; n++) {
        for (let i = 0; i + n <= words.length; i++) {
            if (judgeGuess(words.slice(i, i + n).join(" "), word) !== "miss") return true;
        }
    }
    return false;
}
