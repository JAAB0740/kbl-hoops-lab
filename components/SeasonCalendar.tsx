"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TEAM_COLORS } from "@/lib/data";
import { fmtDate, gameToId, type RawGame } from "@/lib/gamesUtil";

const DOW_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function ymLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}년 ${parseInt(m, 10)}월`;
}
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 시즌 캘린더 그리드 — 월별 7일 칸으로 표시.
 *  - 칸당 그날 경기들을 미니 형태로 표시
 *  - highlightTeam 가 있으면 그 팀 경기는 W/L 색칠로 강조
 *  - 칸 클릭 → 경기 상세 (1경기) / 그날 첫 경기 상세
 */
export function SeasonCalendar({
  games,
  highlightTeam,
}: {
  games: RawGame[];
  highlightTeam?: string;
}) {
  // 시즌 범위 자동 계산
  const months = useMemo(() => {
    if (games.length === 0) return [];
    const dates = games.map((g) => new Date(g.date + "T00:00:00")).sort((a, b) => a.getTime() - b.getTime());
    const first = dates[0];
    const last = dates[dates.length - 1];
    const out: string[] = [];
    let cur = new Date(first.getFullYear(), first.getMonth(), 1);
    const end = new Date(last.getFullYear(), last.getMonth(), 1);
    while (cur <= end) {
      out.push(ymKey(cur));
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return out;
  }, [games]);

  // 현재 표시 월 — 기본은 오늘이 포함된 월 (없으면 마지막 월)
  const todayYm = ymKey(new Date());
  const initialYm = months.includes(todayYm) ? todayYm : months[months.length - 1];
  const [currentYm, setCurrentYm] = useState<string>(initialYm ?? "");

  // 게임 → 날짜 그룹
  const byDate = useMemo(() => {
    const map = new Map<string, RawGame[]>();
    for (const g of games) {
      if (!map.has(g.date)) map.set(g.date, []);
      map.get(g.date)!.push(g);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [games]);

  if (months.length === 0 || !currentYm) {
    return (
      <div className="card p-8 text-center">
        <p className="text-[13px] text-ink-300">표시할 경기가 없어요.</p>
      </div>
    );
  }

  // 현재 월의 첫째 날
  const [yStr, mStr] = currentYm.split("-");
  const year = parseInt(yStr, 10);
  const monthIdx = parseInt(mStr, 10) - 1;
  const firstDay = new Date(year, monthIdx, 1);
  const lastDay = new Date(year, monthIdx + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay(); // 0=일

  // 그리드 셀 (앞쪽 빈 칸 + 일자들)
  const cells: ({ date: string; day: number } | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: dateKey(new Date(year, monthIdx, d)), day: d });
  }
  // 마지막 줄 채우기 (7의 배수)
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = dateKey(new Date());
  const idx = months.indexOf(currentYm);
  const prevYm = idx > 0 ? months[idx - 1] : null;
  const nextYm = idx < months.length - 1 ? months[idx + 1] : null;

  return (
    <div className="card p-5">
      {/* 월 네비게이션 */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            disabled={!prevYm}
            onClick={() => prevYm && setCurrentYm(prevYm)}
            className="rounded-md border border-court-700 bg-court-800/70 px-2.5 py-1 text-[12px] text-ink-300 hover:border-court-600 hover:text-ink-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← 이전
          </button>
          <h3 className="text-base font-semibold text-ink-50">
            {ymLabel(currentYm)}
          </h3>
          <button
            disabled={!nextYm}
            onClick={() => nextYm && setCurrentYm(nextYm)}
            className="rounded-md border border-court-700 bg-court-800/70 px-2.5 py-1 text-[12px] text-ink-300 hover:border-court-600 hover:text-ink-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            다음 →
          </button>
        </div>

        {/* 점프 칩 */}
        <div className="hidden flex-wrap gap-1 md:flex">
          {months.map((ym) => (
            <button
              key={ym}
              onClick={() => setCurrentYm(ym)}
              className={[
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition",
                ym === currentYm
                  ? "bg-flame-500/20 text-flame-400 ring-1 ring-flame-500/40"
                  : "border border-court-700 bg-court-800/40 text-ink-400 hover:text-ink-100",
              ].join(" ")}
            >
              {ym.slice(5)}월
            </button>
          ))}
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-t border-court-700/60">
        {DOW_LABELS.map((d, i) => (
          <div
            key={d}
            className={[
              "border-b border-r border-court-700/60 px-2 py-1.5 text-[10px] uppercase tracking-wider",
              i === 0
                ? "text-buzzer-400"
                : i === 6
                  ? "text-hoop-400"
                  : "text-ink-500",
            ].join(" ")}
          >
            {d}
          </div>
        ))}
      </div>

      {/* 일자 그리드 */}
      <div className="grid grid-cols-7">
        {cells.map((c, i) => {
          if (!c) {
            return (
              <div
                key={`empty-${i}`}
                className="min-h-[88px] border-b border-r border-court-700/60 bg-court-900/20"
              />
            );
          }
          const games = byDate.get(c.date) ?? [];
          const isToday = c.date === todayKey;
          const isWeekend = i % 7 === 0 || i % 7 === 6;
          return (
            <div
              key={c.date}
              className={[
                "min-h-[88px] border-b border-r border-court-700/60 p-1.5",
                isToday ? "bg-flame-500/5 ring-1 ring-inset ring-flame-500/30" : "",
                games.length === 0 && !isToday ? "bg-court-900/10" : "",
              ].join(" ")}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={[
                    "stat-num text-[11px] font-semibold",
                    isToday
                      ? "text-flame-400"
                      : isWeekend
                        ? "text-ink-300"
                        : "text-ink-400",
                  ].join(" ")}
                >
                  {c.day}
                </span>
                {games.length > 1 && (
                  <span className="rounded bg-court-700/60 px-1 text-[9px] text-ink-400">
                    {games.length}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {games.slice(0, 3).map((g, gi) => (
                  <CalendarGameMini
                    key={gi}
                    g={g}
                    highlightTeam={highlightTeam}
                  />
                ))}
                {games.length > 3 && (
                  <div className="text-[9px] text-ink-500 px-0.5">
                    +{games.length - 3}경기
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] text-ink-500">
        칸 안의 미니 카드를 클릭하면 경기 상세 페이지로 이동.
      </p>
    </div>
  );
}

function CalendarGameMini({
  g,
  highlightTeam,
}: {
  g: RawGame;
  highlightTeam?: string;
}) {
  const isFinal = g.status === "final";
  const homeColor = TEAM_COLORS[g.homeShort] ?? "#94a3b8";
  const awayColor = TEAM_COLORS[g.awayShort] ?? "#94a3b8";

  const involves = highlightTeam &&
    (g.homeShort === highlightTeam || g.awayShort === highlightTeam);
  const myWon = involves && isFinal && g.homeScore != null && g.awayScore != null && (
    (g.homeShort === highlightTeam && g.homeScore > g.awayScore) ||
    (g.awayShort === highlightTeam && g.awayScore > g.homeScore)
  );

  const wlBg = involves
    ? myWon
      ? "bg-hoop-500/20 ring-hoop-500/40"
      : isFinal
        ? "bg-buzzer-500/20 ring-buzzer-500/40"
        : "bg-flame-500/15 ring-flame-500/30"
    : "bg-court-800/40 ring-court-700/50";

  return (
    <Link
      href={`/games/${gameToId(g)}`}
      className={[
        "block rounded-sm px-1 py-0.5 text-[10px] ring-1 transition hover:bg-court-700/60",
        wlBg,
      ].join(" ")}
      title={`${g.tag} · ${g.homeShort} ${isFinal ? g.homeScore : ""} - ${isFinal ? g.awayScore : ""} ${g.awayShort}`}
    >
      <div className="flex items-center justify-between gap-1 truncate">
        <span className="flex items-center gap-0.5 truncate">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: homeColor }}
          />
          <span className="truncate">{g.homeShort}</span>
        </span>
        <span className="stat-num font-semibold text-ink-100 shrink-0">
          {isFinal ? `${g.homeScore}-${g.awayScore}` : g.time}
        </span>
        <span className="flex items-center gap-0.5 truncate justify-end">
          <span className="truncate">{g.awayShort}</span>
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: awayColor }}
          />
        </span>
      </div>
    </Link>
  );
}
