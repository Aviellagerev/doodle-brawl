import test from "node:test";
import assert from "node:assert/strict";
import { foldGuess, judgeGuess, oneEditApart, revealsWord } from "../src/game/guess.js";
import { initialHint, hintForm, revealHintLetter, writingDirection } from "../src/game/skribbl.js";
import type { GameState } from "../../../packages/shared/index.js";

/**
 * Pure logic: how a guess is read. Every case here is something a real phone
 * keyboard produces for a word the guesser has, in fact, got right.
 */

test("an accent is the same letter, however the keyboard typed it", () => {
  const composed = "café";          // é as one character — a long-press on the e
  const decomposed = "café";       // e + a combining acute
  assert.equal(judgeGuess(composed, "cafe"), "exact");
  assert.equal(judgeGuess(decomposed, "cafe"), "exact");
  assert.equal(judgeGuess("cafe", composed), "exact", "…and the other way round");
  assert.equal(judgeGuess(composed, decomposed), "exact");
  assert.equal(judgeGuess("CRÈME BRÛLÉE", "creme brulee"), "exact");
  assert.equal(judgeGuess("smorgasbord", "smörgåsbord"), "exact");
});

test("case, spaces, hyphens and apostrophes do not matter", () => {
  assert.equal(judgeGuess("  ICE CREAM  ", "ice cream"), "exact");
  assert.equal(judgeGuess("icecream", "ice cream"), "exact");
  assert.equal(judgeGuess("go kart", "go-kart"), "exact");
  assert.equal(judgeGuess("jack o’lantern", "jack-o'-lantern"), "exact", "iOS smart quote");
  assert.equal(judgeGuess("kettle!", "kettle"), "exact");
});

test("Hebrew: geresh however typed, niqqud, and final letters", () => {
  assert.equal(judgeGuess("ג׳ירפה", "ג'ירפה"), "exact", "HEBREW PUNCTUATION GERESH");
  assert.equal(judgeGuess("ג’ירפה", "ג'ירפה"), "exact", "smart quote");
  assert.equal(judgeGuess("גירפה", "ג'ירפה"), "exact", "left out entirely");
  assert.equal(judgeGuess("שָׁלוֹם", "שלום"), "exact", "vowel points");
  assert.equal(judgeGuess("שלומ", "שלום"), "exact", "a regular mem where the final one goes");
  assert.equal(judgeGuess("כלב ים", "כלב ים"), "exact");
});

test("invisible characters a keyboard or a paste can slip in are ignored", () => {
  assert.equal(judgeGuess("ket​tle", "kettle"), "exact", "zero-width space");
  assert.equal(judgeGuess("‏חתול", "חתול"), "exact", "right-to-left mark");
  assert.equal(judgeGuess("ｋｅｔｔｌｅ", "kettle"), "exact", "full-width letters");
});

test("one letter off is close — wrong, missing, extra, or swapped", () => {
  assert.equal(judgeGuess("kettel", "kettle"), "close", "two letters swapped");
  assert.equal(judgeGuess("ketle", "kettle"), "close", "one missing");
  assert.equal(judgeGuess("kettles", "kettle"), "close", "one extra");
  assert.equal(judgeGuess("kittle", "kettle"), "close", "one wrong");
  assert.equal(judgeGuess("ice crem", "ice cream"), "close");
  assert.equal(judgeGuess("kitten", "kettle"), "miss");
  assert.equal(judgeGuess("definitely not the word", "kettle"), "miss");
});

test("short spells never get a hint", () => {
  assert.equal(judgeGuess("o", "ox"), "miss", "a hint on two letters would give it away");
  assert.equal(judgeGuess("ox", "ox"), "exact");
  assert.equal(judgeGuess("car", "cat"), "close", "three letters is enough");
});

test("a word with no letters still has to be typed", () => {
  assert.equal(judgeGuess("🎃", "🎃"), "exact");
  assert.equal(judgeGuess("!!!", "🎃"), "miss", "punctuation folds to nothing, and nothing is not a match");
  assert.equal(judgeGuess("???", "kettle"), "miss");
});

test("the fold itself", () => {
  assert.equal(foldGuess("Go-Kart"), "gokart");
  assert.equal(foldGuess("Straße"), "strasse");
  assert.equal(foldGuess("Øresund"), "oresund");
  assert.equal(oneEditApart("abc", "abc"), false, "identical is not one edit");
  assert.equal(oneEditApart("abc", "abcd"), true);
  assert.equal(oneEditApart("abc", "acb"), true);
  assert.equal(oneEditApart("abc", "cab"), false);
});

test("what the caster and the diviners may not say", () => {
  assert.equal(revealsWord("KETTLE", "kettle"), true);
  assert.equal(revealsWord("kettel", "kettle"), true, "a typo of it");
  assert.equal(revealsWord("it was a kettle all along", "kettle"), true, "a sentence with it inside");
  assert.equal(revealsWord("kettel lol", "kettle"), true, "a typo inside a sentence");
  assert.equal(revealsWord("haha ice crem", "ice cream"), true, "…of a two-word spell");
  assert.equal(revealsWord("nice drawing", "kettle"), false);
  assert.equal(revealsWord("well played", "kettle"), false);
});

test("the blanks count letters and nothing else", () => {
  assert.deepEqual(initialHint("ג'ירפה"), ["", "", "", "", ""], "five letters, five blanks — the geresh is none of them");
  assert.deepEqual(initialHint("go-kart"), ["", "", " ", "", "", "", ""], "a hyphen parts the words, like a space");
  assert.deepEqual(initialHint("ice cream"), ["", "", "", " ", "", "", "", "", ""]);
  assert.equal(hintForm("jack-o'-lantern"), "jack o lantern");
  assert.equal(hintForm("🎃"), "🎃", "a spell with no letters keeps its own form");
});

test("the blanks know which way their spell reads", () => {
  assert.equal(writingDirection("ג'ירפה"), "rtl");
  assert.equal(writingDirection("כלב ים"), "rtl");
  assert.equal(writingDirection("haunted kettle"), "ltr");
  assert.equal(writingDirection("7up"), "ltr", "digits have no direction; the first letter decides");
  assert.equal(writingDirection("🎃"), "ltr");
});

test("a hint uncovers a letter in its own place, never the geresh", () => {
  for (let run = 0; run < 25; run++) {
    const game = { word: "ג'ירפה", hint: initialHint("ג'ירפה") } as GameState;
    assert.equal(revealHintLetter(game), true);
    const shown = game.hint!.flatMap((c, i) => (c ? [[c, i] as const] : []));
    assert.equal(shown.length, 1, "one letter at a time");
    const [letter, at] = shown[0];
    assert.equal(letter, [..."גירפה"][at]);
  }
});
