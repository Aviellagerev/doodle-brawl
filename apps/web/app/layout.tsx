import type { Metadata } from "next";
import { Grenze_Gotisch, Shantell_Sans, Quicksand } from "next/font/google";
import "./globals.css";

// Grenze Gotisch = display (headings, numerals, scores, primary button labels —
// always 900). Shantell Sans = the handwritten voice (names, taglines, asides).
// Quicksand = UI text. Mono is the system stack, used only for tiny caps labels.
// All three are variable fonts, so no `weight` — the axes cover 900 (Grenze),
// 800 (Shantell) and 700 (Quicksand). Shantell also carries the italic the
// handwritten asides need.
const grenze = Grenze_Gotisch({ variable: "--font-grenze", subsets: ["latin"] });
const shantell = Shantell_Sans({ variable: "--font-shantell", subsets: ["latin"], style: ["normal", "italic"] });
const quicksand = Quicksand({ variable: "--font-quicksand", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Scrawl & Sorcery",
  description: "A duel of incompetent wizards. Cast badly, divine loudly, ascend anyway.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${quicksand.variable} ${shantell.variable} ${grenze.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-night text-parchment">{children}</body>
    </html>
  );
}
