"use client";

import { useState } from "react";
import type { FilteredTeam } from "@/lib/data";

/**
 * Dean Oliver의 4팩터 (Four Factors of Basketball Success)
 *  1) eFG% — 슈팅 효율 (3점에 가중치)
 *  2) TOV% — 턴오버 비율 (낮을수록 좋음)
 *  3) OREB% — 공격 리바운드 비율
 *  4) FTA Rate — 자유투 의존도 (FTA/FGA)
 *
 * - PC(md+): 4열 grid 로 한 팀 한 행에 4팩터 동시 비교
 * - 모바일(<md): 4개 탭 중 하나 선택 → 그 metric 의 10팀 막대만 정렬 표시
 *   (탭별 한 화면에서 비교 — 스크롤 압박 해소)
 */

type FactorKey = "efg" | "tov" | "oreb" | "ftaRt";

export function TeamFourFactors({
  teams,
  title = "4팩터 분석",
}: {
  teams: FilteredTeam[];
  title?: string;
}) {
  const withAdv = teams.filter((t) => t.advanced);
  const [activeKey, setActiveKey] = useState<FactorKey>("efg");

  if (withAdv.length === 0) return null;

  type Row = {
    team: FilteredTeam;
    efg: number;   // eFG%
    tov: number;   // TOV%
    oreb: number;  // OREB%
    ftaRt: number; // FTA / FGA × 100
  };

  const data: Row[] = withAdv.map((t) => {
    const fga = t.stats.fgAtt ?? 0;
    const fta = t.stats.ftAtt ?? 0;
    return {
      team: t,
      efg: t.advanced!.efgPct,
      tov: t.advanced!.tovPct,
      oreb: t.advanced!.orebPct,
      ftaRt: fga > 0 ? (fta / fga) * 100 : 0,
    };
  });

  // 리그 평균
  const avg = (pick: (r: Row) => number) =>
    data.reduce((s, r) => s + pick(r), 0) / data.length;
  const avgEfg  = avg((r) => r.efg);
  const avgTov  = avg((r) => r.tov);
  const avgOreb = avg((r) => r.oreb);
  const avgFta  = avg((r) => r.ftaRt);

  // PC 정렬: efg 높은 순 (고정)
  const sortedDesktop = [...data].sort((a, b) => b.efg - a.efg);

  // 각 factor의 [min, max] for bar scaling
  const range = (vals: number[]) => {
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const pad = (mx - mn) * 0.1 + 0.5;
    return { mn: mn - pad, mx: mx + pad };
  };
  const efgR = range(data.map((d) => d.efg));
  const tovR = range(data.map((d) => d.tov));
  const orebR = range(data.map((d) => d.oreb));
  const ftaR = range(data.map((d) => d.ftaRt));

  // 모바일 탭 메타 — 각 factor의 정보 통합
  const FACTOR_META: Record<
    FactorKey,
    {
      label: string;
      desc: string;
      better: string;
      avg: number;
      range: { mn: number; mx: number };
      invert: boolean;
      pick: (r: Row) => number;
    }
  > = {
    efg:   { label: "eFG%",      desc: "슈팅 효율",       better: "높을수록 ↑", avg: avgEfg,  range: efgR,  invert: false, pick: (r) => r.efg },
    tov:   { label: "TOV%",      desc: "턴오버 비율",      better: "낮을수록 ↓", avg: avgTov,  range: tovR,  invert: true,  pick: (r) => r.tov },
    oreb:  { label: "OREB%",     desc: "공격 리바",        better: "높을수록 ↑", avg: avgOreb, range: orebR, invert: false, pick: (r) => r.oreb },
    ftaRt: { label: "FTA Rate",  desc: "자유투 의존도",    better: "높을수록 ↑", avg: avgFta,  range: ftaR,  invert: false, pick: (r) => r.ftaRt },
  };

  const active = FACTOR_META[activeKey];
  // invert면 오름차순(낮을수록 좋음), 아니면 내림차순
  const sortedMobile = [...data].sort((a, b) =>
    active.invert ? active.pick(a) - active.pick(b) : active.pick(b) - active.pick(a),
  );

  const FACTOR_KEYS: FactorKey[] = ["efg", "tov", "oreb", "ftaRt"];

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
          <p className="mt-0.5 text-[14px] text-ink-500">
            Dean Oliver 4팩터 — 막대는 리그 평균 대비 위치 · 초록=평균↑, 빨강=평균↓ (TOV%만 반대)
          </p>
        </div>
      </div>

      {/* ─── 모바일: 탭 + 단일 팩터 막대 (md 미만) ─── */}
      <div className="md:hidden">
        {/* 탭 메뉴 — 가로 스크롤 */}
        <div
          role="tablist"
          aria-label="4팩터 선택"
          className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
        >
          {FACTOR_KEYS.map((k) => {
            const meta = FACTOR_META[k];
            const isActive = activeKey === k;
            return (
              <button
                key={k}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveKey(k)}
                className={[
                  "shrink-0 rounded-md border px-3 py-1.5 text-[14px] font-medium transition",
                  isActive
                    ? "border-flame-500/40 bg-flame-500/20 text-flame-400"
                    : "border-court-700 bg-court-800/70 text-ink-300 hover:border-court-600",
                ].join(" ")}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
        <p className="mb-2 text-[12px] text-ink-500">
          {active.desc} · 리그 평균 <span className="stat-num text-ink-300">{active.avg.toFixed(1)}</span> · {active.better}
        </p>

        <div className="space-y-2.5">
          {sortedMobile.map((d, i) => (
            <SingleBarRow
              key={d.team.code}
              rank={i + 1}
              teamName={d.team.name}
              value={active.pick(d)}
              avg={active.avg}
              range={active.range}
              invert={active.invert}
            />
          ))}
        </div>
      </div>

      {/* ─── PC: 4열 grid (md+) ─── */}
      <div className="hidden md:block">
        {/* 헤더 */}
        <div className="mb-2 grid grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-1 text-[13px] uppercase tracking-wider text-ink-500">
          <span>팀</span>
          <FactorHeader name="eFG%"      desc="슈팅 효율"     avg={avgEfg}  better="높을수록 ↑" />
          <FactorHeader name="TOV%"      desc="턴오버 비율"   avg={avgTov}  better="낮을수록 ↓" />
          <FactorHeader name="OREB%"     desc="공격 리바"     avg={avgOreb} better="높을수록 ↑" />
          <FactorHeader name="FTA Rate"  desc="자유투 의존도" avg={avgFta}  better="높을수록 ↑" />
        </div>

        <div className="space-y-2">
          {sortedDesktop.map((d) => (
            <div
              key={d.team.code}
              className="grid grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3"
            >
              <span className="truncate text-[16px] font-medium text-ink-100">
                {d.team.name}
              </span>
              <FactorCell value={d.efg}   avg={avgEfg}  range={efgR}  invert={false} />
              <FactorCell value={d.tov}   avg={avgTov}  range={tovR}  invert={true} />
              <FactorCell value={d.oreb}  avg={avgOreb} range={orebR} invert={false} />
              <FactorCell value={d.ftaRt} avg={avgFta}  range={ftaR}  invert={false} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FactorHeader({
  name,
  desc,
  avg,
  better,
}: {
  name: string;
  desc: string;
  avg: number;
  better: string;
}) {
  return (
    <div>
      <span className="font-semibold text-ink-300">{name}</span>{" "}
      <span className="text-ink-500">· {desc}</span>
      <div className="text-[13px] normal-case tracking-normal text-ink-600">
        리그 평균 {avg.toFixed(1)} · {better}
      </div>
    </div>
  );
}

function FactorCell({
  value,
  avg,
  range,
  invert,
}: {
  value: number;
  avg: number;
  range: { mn: number; mx: number };
  invert: boolean;
}) {
  const span = range.mx - range.mn;
  const pct = span > 0 ? ((value - range.mn) / span) * 100 : 50;
  const avgPct = span > 0 ? ((avg - range.mn) / span) * 100 : 50;
  // 평균보다 우위 여부
  const above = invert ? value < avg : value > avg;
  const barColor = above
    ? "bg-hoop-500/80"  // 좋음 (초록)
    : "bg-buzzer-500/80"; // 나쁨 (빨강)
  const diff = value - avg;

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-3 min-w-0 flex-1 overflow-hidden rounded bg-court-700/40">
        <div
          className={`h-full ${barColor}`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
        {/* 평균 마커 */}
        <div
          className="absolute top-0 h-full w-px bg-ink-200/70"
          style={{ left: `${Math.max(0, Math.min(100, avgPct))}%` }}
          title={`평균 ${avg.toFixed(1)}`}
        />
      </div>
      <div className="stat-num whitespace-nowrap text-right text-[14px]">
        <span className={above ? "font-semibold text-hoop-400" : "font-semibold text-buzzer-400"}>
          {value.toFixed(1)}
        </span>
        <span className="ml-1 text-ink-500">
          ({diff >= 0 ? "+" : ""}{diff.toFixed(1)})
        </span>
      </div>
    </div>
  );
}

/** 모바일 탭 모드 — 한 팀 한 행 (rank + 팀명 + 막대 + 값) */
function SingleBarRow({
  rank,
  teamName,
  value,
  avg,
  range,
  invert,
}: {
  rank: number;
  teamName: string;
  value: number;
  avg: number;
  range: { mn: number; mx: number };
  invert: boolean;
}) {
  const span = range.mx - range.mn;
  const pct = span > 0 ? ((value - range.mn) / span) * 100 : 50;
  const avgPct = span > 0 ? ((avg - range.mn) / span) * 100 : 50;
  const above = invert ? value < avg : value > avg;
  const barColor = above ? "bg-hoop-500/80" : "bg-buzzer-500/80";
  const diff = value - avg;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-baseline gap-2 text-[15px] font-medium text-ink-100">
          <span className="stat-num w-5 shrink-0 text-[13px] text-ink-500">{rank}</span>
          <span className="truncate">{teamName}</span>
        </span>
        <span className="stat-num shrink-0 whitespace-nowrap text-[14px]">
          <span className={above ? "font-semibold text-hoop-400" : "font-semibold text-buzzer-400"}>
            {value.toFixed(1)}
          </span>
          <span className="ml-1 text-ink-500">
            ({diff >= 0 ? "+" : ""}{diff.toFixed(1)})
          </span>
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded bg-court-700/40">
        <div
          className={`h-full ${barColor}`}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
        <div
          className="absolute top-0 h-full w-px bg-ink-200/70"
          style={{ left: `${Math.max(0, Math.min(100, avgPct))}%` }}
        />
      </div>
    </div>
  );
}
