import type { Metadata } from "next";
import localFont from "next/font/local";
import { TopNav } from "@/components/TopNav";
import "./globals.css";

// Pretendard — 한국어 최적화 폰트, 9 weights (100~900) 로컬 로드.
// next/font/local 이 자동으로 woff2 변환 + subset 최적화 + preload.
const pretendard = localFont({
  src: [
    { path: "../public/fonts/Pretendard-Thin.otf",       weight: "100", style: "normal" },
    { path: "../public/fonts/Pretendard-ExtraLight.otf", weight: "200", style: "normal" },
    { path: "../public/fonts/Pretendard-Light.otf",      weight: "300", style: "normal" },
    { path: "../public/fonts/Pretendard-Regular.otf",    weight: "400", style: "normal" },
    { path: "../public/fonts/Pretendard-Medium.otf",     weight: "500", style: "normal" },
    { path: "../public/fonts/Pretendard-SemiBold.otf",   weight: "600", style: "normal" },
    { path: "../public/fonts/Pretendard-Bold.otf",       weight: "700", style: "normal" },
    { path: "../public/fonts/Pretendard-ExtraBold.otf",  weight: "800", style: "normal" },
    { path: "../public/fonts/Pretendard-Black.otf",      weight: "900", style: "normal" },
  ],
  variable: "--font-pretendard",
  display: "swap",
});

const SITE_URL = "https://kbl-hoops-lab.vercel.app";
const SITE_TITLE = "KBL Hoops Lab — 2025-26 시즌 분석";
const SITE_DESCRIPTION =
  "한국프로농구(KBL) 2025-26 시즌 순위, 일정, 선수 스탯, 비교, 박스스코어, 플레이오프 브래킷, 4팩터·샷차트 등 고급 분석을 한 화면에서.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · KBL Hoops Lab",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "KBL", "한국프로농구", "농구", "프로농구", "통계", "스탯",
    "선수", "팀", "순위", "일정", "박스스코어",
    "플레이오프", "챔피언결정전", "2025-26", "비교",
    "advanced stats", "4팩터", "샷차트",
  ],
  authors: [{ name: "JAAB" }],
  creator: "JAAB",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: "KBL Hoops Lab",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={`dark ${pretendard.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <TopNav />
        {children}
      </body>
    </html>
  );
}
