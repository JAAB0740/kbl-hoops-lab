"use client";

import { useMemo } from "react";
import { GameCard } from "@/components/GameCard";
import { SeasonCalendar } from "@/components/SeasonCalendar";
import { TeamScheduleSummary } from "@/components/TeamScheduleSummary";
import { DateStrip } from "@/components/DateStrip";
import { MonthPicker } from "@/components/MonthPicker";
import {
  ALL_GAMES,
  allTags,
  allTeamShorts,
  firstGameDateInMonth,
  fmtDate,
  groupByDate,
  seasonMonths as getSeasonMonths,
  type RawGame,
} from "@/lib/gamesUtil";
import { usePersistedState } from "@/lib/usePersistedState";
import { useScrollRestoration } from "@/lib/useScrollRestoration";

type Mode = "byday" | "month" | "calendar";

const MODES: { key: Mode; label: string; sub: string }[] = [
  { key: "byday",    label: "일자별", sub: "선택한 날" },
  { key: "month",    label: "월별",   sub: "한 달 전체" },
  { key: "calendar", label: "달력",   sub: "월별 그리드" },
];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const TODAY_KEY = dateKey(new Date());

/** 오늘 ≥ 가장 가까운 미래/오늘 게임 날짜 또는 가장 최근 과거 게임 날짜 */
function pickInitialDate(): string {
  // 우선 오늘에 경기 있으면 오늘
  if (ALL_GAMES.some((g) => g.date === TODAY_KEY)) return TODAY_KEY;
  // 가장 가까운 미래 (예정/진행 중)
  const future = ALL_GAMES
    .filter((g) => g.date >= TODAY_KEY && g.status !== "final")
    .map((g) => g.date)
    .sort();
  if (future[0]) return future[0];
  // 그것도 없으면 가장 최근 과거
  const past = ALL_GAMES
    .filter((g) => g.date <= TODAY_KEY)
    .map((g) => g.date)
    .sort();
  return past[past.length - 1] ?? TODAY_KEY;
}

