import test from "node:test";
import assert from "node:assert/strict";
import { WORD_BANK, LANGUAGES, WORDS_LISTED_TWICE } from "../src/game/words.js";
import { pickWords, spellKey, DEFAULT_SETTINGS } from "../src/game/skribbl.js";
import { OFFER_SHAPES, RoomSettings } from "../../../packages/shared/index.js";

/**
 * Pure logic, and the word files themselves: every spell has one rank, and an
 * offering is a hand of ranks — easy to hard — never a repeat within a rite.
 */

const settings = (patch: Partial<RoomSettings> = {}): RoomSettings => ({ ...DEFAULT_SETTINGS, ...patch });
const RANKS = ["easy", "normal", "hard"] as const;

test("every spell lives in exactly one rank", () => {
  assert.deepEqual(WORDS_LISTED_TWICE, [], "a word is listed in two tier files (or twice in one)");
});

test("every tongue has all three ranks, and plenty of each", () => {
  assert.deepEqual(LANGUAGES, ["en", "he"]);
  for (const lang of LANGUAGES) {
    for (const rank of RANKS) {
      const n = WORD_BANK.filter((e) => e.lang === lang && e.difficulty === rank).length;
      assert.ok(n >= 100, `${lang} ${rank}: only ${n} spells`);
    }
  }
});

test("an offering is a cantrip, a hex and a forbidden spell, in that order", () => {
  for (const language of LANGUAGES) {
    for (let i = 0; i < 25; i++) {
      const offer = pickWords(3, settings({ language }));
      assert.deepEqual(offer.map((o) => o.difficulty), ["easy", "normal", "hard"]);
      assert.equal(new Set(offer.map((o) => spellKey(o.word))).size, 3, "three different spells");
    }
  }
});

test("every size of offering follows its shape", () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const offer = pickWords(n, settings());
    assert.deepEqual(offer.map((o) => o.difficulty), OFFER_SHAPES[n]);
    assert.equal(new Set(offer.map((o) => spellKey(o.word))).size, n, `${n} different spells`);
  }
});

test("a spell drawn this rite is not offered again", () => {
  const en = WORD_BANK.filter((e) => e.lang === "en");
  const left = RANKS.map((rank) => en.find((e) => e.difficulty === rank)!.word);   // one of each rank undrawn
  const drawn = new Set(en.map((e) => spellKey(e.word)).filter((k) => !left.map(spellKey).includes(k)));
  assert.deepEqual(pickWords(3, settings(), drawn).map((o) => o.word), left);
});

test("a rank drawn dry repeats rather than leaving a seat empty", () => {
  const everything = new Set(WORD_BANK.map((e) => spellKey(e.word)));
  assert.equal(pickWords(3, settings(), everything).length, 3);
});

test("the host's own words sit in the middle seat about half the time", () => {
  const own = ["gorbo's hat", "haunted kettle"];
  let theirs = 0;
  for (let i = 0; i < 400; i++) {
    const offer = pickWords(3, settings({ customWords: own }));
    if (own.includes(offer[1].word)) theirs++;
    assert.ok(!own.includes(offer[0].word) && !own.includes(offer[2].word), "only ever the middle seat");
  }
  assert.ok(theirs > 120 && theirs < 280, `the middle seat was theirs ${theirs} times in 400`);
});

test("with only their own words, that is all there is — and none twice", () => {
  const own = ["toad", "kettle", "broom"];
  for (let i = 0; i < 25; i++) {
    const offer = pickWords(3, settings({ customWords: own, customWordsOnly: true }));
    assert.equal(offer.length, 3);
    assert.ok(offer.every((o) => own.includes(o.word)));
  }
  const drawn = new Set(["toad", "kettle"].map(spellKey));
  assert.deepEqual(pickWords(1, settings({ customWords: own, customWordsOnly: true }), drawn).map((o) => o.word), ["broom"]);
});
