"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * What Stood Out 캐러셀 wrapper — client component.
 *
 * Server 에서 만든 카드 markup 을 children 처럼 받아 모바일에선 가로 스와이프,
 * 데스크탑에선 grid 로 렌더. 도트 인디케이터는 모바일에만 노출되고
 * IntersectionObserver 로 활성 카드 추적.
 *
 * (HighlightCard 의 fmtValue 같은 함수 props 가 RSC boundary 를 못 넘기 때문에
 *  카드 자체 렌더는 server 에서 처리하고 wrapper 만 client.)
 */

export function StandoutsCarousel({
  cards,
  dotColors,
}: {
  cards: ReactNode[];
  /** 각 카드의 활성 도트 색상 (팀 컬러) */
  dotColors: string[];
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
  }, [cards.length]);

  return (
    <>
      <ul
        ref={scrollerRef}
        className={[
          // 모바일 캐러셀
          "flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 pt-4",
          "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
          // 데스크탑 grid 전환
          "md:grid md:grid-cols-2 md:gap-3 md:overflow-visible md:pb-4 lg:grid-cols-3",
        ].join(" ")}
      >
        {cards.map((card, i) => (
          <li
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            data-idx={i}
            className="shrink-0 basis-[85vw] snap-center md:basis-auto md:shrink"
          >
            {card}
          </li>
        ))}
      </ul>

      {/* 도트 페이지 인디케이터 — 모바일 전용 */}
      {cards.length > 1 && (
        <div className="flex justify-center gap-1.5 pb-3 md:hidden">
          {cards.map((_, i) => {
            const isActive = i === activeIdx;
            const color = dotColors[i] ?? "#f97316";
            return (
              <span
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                aria-hidden
                className={[
                  "inline-block rounded-full transition-all",
                  isActive ? "h-1.5 w-4" : "h-1.5 w-1.5",
                ].join(" ")}
                style={{
                  backgroundColor: isActive ? color : "#3f3f46",
                }}
              />
            );
          })}
        </div>
      )}
    </>
  );
}
