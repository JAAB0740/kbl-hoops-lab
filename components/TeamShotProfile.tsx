import type { FilteredTeam } from "@/lib/data";

/**
 * 팀별 슛 프로필 — 시도 분포 (2점 / 3점 / 자유투) 100% normalized stacked bar.
 *  - 같은 팀이라도 4쿼터엔 3점 비중이 늘어나는지 등 흥미로운 패턴 발견 가능.
 *  - 정렬: 3점 시도 비율이 높은 순.
 */
export function TeamShotProfile({
  teams,
  title = "팀별 슛 프로필",
}: {
  teams: FilteredTeam[];
  title?: string;
}) {
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

  // 3점 비중 큰 순 정렬
  const sorted = [...data].sort(
    (a, b) =>
      (b.threeA / Math.max(b.total, 1e-9)) -
      (a.threeA / Math.max(a.total, 1e-9)),
  );

  const threeLeader = sorted[0];
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

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
          <p className="mt-0.5 text-[13px] text-ink-500">
            시도 비중 (100%) · 시안 = 2점 · 자홍 = 3점 · 노랑 = 자유투
          </p>
        </div>
        <div className="flex gap-3 text-[13px]">
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

      <div className="space-y-2">
        {sorted.map((d) => {
          const total = Math.max(d.total, 1e-9);
          const twoPct = (d.twoA / total) * 100;
          const threePct = (d.threeA / total) * 100;
          const ftPct = (d.ftA / total) * 100;
          return (
            <div
              key={d.team.code}
              className="grid grid-cols-[110px_minmax(0,1fr)_220px] items-center gap-3"
            >
              <span className="truncate text-[15px] font-medium text-ink-100">
                {d.team.name}
              </span>
              <div className="relative h-4 min-w-0 overflow-hidden rounded bg-court-700/40">
                <div className="absolute inset-0 flex h-full w-full">
                  <div
                    className="h-full bg-neon-500/80"
                    style={{ width: `${twoPct}%` }}
                    title={`2점: ${twoPct.toFixed(1)}%`}
                  />
                  <div
                    className="h-full bg-buzzer-500/80"
                    style={{ width: `${threePct}%` }}
                    title={`3점: ${threePct.toFixed(1)}%`}
                  />
                  <div
                    className="h-full bg-flame-400/80"
                    style={{ width: `${ftPct}%` }}
                    title={`자유투: ${ftPct.toFixed(1)}%`}
                  />
                </div>
              </div>
              <div className="stat-num whitespace-nowrap text-right text-[14px] text-ink-300">
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
  );
}
