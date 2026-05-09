"use client";

import { useMemo } from "react";
import type { FilteredTeam } from "@/lib/data";
import { TEAM_COLORS } from "@/lib/data";
import clutchJson from "@/data/clutch.json";

/**
 * 팀 클러치 vs 시즌 평균 비교.
 *  - 클러치 정의: 4쿼터 마지막 5분 + 5점차 이내
 *  - clutch.json (선수 단위) → 팀별로 집계
 *      games/wins/losses = max across team's players
 *      counting stats = sum(player.stat × player.games)
 *      ratios = total made / total att 재계산
 *  - 시즌 평균: filters.all (정규시즌 전체)
 */

type ClutchPlayer = {
  teamName4: string;
  games: number;
  wins: number;
  losses: number;
  points: number;
  fgMade: number; fgAtt: number;
  threeMade: number; threeAtt: number;
  ftMade: number; ftAtt: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
};

type TeamClutch = {
  shortName: string;
  games: number;
  wins: number;
  losses: number;
  ppg: number;
  fgPct: number;
  threePct: number;
  ftPct: number;
  tov: number;
};

function aggregatePerTeam(players: ClutchPlayer[]): Map<string, TeamClutch> {
  const byTeam = new Map<string, ClutchPlayer[]>();
  for (const p of players) {
    if (!p.teamName4) continue;
    if (!byTeam.has(p.teamName4)) byTeam.set(p.teamName4, []);
    byTeam.get(p.teamName4)!.push(p);
  }
  const out = new Map<string, TeamClutch>();
  for (const [team, rows] of byTeam) {
    if (rows.length === 0) continue;
    const games = Math.max(...rows.map((r) => r.games));
    const wins = Math.max(...rows.map((r) => r.wins));
    const losses = Math.max(...rows.map((r) => r.losses));
    if (games === 0) continue;
    // 합산 (선수당 평균 × 게임수 = 합산)
    const sum = (pick: (r: ClutchPlayer) => number) =>
      rows.reduce((n, r) => n + pick(r) * r.games, 0);
    const totFgMade = sum((r) => r.fgMade);
    const totFgAtt  = sum((r) => r.fgAtt);
    const tot3Made  = sum((r) => r.threeMade);
    const tot3Att   = sum((r) => r.threeAtt);
    const totFtMade = sum((r) => r.ftMade);
    const totFtAtt  = sum((r) => r.ftAtt);
    const totPts    = sum((r) => r.points);
    const totTov    = sum((r) => r.turnovers);
    out.set(team, {
      shortName: team,
      games,
      wins,
      losses,
      ppg: totPts / games,
      fgPct: totFgAtt > 0 ? (totFgMade / totFgAtt) * 100 : 0,
      threePct: tot3Att > 0 ? (tot3Made / tot3Att) * 100 : 0,
      ftPct: totFtAtt > 0 ? (totFtMade / totFtAtt) * 100 : 0,
      tov: totTov / games,
    });
  }
  return out;
}

