"use client";

/**
 * 시즌 월 선택 칩 — 10월 ~ 다음해 6월 같은 시즌 월들을 가로 칩으로 표시.
 *  - 활성 월은 주황 강조
 *  - 비활성 월은 hover 가능
 *  - 작은 카운트 도트 표시 (선택사항)
 */
export function MonthPicker({
  months,
  current,
  onSelect,
  countByMonth,
}: {
  /** YYYY-MM 형식의 월 배열 */
  months: string[];
  /** 현재 선택된 YYYY-MM */
  current: string;
  onSelect: (ym: string) => void;
  /** Map<YYYY-MM, 경기수> — 칩에 작은 숫자 표시 */
  countByMonth?: Map<string, number>;
}) {
  if (months.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {months.map((ym) => {
        const active = ym === current;
        const [, m] = ym.split("-");
        const count = countByMonth?.get(ym) ?? 0;
        return (
          <button
            key={ym}
            onClick={() => onSelect(ym)}
            className={[
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[15px] font-medium transition",
              active
                ? "bg-flame-500/20 text-flame-400 ring-1 ring-flame-500/40"
                : "border border-court-700 bg-court-800/70 text-ink-300 hover:border-court-600 hover:text-ink-100",
            ].join(" ")}
          >
            <span>{parseInt(m, 10)}월</span>
            {count > 0 && (
              <span
                className={[
                  "stat-num text-[13px]",
                  active ? "text-flame-300/80" : "text-ink-500",
                ].join(" ")}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
