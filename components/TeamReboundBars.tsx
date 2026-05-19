"use client";

import { useState } from "react";
import type { FilteredTeam } from "@/lib/data";

/**
 * 팀별 공격/수비 리바운드 분해.
 *  - PC(md+): 한 팀 한 행에 공+수 stacked bar
 *  - 모바일(<md): 탭 (공격 / 수비 / 총) — 선택 카테고리 10팀 막대 정렬
 */

type ReboundKey = "off" | "def" | "total";

export function TeamReboundBars({
  teams,
  title = "팀 리바운드 분해",
}: {
  teams: FilteredTeam[];
  title?: string;
}) {
  const [activeKey, setActiveKey] = useState<ReboundKey>("total");

  if (!teams || teams.length === 0) return null;

  const data = teams.map((t) => ({
    team: t,
    oReb: t.stats.oReb ?? 0,
    dReb: t.stats.dReb ?? 0,
    total: (t.stats.oReb ?? 0) + (t.stats.dReb ?? 0),
  }));

  const anyNonZero = data.some((d) => d.oReb > 0 || d.dReb > 0);
  if (!anyNonZero) return null;

  const maxTotal = Math.max(...data.map((d) => d.total));
  const oLeader = [...data].sort((a, b) => b.oReb - a.oReb)[0];
  const dLeader = [...data].sort((a, b) => b.dReb - a.dReb)[0];
  const totalLeader = [...data].sort((a, b) => b.total - a.total)[0];

  // 모바일 탭 메타
  const REB_META: Record<
    ReboundKey,
    { label: string; barColor: string; pick: (d: typeof data[number]) => number; max: number }
  > = {
    off:   { label: "공격 리바", barColor: "bg-flame-500/80", pick: (d) => d.oReb, max: Math.max(...data.map((d) => d.oReb)) },
    def:   { label: "수비 리바", barColor: "bg-neon-500/80",  pick: (d) => d.dReb, max: Math.max(...data.map((d) => d.dReb)) },
    total: { label: "총 리바",   barColor: "bg-ink-100/80",   pick: (d) => d.total, max: maxTotal },
  };
  const active = REB_META[activeKey];
  const sortedMobile = [...data].sort((a, b) => active.pick(b) - active.pick(a));
  const REB_KEYS: ReboundKey[] = ["off", "def", "total"];

  return (
    <div className="card p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
          <p className="mt-0.5 text-[14px] text-ink-500">
            왼쪽 주황 = 공격 리바운드 · 오른쪽 시안 = 수비 리바운드 · 경기당 평균
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-[14px] md:flex-nowrap">
          <div>
            <div className="text-ink-500">공격 리바 1위</div>
            <div className="stat-num mt-0.5 font-medium text-flame-400">
              {oLeader.team.shortName} · {oLeader.oReb.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="text-ink-500">수비 리바 1위</div>
            <div className="stat-num mt-0.5 font-medium text-neon-400">
              {dLeader.team.shortName} · {dLeader.dReb.toFixed(1)}
            </div>
          </div>
          <div>
            <div className="text-ink-500">총 리바 1위</div>
            <div className="stat-num mt-0.5 font-medium text-ink-100">
              {totalLeader.team.shortName} · {totalLeader.total.toFixed(1)}
            </div>
          </div>
        </div>
      </div>

      {/* ─── 모바일: 탭 + 단일 카테고리 ─── */}
      <div className="md:hidden">
        <div
          role="tablist"
          className="-mx-1 mb-3 flex gap-1 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
        >
          {REB_KEYS.map((k) => {
            const meta = REB_META[k];
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
            const v = active.pick(d);
            const pct = active.max > 0 ? (v / active.max) * 100 : 0;
            return (
              <div key={d.team.code} className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-baseline gap-2 text-[15px] font-medium text-ink-100">
                    <span className="stat-num w-5 shrink-0 text-[13px] text-ink-500">{i + 1}</span>
                    <span className="truncate">{d.team.name}</span>
                  </span>
                  <span className="stat-num shrink-0 whitespace-nowrap text-[14px] font-semibold text-ink-100">
                    {v.toFixed(1)}
                  </span>
                </div>
                <div className="relative h-3 w-full overflow-hidden rounded bg-court-700/40">
                  <div className={`h-full ${active.barColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── PC: stacked bar (공+수) ─── */}
      <div className="hidden md:block">
        <div className="space-y-2.5">
          {data.map((d) => {
            const oPct = maxTotal > 0 ? (d.oReb / maxTotal) * 100 : 0;
            const dPct = maxTotal > 0 ? (d.dReb / maxTotal) * 100 : 0;
            return (
              <div
                key={d.team.code}
                className="grid grid-cols-[110px_minmax(0,1fr)_140px] items-center gap-3"
              >
                <span className="truncate text-[16px] font-medium text-ink-100">
                  {d.team.name}
                </span>
                <div className="relative h-4 min-w-0 overflow-hidden rounded bg-court-700/40">
                  <div className="absolute left-0 top-0 flex h-full w-full">
                    <div className="h-full bg-flame-500/80" style={{ width: `${oPct}%` }} />
                    <div className="h-full bg-neon-500/80" style={{ width: `${dPct}%` }} />
                  </div>
                </div>
                <div className="stat-num whitespace-nowrap text-right text-[15px] text-ink-300">
                  <span className="text-flame-400">{d.oReb.toFixed(1)}</span>
                  <span className="mx-1 text-ink-500">+</span>
                  <span className="text-neon-400">{d.dReb.toFixed(1)}</span>
                  <span className="ml-2 font-medium text-ink-100">{d.total.toFixed(1)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