export function TeamClutchCompare({
  baseline,
  title = "클러치 vs 시즌 평균 비교",
}: {
  /** 기준이 되는 시즌 평균 (정규시즌 전체) */
  baseline: FilteredTeam[];
  title?: string;
}) {
  const clutchByTeam = useMemo(() => {
    type Json = { players?: { regular?: ClutchPlayer[] } };
    const arr = (clutchJson as Json).players?.regular ?? [];
    return aggregatePerTeam(arr);
  }, []);

  const rows = useMemo(() => {
    return baseline
      .map((b) => {
        const c = clutchByTeam.get(b.shortName);
        if (!c || c.games === 0) return null;
        return {
          team: b,
          clutch: c,
          regWinPct: b.winPct,
          clutchWinPct: c.games > 0 ? c.wins / c.games : 0,
          dWinPct: (c.games > 0 ? c.wins / c.games : 0) - b.winPct,
          regFgPct: b.stats.fgPct,
          dFgPct: c.fgPct - b.stats.fgPct,
          reg3Pct: b.stats.threePct,
          d3Pct: c.threePct - b.stats.threePct,
          regPPG: b.stats.points,
          dPPG: c.ppg - b.stats.points,
          regTOV: b.stats.turnovers,
          dTOV: c.tov - b.stats.turnovers,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.dWinPct - a.dWinPct);
  }, [baseline, clutchByTeam]);

  if (rows.length === 0) return null;

  // 가장 박빙에 강한/약한 팀
  const clutchKing = rows[0];
  const clutchChoker = rows[rows.length - 1];

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
          <p className="mt-0.5 text-[13px] text-ink-500">
            클러치 = 4쿼터 마지막 5분 + 5점차 이내 · 정규시즌 기준 · 막대 = 클러치 - 시즌 차이
          </p>
        </div>
        <div className="flex gap-3 text-[13px]">
          <div>
            <div className="text-ink-500">클러치 강자</div>
            <div className="stat-num mt-0.5 font-medium text-hoop-400">
              {clutchKing.team.shortName} · 승률 +
              {(clutchKing.dWinPct * 100).toFixed(1)}%p
            </div>
          </div>
          <div>
            <div className="text-ink-500">클러치 약점</div>
            <div className="stat-num mt-0.5 font-medium text-buzzer-400">
              {clutchChoker.team.shortName} · 승률{" "}
              {clutchChoker.dWinPct >= 0 ? "+" : ""}
              {(clutchChoker.dWinPct * 100).toFixed(1)}%p
            </div>
          </div>
        </div>
      </div>

      {/* 헤더 */}
      <div className="mb-2 grid grid-cols-[110px_70px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-1 text-[12px] uppercase tracking-wider text-ink-500">
        <span>팀</span>
        <span className="text-right">클러치 W-L</span>
        <span>승률 (vs 시즌)</span>
        <span>FG% (vs 시즌)</span>
        <span>3P% (vs 시즌)</span>
        <span>PPG (vs 시즌)</span>
      </div>

      <div className="space-y-2">
        {rows.map((r) => {
          const color = TEAM_COLORS[r.team.shortName] ?? "#94a3b8";
          return (
            <div
              key={r.team.code}
              className="grid grid-cols-[110px_70px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3"
            >
              <span className="flex items-center gap-2 truncate text-[15px] font-medium text-ink-100">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                {r.team.name}
              </span>
              <span className="stat-num text-right text-[14px] text-ink-300">
                {r.clutch.wins}-{r.clutch.losses}
              </span>
              <DiffBar
                value={r.clutchWinPct * 100}
                base={r.regWinPct * 100}
                fmtCurr={(v) => `${v.toFixed(1)}%`}
                higherIsBetter
                rangeAbs={50}
              />
              <DiffBar
                value={r.clutch.fgPct}
                base={r.regFgPct}
                fmtCurr={(v) => `${v.toFixed(1)}%`}
                higherIsBetter
                rangeAbs={20}
              />
              <DiffBar
                value={r.clutch.threePct}
                base={r.reg3Pct}
                fmtCurr={(v) => `${v.toFixed(1)}%`}
                higherIsBetter
                rangeAbs={30}
              />
              <DiffBar
                value={r.clutch.ppg}
                base={r.regPPG}
                fmtCurr={(v) => v.toFixed(1)}
                higherIsBetter
                rangeAbs={Math.max(20, r.regPPG)}
              />
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-[12px] text-ink-500">
        ※ 클러치 PPG는 한 경기 클러치 시간(약 5분) 동안의 득점이라 시즌 PPG보다 작은 게 정상.
        승률·슛 효율 차이가 진짜 클러치 능력의 지표.
      </p>
    </div>
  );
}

function DiffBar({
  value,
  base,
  fmtCurr,
  higherIsBetter,
  rangeAbs,
}: {
  /** 현재값 (클러치) */
  value: number;
  /** 기준값 (시즌 평균) */
  base: number;
  fmtCurr: (v: number) => string;
  higherIsBetter: boolean;
  /** 막대 범위 |diff| 최대 (이를 넘으면 100%) */
  rangeAbs: number;
}) {
  const diff = value - base;
  const better = higherIsBetter ? diff > 0 : diff < 0;
  const widthPct = Math.min(100, (Math.abs(diff) / rangeAbs) * 100);
  const tone = diff === 0 ? "neutral" : better ? "good" : "bad";
  const barClass =
    tone === "good"
      ? "bg-hoop-500/80"
      : tone === "bad"
        ? "bg-buzzer-500/80"
        : "bg-ink-500/40";

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex h-3 min-w-0 flex-1 overflow-hidden rounded bg-court-700/40">
        {/* 중앙선 */}
        <div className="absolute left-1/2 top-0 h-full w-px bg-ink-200/30" />
        {/* 막대: 중앙에서 좌/우로 뻗어나감 */}
        {diff >= 0 ? (
          <div
            className={`absolute left-1/2 top-0 h-full ${barClass}`}
            style={{ width: `${widthPct / 2}%` }}
          />
        ) : (
          <div
            className={`absolute right-1/2 top-0 h-full ${barClass}`}
            style={{ width: `${widthPct / 2}%` }}
          />
        )}
      </div>
      <div className="stat-num whitespace-nowrap text-right text-[13px]">
        <span className="text-ink-100">{fmtCurr(value)}</span>
        <span
          className={[
            "ml-1",
            tone === "good"
              ? "text-hoop-400"
              : tone === "bad"
                ? "text-buzzer-400"
                : "text-ink-500",
          ].join(" ")}
        >
          ({diff >= 0 ? "+" : ""}
          {diff.toFixed(1)})
        </span>
      </div>
    </div>
  );
}
