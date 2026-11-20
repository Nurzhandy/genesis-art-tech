import type { Metadata } from "next";
import { Caveat, Cormorant_Garamond, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Micro } from "@/components/fx/Micro";

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

const SITE = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Дневник атмосферы",
  description: "Личный дневник, который превращает день — текст, фото и музыку — в воспоминание.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${serif.variable} ${mono.variable} ${hand.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="scroll-thread" aria-hidden />
        <Micro />
        {children}
      </body>
    </html>
  );
}
