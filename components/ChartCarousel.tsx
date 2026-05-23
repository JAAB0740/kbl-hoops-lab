"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 차트 가로 스와이프 캐러셀 — 모바일에서 세로 길이 줄이기 위해 2~3개 차트를 묶음.
 *
 *  - 모바일(<md): snap-x mandatory, 100% basis 로 한 번에 한 차트씩 노출 + 도트 인디케이터
 *  - PC(md+): 세로 stack (기존 layout 그대로) — wrapper 가 grid 또는 그냥 sequential
 *
 * 사용처: 라운드 추이 + 레이더 차트 (선수 상세 시즌 요약 탭)
 */

export function ChartCarousel({
  charts,
}: {
  charts: ReactNode[];
}) {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const cardRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const obs = new IntersectionObserver(
      (entries) => {
        let bestRatio = 0;
        let bestIdx = -1;
        for (const e of entries) {
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio;
            bestIdx = Number(
              (e.target as HTMLElement).dataset.idx ?? "-1",
            );
          }
        }
        if (bestRatio > 0.5 && bestIdx >= 0) setActiveIdx(bestIdx);
      },
      { root: scroller, threshold: [0.5, 0.75, 1] },
    );
    for (const el of cardRefs.current) if (el) obs.observe(el);
    return () => obs.disconnect();
  }, [charts.length]);

  return (
    <>
      <ul
        ref={scrollerRef}
        className={[
          // 모바일 캐러셀 — basis 100% (한 번에 한 차트), snap-x mandatory
          "-mx-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-3 pb-2",
          "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
          // PC — flex/snap 해제하고 차트가 세로 stack
          "md:mx-0 md:block md:space-y-4 md:overflow-visible md:px-0 md:pb-0",
        ].join(" ")}
      >
        {charts.map((c, i) => (
          <li
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            data-idx={i}
            className={[
              // 모바일 — 한 차트가 viewport 폭 거의 가득
              "shrink-0 basis-full snap-center",
              // PC — wrapper md:space-y-4 가 자동 간격 부여
              "md:basis-auto md:shrink",
            ].join(" ")}
          >
            {c}
          </li>
        ))}
      </ul>

      {/* 도트 인디케이터 — 모바일 전용 */}
      {charts.length > 1 && (
        <div className="mt-3 flex justify-center gap-2 md:hidden">
          {charts.map((_, i) => {
            const isActive = i === activeIdx;
            return (
              <button
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                type="button"
                aria-label={`${i + 1}번째 차트로 이동`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => {
                  const el = cardRefs.current[i];
                  if (!el) return;
                  el.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                    inline: "start",
                  });
                }}
                className="inline-flex items-center justify-center p-2 -m-2"
              >
                <span
                  aria-hidden
                  className={[
                    "inline-block rounded-full transition-all",
                    isActive ? "h-1.5 w-4 bg-flame-500" : "h-1.5 w-1.5 bg-court-600",
                  ].join(" ")}
                />
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
