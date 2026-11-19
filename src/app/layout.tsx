import type { Metadata } from "next";
import { Caveat, Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Постоянные шрифты дневника (docs/plan/00-overview.md, раздел 5)
const serif = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["400", "600", "700"],
  subsets: ["latin", "cyrillic"],
});

const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin", "cyrillic"],
});

const hand = Caveat({
  variable: "--font-caveat",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Дневник атмосферы",
  description: "Личный дневник, который превращает день — текст, фото и музыку — в воспоминание.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${serif.variable} ${mono.variable} ${hand.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
