import type { Metadata } from "next";
import { Inter, Noto_Sans_TC } from "next/font/google";
import "./globals.css";
import { AppToaster } from "@/components/ui/sonner-app";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const noto = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RuleCheck — 台灣化粧品與食品廣告合規",
  description: "AI 輔助檢測廣告文案風險、產出改寫建議與紀錄留存。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className={`${inter.variable} ${noto.variable}`}>
      <body className="font-sans">
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
