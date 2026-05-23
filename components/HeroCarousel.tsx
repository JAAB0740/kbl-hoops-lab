"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 메인 페이지 상단 Hero 4 카드 — 모바일 가로 스와이프 캐러셀 wrapper.
 *
 * 모바일(<md): flex + scroll-snap-x mandatory + Peeking(85vw) + snap-align start
 * 데스크탑(md+): 2열, lg(1024+): 4열 grid
 *
 * 카드 자체는 server 에서 미리 렌더된 ReactNode 로 받음. 캐러셀 wrapper 만 client
 * (IntersectionObserver 로 활성 카드 추적 → 도트 인디케이터 팀 컬러 강조).
 */

export function HeroCarousel({
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
          // 모바일 캐러셀 — snap-x mandatory, gap-4(16px).
          // 부모 페이지가 px-3(mobile)/md:px-6 이라 -mx-3 로 부모 padding 정확히 무력화,
          // 내부 px-4 로 첫/마지막 카드에 약 16px 여백을 부여.
          "-mx-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2",
          "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
          // 데스크탑 grid 로 전환
          "md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0",
          "lg:grid-cols-4",
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
            className={[
              // 모바일 — peeking 85vw + 다음 카드 ~15% 보이게, snap-align start
              "shrink-0 basis-[85vw] snap-start",
              // 데스크탑 — grid item
              "md:basis-auto md:shrink",
            ].join(" ")}
          >
            {card}
          </li>
        ))}
      </ul>

      {/* 도트 페이지 인디케이터 — 모바일 전용. 클릭 시 해당 카드로 smooth scroll */}
      {cards.length > 1 && (
        <div className="mt-3 flex justify-center gap-2 md:hidden">
          {cards.map((_, i) => {
            const isActive = i === activeIdx;
            const color = dotColors[i] ?? "#f97316";
            return (
              <button
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                type="button"
                aria-label={`${i + 1}번째 카드로 이동`}
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
                className={[
                  // 시각적으로는 도트 크기 유지하되 터치 영역은 더 크게 (p-2)
                  "inline-flex items-center justify-center p-2 -m-2",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className={[
                    "inline-block rounded-full transition-all",
                    isActive ? "h-1.5 w-4" : "h-1.5 w-1.5",
                  ].join(" ")}
                  style={{
                    backgroundColor: isActive ? color : "#3f3f46",
                  }}
                />
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
