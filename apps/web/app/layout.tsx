import type { Metadata } from "next";
import { Geist_Mono, Shantell_Sans, Quicksand } from "next/font/google";
import "./globals.css";

// Quicksand = the "read it" font (UI, names, body). Shantell Sans = the "loud"
// font (wordmark, headlines, the word, scores). Geist Mono = tiny caps labels.
const quicksand = Quicksand({ variable: "--font-quicksand", subsets: ["latin"] });
const shantell = Shantell_Sans({ variable: "--font-shantell", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Doodle Brawl",
  description: "A multiplayer drawing & guessing game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${quicksand.variable} ${shantell.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
