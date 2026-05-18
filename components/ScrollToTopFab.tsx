"use client";

import { useEffect, useState } from "react";

/**
 * 우측 하단 플로팅 액션 버튼 — 페이지 최상단으로 부드럽게 스크롤.
 *  - 페이지 최상단에선 숨김
 *  - window.scrollY > 500 일 때 부드럽게 페이드인
 *  - 클릭 시 window.scrollTo({ top: 0, behavior: 'smooth' })
 *  - hover 시 팀 컬러(flame) tint + 위로 살짝 떠오름
 *  - 모바일에선 여백 축소 (bottom-4/right-4 → md:bottom-6/right-6)
 */

const SHOW_THRESHOLD_PX = 500;

export function ScrollToTopFab() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > SHOW_THRESHOLD_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="맨 위로 가기"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={[
        "fixed bottom-4 right-4 z-40 h-12 w-12 rounded-full",
        "md:bottom-6 md:right-6",
        // 다크 모드 반투명 배경 + 블러 + 보더 + 그림자
        "border border-slate-700/80 bg-slate-800/80 backdrop-blur",
        "text-ink-100 shadow-[0_4px_12px_rgba(0,0,0,0.5)]",
        // 트랜지션 (페이드인·위로·hover)
        "transition-all duration-200",
        // hover (데스크탑)
        "hover:-translate-y-0.5 hover:border-flame-500/50 hover:bg-flame-500/20 hover:text-flame-300",
        // tap 피드백
        "active:scale-95",
        // 조건부 페이드
        show ? "opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
    >
      <span aria-hidden className="inline-block text-xl leading-none">
        ↑
      </span>
    </button>
  );
}
