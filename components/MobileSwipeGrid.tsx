"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 모바일 가로 스와이프 + sm+ 그리드 — 카드 묶음용.
 *
 *  - 모바일(<sm): basis 88% snap-start 가로 스와이프 + 도트 인디케이터
 *  - sm+: 2열 그리드, lg+: 3열 그리드 (flex/snap 무시됨)
 *
 * StandoutCards / PlayerStandoutCards 등 카드형 콘텐츠 모바일 압축에 사용.
 */
export function MobileSwipeGrid({ children }: { children: ReactNode[] }) {
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
            bestIdx = Number((e.target as HTMLElement).dataset.idx ?? "-1");
          }
        }
        if (bestRatio > 0.5 && bestIdx >= 0) setActiveIdx(bestIdx);
      },
      { root: scroller, threshold: [0.5, 0.75, 1] },
    );
    for (const el of cardRefs.current) if (el) obs.observe(el);
    return () => obs.disconnect();
  }, [children.length]);

  return (
    <>
      <ul
        ref={scrollerRef}
        className={[
          // 모바일 — basis 88% snap-start (다음 카드 peek 으로 스와이프 힌트)
          "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2",
          "[&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
          // sm+ — 그리드 (flex/snap 무시됨)
          "sm:grid sm:grid-cols-2 sm:gap-3 sm:overflow-visible sm:pb-0",
          "lg:grid-cols-3",
        ].join(" ")}
      >
        {children.map((c, i) => (
          <li
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            data-idx={i}
            className="basis-[88%] shrink-0 snap-start sm:basis-auto"
          >
            {c}
          </li>
        ))}
      </ul>

      {/* 도트 인디케이터 — 모바일 전용 */}
      {children.length > 1 && (
        <div className="mt-3 flex justify-center gap-2 sm:hidden">
          {children.map((_, i) => {
            const isActive = i === activeIdx;
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
                className="inline-flex items-center justify-center p-2 -m-2"
              >
                <span
                  aria-hidden
                  className={[
                    "inline-block rounded-full transition-all",
                    isActive
                      ? "h-1.5 w-4 bg-flame-500"
                      : "h-1.5 w-1.5 bg-court-600",
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
