import type { FilteredTeam } from "@/lib/data";

/**
 * Dean Oliver의 4팩터 (Four Factors of Basketball Success)
 *  1) eFG% — 슈팅 효율 (3점에 가중치)
 *  2) TOV% — 턴오버 비율 (낮을수록 좋음)
 *  3) OREB% — 공격 리바운드 비율
 *  4) FTA Rate — 자유투 의존도 (FTA/FGA)
 *
 * 각 팀별로 4개 factor 를 막대로 시각화 — 팀 평균선 대비 +/- 표시.
 * advanced 데이터가 없는 팀은 표시 안 함.
 */
export function TeamFourFactors({
  teams,
  title = "4팩터 분석",
}: {
  teams: FilteredTeam[];
  title?: string;
}) {
  const withAdv = teams.filter((t) => t.advanced);
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

  // 정렬: efg 높은 순
  const sorted = [...data].sort((a, b) => b.efg - a.efg);

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

      {/* 헤더 */}
      <div className="mb-2 grid grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 px-1 text-[13px] uppercase tracking-wider text-ink-500">
        <span>팀</span>
        <FactorHeader
          name="eFG%"
          desc="슈팅 효율"
          avg={avgEfg}
          better="높을수록 ↑"
        />
        <FactorHeader
          name="TOV%"
          desc="턴오버 비율"
          avg={avgTov}
          better="낮을수록 ↓"
        />
        <FactorHeader
          name="OREB%"
          desc="공격 리바"
          avg={avgOreb}
          better="높을수록 ↑"
        />
        <FactorHeader
          name="FTA Rate"
          desc="자유투 의존도"
          avg={avgFta}
          better="높을수록 ↑"
        />
      </div>

      <div className="space-y-2">
        {sorted.map((d) => (
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
