import type { FilteredTeam } from "@/lib/data";

/**
 * 팀별 공격/수비 리바운드 분해 가로 막대 차트.
 * teams 배열은 렌더링할 10팀 (필터된 상태여도 됨).
 */
export function TeamReboundBars({ teams, title = "팀 리바운드 분해" }: { teams: FilteredTeam[]; title?: string }) {
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

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
          <p className="mt-0.5 text-[11px] text-ink-500">
            왼쪽 주황 = 공격 리바운드 · 오른쪽 시안 = 수비 리바운드 · 경기당 평균
          </p>
        </div>
        <div className="flex gap-3 text-[11px]">
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

      <div className="space-y-2.5">
        {data.map((d) => {
          const oPct = maxTotal > 0 ? (d.oReb / maxTotal) * 100 : 0;
          const dPct = maxTotal > 0 ? (d.dReb / maxTotal) * 100 : 0;
          return (
            <div
              key={d.team.code}
              className="grid grid-cols-[110px_minmax(0,1fr)_140px] items-center gap-3"
            >
              <span className="truncate text-[13px] font-medium text-ink-100">
                {d.team.name}
              </span>
              <div className="relative h-4 min-w-0 overflow-hidden rounded bg-court-700/40">
                <div className="absolute left-0 top-0 flex h-full w-full">
                  <div className="h-full bg-flame-500/80" style={{ width: `${oPct}%` }} />
                  <div className="h-full bg-neon-500/80" style={{ width: `${dPct}%` }} />
                </div>
              </div>
              <div className="stat-num whitespace-nowrap text-right text-[12px] text-ink-300">
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
  );
}
