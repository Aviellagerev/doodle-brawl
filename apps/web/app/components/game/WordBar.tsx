import { GamePhase } from "../../../../../packages/shared";

type Props = { 
    phase:GamePhase;
    isDrawer:boolean;
    word:string|null;
    wordLength:number|null;
    round:number;
    drawerName:string;
};
export default function WordBar({ phase, isDrawer, word, wordLength, round, drawerName }: Props) {
  // Decide what the middle of the bar shows. Branch on PHASE first: `word` is
  // null during "choosing" even for the drawer, so we only read it once we're
  // actually in "drawing".
  function renderWord() {
    if (phase === "choosing") {
      return (
        <span className="text-[#a89984]">
          {isDrawer ? "Pick a word to draw…" : `${drawerName} is choosing a word…`}
        </span>
      );
    }

    if (phase === "drawing") {
      // Drawer sees the real word; everyone else sees one blank per letter.
      // Guessers literally can't show it — the server sent them `word: null`.
      if (isDrawer) {
        return <span className="text-[#b8bb26] tracking-[0.3em]">{word}</span>;
      }
      const blanks = Array.from({ length: wordLength ?? 0 }, () => "_").join(" ");
      return <span className="text-[#ebdbb2] tracking-[0.3em]">{blanks}</span>;
    }

    // scoring / done — not reachable yet, neutral placeholder.
    return <span className="text-[#7c6f64]">—</span>;
  }

  return (
    <div className="flex items-center justify-between bg-[#3c3836] p-3 rounded border border-[#504945]">
      <span className="text-sm text-[#a89984]">Round {round}</span>
      <div className="text-xl font-bold font-mono">{renderWord()}</div>
      {/* right slot reserved for the round timer (Milestone 4) */}
      <span className="w-16 text-right text-sm text-[#7c6f64]" />
    </div>
  );
}
