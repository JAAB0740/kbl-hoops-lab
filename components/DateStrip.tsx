"use client";

import { useEffect, useMemo, useRef } from "react";
import { MonthPicker } from "@/components/MonthPicker";

const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 시즌 전체를 가로로 스크롤 가능한 날짜 strip.
 *  - 시즌 첫 경기일 ~ 마지막 경기일까지 모든 날짜 렌더
 *  - 좌·우 화살표 클릭으로 컨테이너만 스크롤 (선택 변경 X)
 *  - 마우스 휠/터치 스와이프/스크롤바로도 스크롤 가능
 *  - 선택 변경 시 해당 칸 자동으로 가운데로 스크롤
 *  - 월 칩으로 빠른 점프
 */
export function DateStrip({
  selectedDate,
  onSelect,
  gameCountByDate,
  seasonMonths,
  monthJumpTarget,
  /** 시즌 첫 날짜 / 마지막 날짜 (YYYY-MM-DD). 없으면 month 리스트로 추론. */
  rangeStart,
  rangeEnd,
}: {
  selectedDate: string;
  onSelect: (date: string) => void;
  gameCountByDate: Map<string, number>;
  seasonMonths?: string[];
  monthJumpTarget?: (ym: string) => string;
  rangeStart?: string;
  rangeEnd?: string;
}) {
  // 시즌 전체 일자 배열 만들기
  const allDates = useMemo(() => {
    let start: string | undefined = rangeStart;
    let end: string | undefined = rangeEnd;
    if ((!start || !end) && seasonMonths && seasonMonths.length > 0) {
      const sorted = [...seasonMonths].sort();
      start = start ?? `${sorted[0]}-01`;
      // 마지막 월의 마지막 날 구하기
      const [ly, lm] = sorted[sorted.length - 1].split("-").map(Number);
      const last = new Date(ly, lm, 0); // lm은 1-indexed, day=0 → 전월 말일이지만 lm이 +1 안 했으므로 lm월 말일
      end = end ?? dateKey(last);
    }
    if (!start || !end) return [];
    const arr: Date[] = [];
    const cur = new Date(start + "T00:00:00");
    const stop = new Date(end + "T00:00:00");
    while (cur <= stop) {
      arr.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  }, [rangeStart, rangeEnd, seasonMonths]);

  const todayKey = dateKey(new Date());

  // refs
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // 선택 바뀌면 해당 칸을 가운데로 스크롤
  useEffect(() => {
    if (!selectedRef.current) return;
    selectedRef.current.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [selectedDate]);

  // 화살표로 viewport 스크롤 (선택 변경 안 함)
  function scrollViewport(direction: 1 | -1) {
    const c = containerRef.current;
    if (!c) return;
    c.scrollBy({
      left: direction * c.clientWidth * 0.75,
      behavior: "smooth",
    });
  }

  if (allDates.length === 0) {
    return null;
  }

  return (
    <div className="card mb-4 p-4">
      {/* 상단: 월 칩 + 오늘 버튼 */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {seasonMonths && seasonMonths.length > 0 ? (
          <MonthPicker
            months={seasonMonths}
            current={selectedDate.slice(0, 7)}
            onSelect={(ym) => {
              const target = monthJumpTarget
                ? monthJumpTarget(ym)
                : `${ym}-01`;
              onSelect(target);
            }}
          />
        ) : (
          <span />
        )}
        {selectedDate !== todayKey && (
          <button
            onClick={() => onSelect(todayKey)}
            className="rounded-md border border-flame-500/40 bg-flame-500/10 px-2.5 py-1 text-[14px] font-medium text-flame-400 hover:bg-flame-500/20"
          >
            오늘
          </button>
        )}
      </div>

      {/* 스크롤 화살표 + strip */}
      <div className="relative">
        {/* 좌측 화살표 */}
        <button
          type="button"
          onClick={() => scrollViewport(-1)}
          className="absolute left-0 top-0 bottom-1 z-10 flex items-center pl-0.5 pr-2 bg-gradient-to-r from-court-900 via-court-900/85 to-transparent"
          aria-label="이전 날짜"
        >
          <span className="rounded-md border border-court-700 bg-court-800/95 px-2 py-3 text-[16px] text-ink-300 hover:border-court-500 hover:text-ink-50 shadow-md">
            ←
          </span>
        </button>

        {/* 우측 화살표 */}
        <button
          type="button"
          onClick={() => scrollViewport(1)}
          className="absolute right-0 top-0 bottom-1 z-10 flex items-center pl-2 pr-0.5 bg-gradient-to-l from-court-900 via-court-900/85 to-transparent"
          aria-label="다음 날짜"
        >
          <span className="rounded-md border border-court-700 bg-court-800/95 px-2 py-3 text-[16px] text-ink-300 hover:border-court-500 hover:text-ink-50 shadow-md">
            →
          </span>
        </button>

        {/* 스크롤 컨테이너 */}
        <div
          ref={containerRef}
          className="flex gap-1 overflow-x-auto pb-1 scroll-smooth px-10 [scrollbar-width:thin]"
        >
          {allDates.map((d) => {
            const k = dateKey(d);
            const isSel = k === selectedDate;
            const isToday = k === todayKey;
            const dow = d.getDay();
            const count = gameCountByDate.get(k) ?? 0;
            const monthChange = d.getDate() === 1;
            return (
              <button
                key={k}
                ref={isSel ? selectedRef : null}
                onClick={() => onSelect(k)}
                className={[
                  "flex min-w-[56px] shrink-0 flex-col items-center rounded-lg border px-2 py-2 transition",
                  isSel
                    ? "border-flame-500/60 bg-flame-500/15 ring-1 ring-flame-500/30"
                    : isToday
                      ? "border-flame-500/30 bg-flame-500/5"
                      : count > 0
                        ? "border-court-700 bg-court-800/50 hover:border-court-600 hover:bg-court-700/40"
                        : "border-transparent bg-transparent text-ink-500 hover:border-court-700/50 hover:text-ink-300",
                ].join(" ")}
              >
                {monthChange && (
                  <span className="text-[9px] font-semibold text-flame-400">
                    {d.getMonth() + 1}월
                  </span>
                )}
                <span
                  className={[
                    "text-[13px] uppercase tracking-wider",
                    isToday
                      ? "text-flame-400 font-bold"
                      : dow === 0
                        ? "text-buzzer-400"
                        : dow === 6
                          ? "text-hoop-400"
                          : "text-ink-500",
                  ].join(" ")}
                >
                  {isToday ? "오늘" : DOW_LABELS[dow]}
                </span>
                <span
                  className={[
                    "stat-num mt-0.5 text-[18px] font-bold leading-none",
                    isSel
                      ? "text-flame-400"
                      : isToday
                        ? "text-ink-50"
                        : count > 0
                          ? "text-ink-100"
                          : "text-ink-500",
                  ].join(" ")}
                >
                  {d.getDate()}
                </span>
                <span
                  className="mt-1 h-1 w-1 rounded-full"
                  style={{
                    backgroundColor:
                      count > 0 ? (isSel ? "#fb923c" : "#94a3b8") : "transparent",
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-[13px] text-ink-500">
        ← / → 화살표를 누르거나 가로로 드래그/스와이프해서 다른 날짜로 이동
      </p>
    </div>
  );
}
