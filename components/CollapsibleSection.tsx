"use client";

import { useState, type ReactNode } from "react";

/**
 * 모바일 전용 아코디언 섹션 — 세로 스크롤 압축용.
 *
 *  - 모바일(<md): 헤더 탭 버튼으로 펼침/접힘. 기본 닫힘 (defaultOpen 으로 변경 가능).
 *  - PC(md+): 토글 버튼 숨김 + 내용 항상 표시 (회귀 없음).
 *
 * 사용처: 팀 스탯 페이지 하단 차트 섹션 (4팩터 / 리바운드 / 슛 프로필 / 라운드 추이 / 클러치 등)
 */
export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      {/* 모바일 헤더 토글 — PC 숨김 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mb-0 flex w-full items-center justify-between rounded-lg border border-court-700/70 bg-court-800/60 px-4 py-3 text-[15px] font-semibold text-ink-100 transition active:scale-[0.995] md:hidden"
      >
        <span>{title}</span>
        <span
          aria-hidden
          className={`text-[14px] text-ink-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          ∨
        </span>
      </button>

      {/* 내용 — 모바일에선 open 일 때만, PC 는 항상 (md:block) */}
      <div
        className={[
          open ? "mt-3" : "hidden",
          "md:mt-0 md:block",
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}
