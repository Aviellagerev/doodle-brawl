import { initialsOf, colorOf } from "../lib/avatar";

type Props = {
  name: string;
  size?: number;
  rotate?: number;
  ring?: boolean;
};

// An initials-on-colour blob. White text with a soft shadow so it reads on any
// of the palette colours.
export default function Avatar({ name, size = 40, rotate = 0, ring = false }: Props) {
  return (
    <span
      className="grid place-items-center font-loud"
      style={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: "50%",
        background: colorOf(name),
        color: "#fffdf7",
        textShadow: "0 1px 2px rgba(0,0,0,.35)",
        fontWeight: 800,
        fontSize: Math.round(size * 0.36),
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        boxShadow: ring ? "0 0 0 2.5px var(--card), 0 0 0 5px var(--outline)" : undefined,
      }}
    >
      {initialsOf(name)}
    </span>
  );
}
