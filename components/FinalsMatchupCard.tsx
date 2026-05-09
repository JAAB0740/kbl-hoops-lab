import type { PlayoffSeries } from "@/lib/types";
import { STANDINGS_FILTERS, TEAM_COLORS } from "@/lib/data";

/**
 * 챔피언결정전 매치업 카드 — 정규시즌 기반 advanced 비교
 */
export function FinalsMatchupCard({
  finalSeries,
  daysToNext,
}: {
  finalSeries: PlayoffSeries | null;
  daysToNext: number | null;
}) {
  if (!finalSeries) return null;
  const top = finalSeries.topShort;
  const bot = finalSeries.bottomShort;
  if (!top || !bot || top === "TBD" || bot === "TBD") return null;

  const seasonAll = STANDINGS_FILTERS.all ?? [];
  const seasonPo = STANDINGS_FILTERS.po ?? [];
  const t = seasonAll.find((x) => x.shortName === top);
  const b = seasonAll.find((x) => x.shortName === bot);
  if (!t || !b) return null;

  // PO 기반 데이터 (4강·6강 종합 PO 평균)
  const tPo = seasonPo.find((x) => x.shortName === top);
  const bPo = seasonPo.find((x) => x.shortName === bot);
  const hasPo = tPo && bPo;

  const topColor = TEAM_COLORS[top] ?? "#94a3b8";
  const botColor = TEAM_COLORS[bot] ?? "#94a3b8";

  // 23번 라인 narrowing 후에는 t/b 모두 NonNullable. 타입 명시 (typeof t 만으로는 undefined 포함됨).
  const ROWS: {
    label: string;
    pick: (x: NonNullable<typeof t>) => number;
    fmt: (v: number) => string;
    higherIsBetter: boolean;
  }[] = [
    { label: "PPG", pick: (x) => x.stats.points, fmt: (v) => v.toFixed(1), higherIsBetter: true },
    { label: "RPG", pick: (x) => x.stats.rebounds, fmt: (v) => v.toFixed(1), higherIsBetter: true },
    { label: "APG", pick: (x) => x.stats.assists, fmt: (v) => v.toFixed(1), higherIsBetter: true },
    { label: "FG%", pick: (x) => x.stats.fgPct, fmt: (v) => v.toFixed(1), higherIsBetter: true },
    { label: "3P%", pick: (x) => x.stats.threePct, fmt: (v) => v.toFixed(1), higherIsBetter: true },
    { label: "TOV", pick: (x) => x.stats.turnovers, fmt: (v) => v.toFixed(1), higherIsBetter: false },
  ];

  const ADV_ROWS: {
    label: string;
    pick: (x: NonNullable<typeof t>) => number | undefined;
    fmt: (v: number) => string;
    higherIsBetter: boolean;
  }[] = [
    { label: "ORtg", pick: (x) => x.advanced?.offRtg, fmt: (v) => v.toFixed(1), higherIsBetter: true },
    { label: "DRtg", pick: (x) => x.advanced?.defRtg, fmt: (v) => v.toFixed(1), higherIsBetter: false },
    { label: "Net",  pick: (x) => x.advanced?.netRtg, fmt: (v) => (v > 0 ? "+" : "") + v.toFixed(1), higherIsBetter: true },
    { label: "TS%",  pick: (x) => x.advanced?.tsPct, fmt: (v) => v.toFixed(1), higherIsBetter: true },
    { label: "Pace", pick: (x) => x.advanced?.pace, fmt: (v) => v.toFixed(1), higherIsBetter: true },
  ];

  const topRecord = `${t.wins}승 ${t.losses}패`;
  const botRecord = `${b.wins}승 ${b.losses}패`;

  return (
    <div className="card overflow-hidden">
      {/* 헤더 */}
      <div className="relative bg-gradient-to-r from-flame-500/10 via-flame-500/5 to-court-800/0 px-5 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <span className="chip border-flame-500/40 bg-flame-500/15 text-flame-400">
              <span className="h-1.5 w-1.5 rounded-full bg-flame-500" />
              FINALS
            </span>
            <h3 className="mt-2 text-base font-bold tracking-tight text-ink-50">
              챔피언결정전 — 7전 4선승
            </h3>
            <p className="mt-0.5 text-[14px] text-ink-500">
              정규시즌 기반 매치업 분석
            </p>
          </div>
          {daysToNext != null && daysToNext >= 0 && (
            <div className="text-right">
              <div className="text-[13px] uppercase tracking-[0.15em] text-ink-500">
                Tip-off
              </div>
              <div className="stat-num text-2xl font-bold text-flame-400">
                D-{daysToNext}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 두 팀 카드 */}
      <div className="grid grid-cols-2 divide-x divide-court-700/60">
        <TeamPanel
          short={top}
          name={finalSeries.topName}
          seed={finalSeries.topSeed}
          record={topRecord}
          color={topColor}
        />
        <TeamPanel
          short={bot}
          name={finalSeries.bottomName}
          seed={finalSeries.bottomSeed}
          record={botRecord}
          color={botColor}
        />
      </div>

      {/* 비교 표 */}
      <div className="border-t border-court-700/60">
        <div className="px-5 py-3 text-[13px] font-medium uppercase tracking-[0.12em] text-ink-500">
          1차 (정규시즌 평균)
        </div>
        <div className="divider-y px-5 pb-4">
          {ROWS.map((r) => {
            const tv = r.pick(t);
            const bv = r.pick(b);
            const tWins = r.higherIsBetter ? tv > bv : tv < bv;
            const bWins = r.higherIsBetter ? bv > tv : bv < tv;
            return (
              <CompareRow
                key={r.label}
                label={r.label}
                left={r.fmt(tv)}
                leftHigh={tWins}
                leftColor={topColor}
                right={r.fmt(bv)}
                rightHigh={bWins}
                rightColor={botColor}
              />
            );
          })}
        </div>

        {t.advanced && b.advanced && (
          <>
            <div className="px-5 pt-2 text-[13px] font-medium uppercase tracking-[0.12em] text-ink-500">
              2차 (Advanced)
            </div>
            <div className="divider-y px-5 pb-4">
              {ADV_ROWS.map((r) => {
                const tv = r.pick(t);
                const bv = r.pick(b);
                if (tv == null || bv == null) return null;
                const tWins = r.higherIsBetter ? tv > bv : tv < bv;
                const bWins = r.higherIsBetter ? bv > tv : bv < tv;
                return (
                  <CompareRow
                    key={r.label}
                    label={r.label}
                    left={r.fmt(tv)}
                    leftHigh={tWins}
                    leftColor={topColor}
                    right={r.fmt(bv)}
                    rightHigh={bWins}
                    rightColor={botColor}
                  />
                );
              })}
            </div>
          </>
        )}

        {/* 플레이오프 평균 — 6강·4강 합산 PO 데이터 */}
        {hasPo && (
          <>
            <div className="border-t border-court-700/60 px-5 py-3 text-[13px] font-medium uppercase tracking-[0.12em] text-flame-400">
              이번 PO 흐름 ({tPo!.games}G / {bPo!.games}G)
            </div>
            <div className="divider-y px-5 pb-4">
              {ROWS.map((r) => {
                const tv = r.pick(tPo!);
                const bv = r.pick(bPo!);
                const tWins = r.higherIsBetter ? tv > bv : tv < bv;
                const bWins = r.higherIsBetter ? bv > tv : bv < tv;
                return (
                  <CompareRow
                    key={`po-${r.label}`}
                    label={r.label}
                    left={r.fmt(tv)}
                    leftHigh={tWins}
                    leftColor={topColor}
                    right={r.fmt(bv)}
                    rightHigh={bWins}
                    rightColor={botColor}
                  />
                );
              })}
            </div>
            {tPo!.advanced && bPo!.advanced && (
              <>
                <div className="px-5 pt-2 text-[13px] font-medium uppercase tracking-[0.12em] text-ink-500">
                  2차 (PO Advanced)
                </div>
                <div className="divider-y px-5 pb-4">
                  {ADV_ROWS.map((r) => {
                    const tv = r.pick(tPo!);
                    const bv = r.pick(bPo!);
                    if (tv == null || bv == null) return null;
                    const tWins = r.higherIsBetter ? tv > bv : tv < bv;
                    const bWins = r.higherIsBetter ? bv > tv : bv < tv;
                    return (
                      <CompareRow
                        key={`po-adv-${r.label}`}
                        label={r.label}
                        left={r.fmt(tv)}
                        leftHigh={tWins}
                        leftColor={topColor}
                        right={r.fmt(bv)}
                        rightHigh={bWins}
                        rightColor={botColor}
                      />
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TeamPanel({
  short,
  name,
  seed,
  record,
  color,
}: {
  short: string;
  name: string;
  seed?: number;
  record: string;
  color: string;
}) {
  return (
    <div className="px-5 py-4 text-center">
      <div className="flex items-center justify-center gap-2">
        {seed != null && (
          <span
            className="stat-num inline-flex h-6 w-6 items-center justify-center rounded text-[14px] font-bold"
            style={{ backgroundColor: color, color: "#07080a" }}
          >
            {seed}
          </span>
        )}
        <span className="text-[16px] font-semibold text-ink-50">{name}</span>
      </div>
      <div className="stat-num mt-1 text-[15px] text-ink-300">{record}</div>
    </div>
  );
}

function CompareRow({
  label,
  left,
  leftHigh,
  leftColor,
  right,
  rightHigh,
  rightColor,
}: {
  label: string;
  left: string;
  leftHigh: boolean;
  leftColor: string;
  right: string;
  rightHigh: boolean;
  rightColor: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_60px_1fr] items-center gap-3 py-2">
      <div
        className={[
          "stat-num text-right text-[16px]",
          leftHigh ? "font-bold" : "text-ink-300",
        ].join(" ")}
        style={{ color: leftHigh ? leftColor : undefined }}
      >
        {left}
      </div>
      <div className="text-center text-[13px] uppercase tracking-[0.1em] text-ink-500">
        {label}
      </div>
      <div
        className={[
          "stat-num text-left text-[16px]",
          rightHigh ? "font-bold" : "text-ink-300",
        ].join(" ")}
        style={{ color: rightHigh ? rightColor : undefined }}
      >
        {right}
      </div>
    </div>
  );
}
