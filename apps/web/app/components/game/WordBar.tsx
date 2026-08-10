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
  function renderWord() {
    if (phase === "choosing") {
      return (
        <span className="text-[#a89984]">
          {isDrawer ? "Pick a word to draw…" : `${drawerName} is choosing a word…`}
        </span>
      );
    }

    if (phase === "drawing") {
      if (isDrawer) {
        return <span className="text-[#b8bb26] tracking-[0.3em]">{word}</span>;
      }
      const blanks = Array.from({ length: wordLength ?? 0 }, () => "_").join(" ");
      return <span className="text-[#ebdbb2] tracking-[0.3em]">{blanks}</span>;
    }

    return <span className="text-[#7c6f64]">—</span>;
  }

  return (
    <div className="flex items-center justify-between bg-[#3c3836] p-3 rounded border border-[#504945]">
      <span className="text-sm text-[#a89984]">Round {round}</span>
      <div className="text-xl font-bold font-mono">{renderWord()}</div>
      {/*timer in the future */}
      <span className="w-16 text-right text-sm text-[#7c6f64]" />
    </div>
  );
}
