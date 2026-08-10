// Drawer-only. Shows the 3 candidate words as buttons; clicking one bubbles
// the choice up via onChoose. Dumb: no socket, no state — the 3 words come
// down as props (held in page.tsx from the `word_pick` event), and the emit
// happens up in page.tsx.
type Props = { words: string[]; onChoose: (word: string) => void };

export default function WordPicker({ words, onChoose }: Props) {
  return (
    <div className="text-center space-y-3">
      <p className="text-sm text-[#a89984]">Choose a word to draw</p>
      <div className="flex gap-3">
        {words.map((w) => (
          <button
            key={w}
            onClick={() => onChoose(w)}
            className="bg-[#3c3836] hover:bg-[#504945] border border-[#504945] text-[#ebdbb2] font-bold py-2 px-4 rounded transition-colors"
          >
            {w}
          </button>
        ))}
      </div>
    </div>
  );
}
