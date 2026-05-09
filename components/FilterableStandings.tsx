"use client";

import { useMemo, useState } from "react";
import { TEAM_COLORS, type FilteredTeam } from "@/lib/data";

type Filter = "all" | "home" | "away";

const FILTER_META: Record<Filter, { label: string; sub: string }> = {
  all:  { label: "전체",  sub: "시즌 전체 경기 기준" },
  home: { label: "홈",    sub: "홈 경기만 기준" },
  away: { label: "원정",  sub: "원정 경기만 기준" },
};

interface Props {
  filters: { all: FilteredTeam[]; home: FilteredTeam[]; away: FilteredTeam[] };
}

export function FilterableStandings({ filters }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const teams = filters[filter];

  // GB 계산 — 현재 필터의 선두팀 기준
  const gb = useMemo(() => {
    const leader = teams[0];
    return (t: FilteredTeam): string => {
      if (!leader) return "-";
      const v = ((leader.wins - t.wins) - (leader.losses - t.losses)) / 2;
      return v <= 0 ? "-" : v.toFixed(1);
    };
  }, [teams]);

  // 가장 많이 바뀐 팀 찾기 — 전체 대비 현재 필터 rank 차이
  const biggestMover = useMemo(() => {
    if (filter === "all") return null;
    const allMap = new Map(filters.all.map((t) => [t.code, t]));
    let best: { team: FilteredTeam; delta: number } | null = null;
    for (const t of teams) {
      const baseline = allMap.get(t.code);
      if (!baseline) continue;
      const delta = baseline.rank - t.rank; // 양수: 현재 필터에서 더 높음
      if (!best || Math.abs(delta) > Math.abs(best.delta)) {
        best = { team: t, delta };
      }
    }
    return best;
  }, [filters.all, teams, filter]);

  return (
    <div className="card p-5">
      {/* 헤더: 제목 + 필터 버튼 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-50">전체 순위 (10팀)</h2>
          <p className="mt-0.5 text-[14px] text-ink-500">
            {FILTER_META[filter].sub} · 필터 변경 시 순위가 재정렬됨
          </p>
        </div>
        <div className="flex rounded-md border border-court-700 bg-court-800/70 p-0.5">
          {(Object.keys(FILTER_META) as Filter[]).map((f) => {
            const active = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={[
                  "rounded px-3 py-1.5 text-[15px] font-medium transition",
                  active
                    ? "bg-flame-500/20 text-flame-400 ring-1 ring-flame-500/40"
                    : "text-ink-300 hover:text-ink-100",
                ].join(" ")}
              >
                {FILTER_META[f].label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 인사이트 배너 — 필터 변경 시 가장 큰 순위 변화 보여줌 */}
      {biggestMover && biggestMover.delta !== 0 && (
        <div className="mb-3 rounded-md border border-court-700/60 bg-court-900/40 px-3 py-2 text-[15px] text-ink-300">
          <span className="font-medium text-ink-100">{biggestMover.team.name}</span>{" "}
          {biggestMover.delta > 0 ? (
            <span>
              전체 {filters.all.find((t) => t.code === biggestMover.team.code)?.rank}위 →{" "}
              <span className="font-semibold text-hoop-400">
                {FILTER_META[filter].label}에서 {biggestMover.team.rank}위 (▲{biggestMover.delta})
              </span>
            </span>
          ) : (
            <span>
              전체 {filters.all.find((t) => t.code === biggestMover.team.code)?.rank}위 →{" "}
              <span className="font-semibold text-buzzer-400">
                {FILTER_META[filter].label}에서 {biggestMover.team.rank}위 (▼{Math.abs(biggestMover.delta)})
              </span>
            </span>
          )}
        </div>
      )}

      {/* 테이블 */}
      <div className="overflow-hidden rounded-lg border border-court-700/70">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-court-900/70 text-[14px] uppercase tracking-[0.1em] text-ink-500">
              <th className="py-2.5 pl-3 text-left font-medium">#</th>
              <th className="py-2.5 text-left font-medium">팀</th>
              <th className="py-2.5 text-right font-medium">경기</th>
              <th className="py-2.5 text-right font-medium">승</th>
              <th className="py-2.5 text-right font-medium">패</th>
              <th className="py-2.5 text-right font-medium">승률</th>
              <th className="py-2.5 text-right font-medium">GB</th>
              <th className="py-2.5 text-right font-medium">PPG</th>
              <th className="py-2.5 text-right font-medium">RPG</th>
              <th className="py-2.5 text-right font-medium">APG</th>
              <th className="py-2.5 pr-3 text-right font-medium">FG%</th>
            </tr>
          </thead>
          <tbody className="divider-y">
            {teams.map((t) => {
              const color = TEAM_COLORS[t.shortName] ?? "#94a3b8";
              return (
                <tr key={t.code} className="group transition hover:bg-court-700/30">
                  <td className="py-2.5 pl-3">
                    <span
                      className="stat-num text-[16px] font-semibold"
                      style={{ color }}
                    >
                      {t.rank}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[16px] font-medium text-ink-50">
                        {t.name}
                      </span>
                    </div>
                  </td>
                  <td className="stat-num py-2.5 text-right text-ink-300">{t.games}</td>
                  <td className="stat-num py-2.5 text-right text-ink-100">{t.wins}</td>
                  <td className="stat-num py-2.5 text-right text-ink-300">{t.losses}</td>
                  <td className="stat-num py-2.5 text-right font-medium text-ink-50">
                    {t.winPct.toFixed(3).replace(/^0/, "")}
                  </td>
                  <td className="stat-num py-2.5 text-right text-ink-300">{gb(t)}</td>
                  <td className="stat-num py-2.5 text-right text-ink-300">
                    {t.stats.points.toFixed(1)}
                  </td>
                  <td className="stat-num py-2.5 text-right text-ink-300">
                    {t.stats.rebounds.toFixed(1)}
                  </td>
                  <td className="stat-num py-2.5 text-right text-ink-300">
                    {t.stats.assists.toFixed(1)}
                  </td>
                  <td className="stat-num py-2.5 pr-3 text-right text-ink-300">
                    {t.stats.fgPct.toFixed(1)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
