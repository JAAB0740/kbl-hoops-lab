import type { Metadata } from "next";
import { TopNav } from "@/components/TopNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "KBL Hoops Lab — 2025-26 시즌 분석",
  description:
    "한국프로농구(KBL) 2025-26 시즌 순위, 일정, 선수 스탯, 비교, 고급 분석을 한 화면에서.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="dark">
      <body className="min-h-screen antialiased">
        <TopNav />
        {children}
      </body>
    </html>
  );
}
