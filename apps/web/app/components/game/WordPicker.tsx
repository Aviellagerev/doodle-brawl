type Props = { words: string[]; onChoose: (word: string) => void };

// each card gets its own tilt/radius so no two match — the craft-paper look
const CARD_STYLES = [
  { transform: "rotate(-2deg)", borderRadius: "8px 20px 10px 18px" },
  { transform: "rotate(1deg) translateY(-8px)", borderRadius: "10px 22px 12px 20px" },
  { transform: "rotate(2.4deg)", borderRadius: "18px 8px 20px 10px" },
];

export default function WordPicker({ words, onChoose }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 min-h-[320px] lg:min-h-[460px]">
      <p className="font-loud italic text-ink/55" style={{ fontWeight: 700, fontSize: 20 }}>Pick a word to draw</p>
      <div className="flex gap-6 items-stretch flex-wrap justify-center">
        {words.map((w, i) => {
          const cs = CARD_STYLES[i % CARD_STYLES.length];
          return (
            <button
              key={w}
              onClick={() => onChoose(w)}
              className="relative bg-card cursor-pointer"
              style={{ width: 240, padding: "28px 22px 24px", transform: cs.transform, borderRadius: cs.borderRadius, boxShadow: "0 14px 30px rgba(58,47,38,.16)" }}
            >
              <span className="tape absolute" style={{ top: -13, left: "50%", transform: "translateX(-50%) rotate(3deg)", width: 88, height: 26 }} />
              <span className="block font-loud text-ink" style={{ fontWeight: 800, fontSize: 38, lineHeight: 1.05 }}>{w}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
