import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // 다크 스포츠 팔레트
        court: {
          // 배경 레이어 (어두운 것 → 밝은 것 순)
          950: "#07080a",
          900: "#0d0f13",
          800: "#131519",
          700: "#1b1e24",
          600: "#262a33",
          500: "#3a3f4a",
        },
        ink: {
          50: "#fafafa",
          100: "#ececec",
          300: "#a1a1aa",
          500: "#71717a",
          700: "#3f3f46",
        },
        // 포인트 컬러 — 코트 라인처럼 선명하게
        flame: {
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
        hoop: {
          400: "#34d399",
          500: "#10b981",
        },
        buzzer: {
          400: "#fb7185",
          500: "#f43f5e",
        },
        neon: {
          400: "#38bdf8",
          500: "#0ea5e9",
        },
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Pretendard",
          "Inter",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        "court-glow": "0 0 0 1px rgba(245,158,11,0.35), 0 8px 24px -12px rgba(245,158,11,0.4)",
        "card-hover": "0 8px 32px -12px rgba(0,0,0,0.6)",
      },
    },
  },
  plugins: [],
};

export default config;