export function GamesExplorer() {
  // 페이지 이동 후 뒤로 가기 시 모드·선택일·필터 보존
  useScrollRestoration();

  const [mode, setMode] = usePersistedState<Mode>("gamesExplorer:mode", "byday");
  const [selectedDate, setSelectedDate] = usePersistedState<string>(
    "gamesExplorer:selectedDate",
    pickInitialDate,
  );
  // 월별 모드용 — 기본은 selectedDate의 월
  const [selectedMonth, setSelectedMonth] = usePersistedState<string>(
    "gamesExplorer:selectedMonth",
    () => pickInitialDate().slice(0, 7),
  );
  const [team, setTeam] = usePersistedState<string | null>("gamesExplorer:team", null);
  const [tag, setTag] = usePersistedState<string | null>("gamesExplorer:tag", null);

  const teams = useMemo(() => allTeamShorts({ kblOnly: true }), []);
  const tags = useMemo(() => allTags(), []);
  const months = useMemo(() => getSeasonMonths(), []);

  // 날짜별 게임 수 (DateStrip 도트용)
  const gameCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of ALL_GAMES) {
      // 팀/태그 필터 반영해서 카운트
      if (team && g.homeShort !== team && g.awayShort !== team) continue;
      if (tag && g.tag !== tag) continue;
      map.set(g.date, (map.get(g.date) ?? 0) + 1);
    }
    return map;
  }, [team, tag]);

  // 월별 게임 수 (MonthPicker 보조)
  const gameCountByMonth = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of ALL_GAMES) {
      if (team && g.homeShort !== team && g.awayShort !== team) continue;
      if (tag && g.tag !== tag) continue;
      const ym = g.date.slice(0, 7);
      map.set(ym, (map.get(ym) ?? 0) + 1);
    }
    return map;
  }, [team, tag]);

  // 빠른 점프 — 가장 최근 종료 게임 / 다음 예정 게임
  const lastFinalDate = useMemo(() => {
    const finals = ALL_GAMES.filter((g) => g.status === "final" && g.date <= TODAY_KEY);
    finals.sort((a, b) => b.date.localeCompare(a.date));
    return finals[0]?.date ?? null;
  }, []);
  const nextScheduledDate = useMemo(() => {
    const sched = ALL_GAMES.filter((g) => g.date >= TODAY_KEY && g.status !== "final");
    sched.sort((a, b) => a.date.localeCompare(b.date));
    return sched[0]?.date ?? null;
  }, []);

  // 월 점프: 클릭한 월의 첫 경기일 (없으면 1일)
  function monthJump(ym: string): string {
    return firstGameDateInMonth(ym) ?? `${ym}-01`;
  }

  // 일자별 모드 — selectedDate 의 게임만
  const bydayGames: RawGame[] = useMemo(() => {
    let arr = ALL_GAMES.filter((g) => g.date === selectedDate);
    if (team) {
      arr = arr.filter((g) => g.homeShort === team || g.awayShort === team);
    }
    if (tag) arr = arr.filter((g) => g.tag === tag);
    arr.sort((a, b) => a.time.localeCompare(b.time));
    return arr;
  }, [selectedDate, team, tag]);

  // 월별 모드 — selectedMonth 의 게임만
  const monthGames: RawGame[] = useMemo(() => {
    let arr = ALL_GAMES.filter((g) => g.date.startsWith(selectedMonth));
    if (team) {
      arr = arr.filter((g) => g.homeShort === team || g.awayShort === team);
    }
    if (tag) arr = arr.filter((g) => g.tag === tag);
    arr.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return arr;
  }, [selectedMonth, team, tag]);

  const monthGrouped = useMemo(() => {
    const map = groupByDate(monthGames);
    const dates = [...map.keys()].sort();
    return { map, dates };
  }, [monthGames]);

  // 달력 모드 — 필터만 적용 (전체 시즌)
  const allFilteredGames: RawGame[] = useMemo(() => {
    let arr = ALL_GAMES.slice();
    if (team) {
      arr = arr.filter((g) => g.homeShort === team || g.awayShort === team);
    }
    if (tag) arr = arr.filter((g) => g.tag === tag);
    return arr;
  }, [team, tag]);

  return (
    <>
      {/* 모드 탭 */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {MODES.map((m) => {
          const active = mode === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={[
                "rounded-lg border px-3 py-3 text-left transition",
                active
                  ? "border-flame-500/40 bg-flame-500/10"
                  : "border-court-700 bg-court-900/40 hover:border-court-600",
              ].join(" ")}
            >
              <div
                className={[
                  "text-[14px] uppercase tracking-wider",
                  active ? "text-flame-300" : "text-ink-500",
                ].join(" ")}
              >
                {m.sub}
              </div>
              <div
                className={[
                  "mt-1 text-base font-semibold",
                  active ? "text-flame-400" : "text-ink-100",
                ].join(" ")}
              >
                {m.label}
              </div>
            </button>
          );
        })}
      </div>

      {/* 날짜 strip — 일자별 모드 */}
      {mode === "byday" && (
        <>
          <DateStrip
            selectedDate={selectedDate}
            onSelect={setSelectedDate}
            gameCountByDate={gameCountByDate}
            seasonMonths={months}
            monthJumpTarget={monthJump}
          />

          {/* 빠른 점프 */}
          <div className="mb-4 flex flex-wrap gap-2">
            {lastFinalDate && lastFinalDate !== selectedDate && (
              <button
                onClick={() => setSelectedDate(lastFinalDate)}
                className="rounded-md border border-court-700 bg-court-800/70 px-3 py-1.5 text-[14px] text-ink-300 hover:border-court-600 hover:text-ink-100"
              >
                ← 최근 종료 ({fmtDate(lastFinalDate)})
              </button>
            )}
            {nextScheduledDate && nextScheduledDate !== selectedDate && (
              <button
                onClick={() => setSelectedDate(nextScheduledDate)}
                className="rounded-md border border-court-700 bg-court-800/70 px-3 py-1.5 text-[14px] text-ink-300 hover:border-court-600 hover:text-ink-100"
              >
                다음 예정 ({fmtDate(nextScheduledDate)}) →
              </button>
            )}
          </div>
        </>
      )}

      {/* 월별 모드 — 월 picker */}
      {mode === "month" && (
        <div className="card mb-4 p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold tracking-tight text-ink-50">
              월 선택
            </h3>
            <span className="text-[14px] text-ink-500">
              칩의 작은 숫자 = 해당 월 경기 수 (필터 적용)
            </span>
          </div>
          <MonthPicker
            months={months}
            current={selectedMonth}
            onSelect={setSelectedMonth}
            countByMonth={gameCountByMonth}
          />
        </div>
      )}

      {/* 필터 카드 */}
      <div className="card mb-4 p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold tracking-tight text-ink-50">
            필터
          </h3>
          {mode === "byday" ? (
            <span className="chip border-flame-500/30 bg-flame-500/10 text-flame-400">
              {fmtDate(selectedDate)} · {bydayGames.length}경기
            </span>
          ) : mode === "month" ? (
            <span className="chip border-flame-500/30 bg-flame-500/10 text-flame-400">
              {parseInt(selectedMonth.split("-")[1], 10)}월 · {monthGames.length}경기 ·{" "}
              {monthGrouped.dates.length}일
            </span>
          ) : (
            <span className="chip border-flame-500/30 bg-flame-500/10 text-flame-400">
              {allFilteredGames.length}경기 (시즌 전체)
            </span>
          )}
        </div>

        {/* 팀 — KBL 정식 10팀만 */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="w-12 shrink-0 text-[14px] uppercase tracking-wider text-ink-500">
            팀
          </span>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={team === null} onClick={() => setTeam(null)}>
              전체
            </Chip>
            {teams.map((t) => (
              <Chip
                key={t}
                active={team === t}
                onClick={() => setTeam(team === t ? null : t)}
              >
                {t}
              </Chip>
            ))}
          </div>
        </div>

        {/* 구분 — 정규/PO/EASL/올스타 모두 표시 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-12 shrink-0 text-[14px] uppercase tracking-wider text-ink-500">
            구분
          </span>
          <div className="flex flex-wrap gap-1.5">
            <Chip active={tag === null} onClick={() => setTag(null)}>
              전체
            </Chip>
            {tags.map((t) => (
              <Chip
                key={t}
                active={tag === t}
                onClick={() => setTag(tag === t ? null : t)}
              >
                {t}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* 팀 선택 시 — 팀 시즌 요약 (월별/달력 모드) */}
      {team && (mode === "month" || mode === "calendar") && (
        <TeamScheduleSummary teamShort={team} />
      )}

      {/* 모드별 본문 */}
      {mode === "calendar" ? (
        <SeasonCalendar games={allFilteredGames} highlightTeam={team ?? undefined} />
      ) : mode === "byday" ? (
        bydayGames.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-[16px] text-ink-300">
              <span className="font-semibold text-ink-100">
                {fmtDate(selectedDate)}
              </span>
              에 경기가 없어요.
            </p>
            <p className="mt-1 text-[14px] text-ink-500">
              위쪽 strip에서 다른 날짜를 선택하거나 필터를 조정해보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {bydayGames.map((g, i) => (
              <GameCard key={`byday-${i}`} game={g} />
            ))}
          </div>
        )
      ) : (
        // 월별 모드
        monthGames.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-[16px] text-ink-300">
              <span className="font-semibold text-ink-100">
                {parseInt(selectedMonth.split("-")[1], 10)}월
              </span>
              에 경기가 없어요.
            </p>
            <p className="mt-1 text-[14px] text-ink-500">
              다른 월을 선택하거나 필터를 조정해보세요.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {monthGrouped.dates.map((d) => {
              const games = monthGrouped.map.get(d) ?? [];
              const isToday = d === TODAY_KEY;
              return (
                <section key={d}>
                  <div className="mb-2 flex items-center gap-2">
                    <h3
                      className={[
                        "text-sm font-semibold",
                        isToday ? "text-flame-400" : "text-ink-100",
                      ].join(" ")}
                    >
                      {fmtDate(d)}
                    </h3>
                    {isToday && (
                      <span className="chip border-flame-500/30 bg-flame-500/10 text-flame-400">
                        오늘
                      </span>
                    )}
                    <span className="text-[14px] text-ink-500">
                      {games.length}경기
                    </span>
                  </div>
                  <div className="space-y-2">
                    {games.map((g, i) => (
                      <GameCard key={`${g.date}-${g.time}-${i}`} game={g} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )
      )}
    </>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-md px-3 py-1.5 text-[15px] font-medium transition",
        active
          ? "bg-flame-500/20 text-flame-400 ring-1 ring-flame-500/40"
          : "border border-court-700 bg-court-800/70 text-ink-300 hover:border-court-600 hover:text-ink-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
