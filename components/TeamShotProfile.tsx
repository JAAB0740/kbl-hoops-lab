"use client";

import { useState } from "react";
import type { FilteredTeam } from "@/lib/data";

/**
 * 팀별 슛 프로필 — 시도 분포 (2점 / 3점 / 자유투).
 *
 * - PC(md+): 100% normalized stacked bar (한 팀 한 행에 3색 한꺼번에)
 * - 모바일(<md): 탭 (2점 / 3점 / 자유투) — 선택된 카테고리의 10팀 비중 정렬
 */

type ShotKey = "two" | "three" | "ft";

export function TeamShotProfile({
  teams,
  title = "팀별 슛 프로필",
}: {
  teams: FilteredTeam[];
  title?: string;
}) {
  const [activeKey, setActiveKey] = useState<ShotKey>("three");

  if (!teams || teams.length === 0) return null;

  const data = teams.map((t) => {
    const twoA = (t.stats.fgAtt ?? 0) - (t.stats.threeAtt ?? 0);
    const threeA = t.stats.threeAtt ?? 0;
    const ftA = t.stats.ftAtt ?? 0;
    const total = twoA + threeA + ftA;
    return {
      team: t,
      twoA: Math.max(0, twoA),
      threeA,
      ftA,
      total,
    };
  });

  const anyNonZero = data.some((d) => d.total > 0);
  if (!anyNonZero) return null;

  // PC 정렬: 3점 비중 큰 순
  const sortedDesktop = [...data].sort(
    (a, b) =>
      (b.threeA / Math.max(b.total, 1e-9)) -
      (a.threeA / Math.max(a.total, 1e-9)),
  );

  const threeLeader = sortedDesktop[0];
  const twoLeader = [...data].sort(
    (a, b) =>
      (b.twoA / Math.max(b.total, 1e-9)) -
      (a.twoA / Math.max(a.total, 1e-9)),
  )[0];
  const ftLeader = [...data].sort(
    (a, b) =>
      (b.ftA / Math.max(b.total, 1e-9)) -
      (a.ftA / Math.max(a.total, 1e-9)),
  )[0];

  // 모바일 탭 메타
  const SHOT_META: Record<
    ShotKey,
    { label: string; barColor: string; pickShare: (d: typeof data[number]) => number }
  > = {
    two:   { label: "2점", barColor: "bg-neon-500/80",   pickShare: (d) => d.twoA / Math.max(d.total, 1e-9) },
    three: { label: "3점", barColor: "bg-buzzer-500/80", pickShare: (d) => d.threeA / Math.max(d.total, 1e-9) },
    ft:    { label: "자유투", barColor: "bg-flame-400/80", pickShare: (d) => d.ftA / Math.max(d.total, 1e-9) },
  };
  const active = SHOT_META[activeKey];
  const sortedMobile = [...data].sort((a, b) => active.pickShare(b) - active.pickShare(a));
  const SHOT_KEYS: ShotKey[] = ["two", "three", "ft"];

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
          <p className="mt-0.5 text-[14px] text-ink-500">
            시도 비중 (100%) · 시안 = 2점 · 자홍 = 3점 · 노랑 = 자유투
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[14px] md:flex-nowrap">
          <div>
            <div className="text-ink-500">3점 의존도 1위</div>
            <div className="stat-num mt-0.5 font-medium text-buzzer-400">
              {threeLeader.team.shortName} ·{" "}
              {((threeLeader.threeA / Math.max(threeLeader.total, 1e-9)) * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-ink-500">2점 의존도 1위</div>
            <div className="stat-num mt-0.5 font-medium text-neon-400">
              {twoLeader.team.shortName} ·{" "}
              {((twoLeader.twoA / Math.max(twoLeader.total, 1e-9)) * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-ink-500">자유투 의존도 1위</div>
            <div className="stat-num mt-0.5 font-medium text-flame-400">
              {ftLeader.team.shortName} ·{" "}
              {((ftLeader.ftA / Math.max(ftLeader.total, 1e-9)) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* ─── 모바일: 탭 + 단일 카테고리 막대 ─── */}
      <div className="md:hidden">
        <div
          role="tablist"
          className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
        >
          {SHOT_KEYS.map((k) => {
            const meta = SHOT_META[k];
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

        <div className="space-y-2.5">
          {sortedMobile.map((d, i) => {
            const share = active.pickShare(d) * 100;
            return (
              <div key={d.team.code} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-baseline gap-2 text-[15px] font-medium text-ink-100">
                    <span className="stat-num w-5 shrink-0 text-[13px] text-ink-500">{i + 1}</span>
                    <span className="truncate">{d.team.name}</span>
                  </span>
                  <span className="stat-num shrink-0 whitespace-nowrap text-[14px]">
                    <span className="font-semibold text-ink-100">{share.toFixed(1)}%</span>
                    <span className="ml-1.5 text-ink-500">{d.total.toFixed(1)}회</span>
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded bg-court-700/40">
                  <div className={`h-full ${active.barColor}`} style={{ width: `${share}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── PC: stacked 100% bar ─── */}
      <div className="hidden md:block">
        <div className="space-y-2">
          {sortedDesktop.map((d) => {
            const total = Math.max(d.total, 1e-9);
            const twoPct = (d.twoA / total) * 100;
            const threePct = (d.threeA / total) * 100;
            const ftPct = (d.ftA / total) * 100;
            return (
              <div
                key={d.team.code}
                className="grid grid-cols-[110px_minmax(0,1fr)_220px] items-center gap-3"
              >
                <span className="truncate text-[16px] font-medium text-ink-100">
                  {d.team.name}
                </span>
                <div className="relative h-4 min-w-0 overflow-hidden rounded bg-court-700/40">
                  <div className="absolute inset-0 flex h-full w-full">
                    <div className="h-full bg-neon-500/80" style={{ width: `${twoPct}%` }} title={`2점: ${twoPct.toFixed(1)}%`} />
                    <div className="h-full bg-buzzer-500/80" style={{ width: `${threePct}%` }} title={`3점: ${threePct.toFixed(1)}%`} />
                    <div className="h-full bg-flame-400/80" style={{ width: `${ftPct}%` }} title={`자유투: ${ftPct.toFixed(1)}%`} />
                  </div>
                </div>
                <div className="stat-num whitespace-nowrap text-right text-[15px] text-ink-300">
                  <span className="text-neon-400">{twoPct.toFixed(0)}%</span>
                  <span className="mx-1 text-ink-500">·</span>
                  <span className="text-buzzer-400">{threePct.toFixed(0)}%</span>
                  <span className="mx-1 text-ink-500">·</span>
                  <span className="text-flame-400">{ftPct.toFixed(0)}%</span>
                  <span className="ml-2 font-medium text-ink-100">
                    {d.total.toFixed(1)}회
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
