import type { ShootingRange } from "@/lib/types";
import { pctToShotColor } from "./ShotChartCourt";

const RANGE_LABELS: Record<number, string> = {
  1: "림 부근",
  2: "페인트",
  3: "미드레인지",
  4: "코너 3점",
  5: "윙 3점",
  6: "탑 3점",
};

/**
 * 영역별 야투 성공률 — 6개 Range 막대 차트
 *
 * KBL 공식 6분할:
 *  1) 림 부근 (페인트 안)
 *  2) 페인트 외곽
 *  3) 미드레인지
 *  4) 코너 3점
 *  5) 윙 3점
 *  6) 탑 3점
 *
 * 색상은 ShotChartCourt 와 동일한 heat-map 그라디언트
 * (성공률 기준 빨강 cold → 노랑 → 초록 hot)
 */
export function ShootingRangeChart({
  regular,
  playoff,
}: {
  regular?: ShootingRange[];
  playoff?: ShootingRange[];
}) {
  if (!regular || regular.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-semibold tracking-tight text-ink-50">
          영역별 야투
        </h3>
        <p className="mt-3 text-[12px] text-ink-500">
          데이터 없음 — npm run fetch:kbl-shooting 실행 필요
        </p>
      </div>
    );
  }

  const totalAtt = regular.reduce((n, r) => n + r.att, 0);

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink-50">
            영역별 야투
          </h3>
          <p className="mt-1 text-[11px] text-ink-500">
            KBL 공식 6분할 · 정규시즌 평균 (코트 맵과 동일 색상)
          </p>
        </div>
        <div className="text-right text-[11px] text-ink-500">
          <span className="stat-num text-ink-300">{totalAtt.toFixed(1)}</span>회 시도
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {regular.map((r) => {
          const sharePct = totalAtt > 0 ? (r.att / totalAtt) * 100 : 0;
          const poRow = playoff?.find((p) => p.range === r.range);
          const barColor = pctToShotColor(r.pct, r.att > 0);
          return (
            <div key={r.range} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-medium text-ink-100 inline-flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: barColor }}
                  />
                  {RANGE_LABELS[r.range] ?? `Range ${r.range}`}
                </span>
                <span className="stat-num text-[12px]">
                  <span className="text-ink-50 font-semibold">
                    {r.pct.toFixed(1)}%
                  </span>
                  <span className="ml-2 text-ink-500">
                    {r.made.toFixed(1)} / {r.att.toFixed(1)}
                  </span>
                </span>
              </div>
              <div className="relative h-3 overflow-hidden rounded bg-court-700/40">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, r.pct))}%`,
                    backgroundColor: barColor,
                  }}
                />
                {/* PO 비교 (점선 마커) */}
                {poRow && poRow.att > 0 && (
                  <div
                    className="absolute top-0 h-full w-0.5 bg-ink-50"
                    style={{
                      left: `${Math.max(0, Math.min(100, poRow.pct))}%`,
                    }}
                    title={`PO: ${poRow.pct.toFixed(1)}% (${poRow.made.toFixed(1)}/${poRow.att.toFixed(1)})`}
                  />
                )}
              </div>
              <div className="flex items-baseline justify-between text-[10px] text-ink-500">
                <span>시도 비율 {sharePct.toFixed(1)}%</span>
                {poRow && poRow.att > 0 && (
                  <span>PO: {poRow.pct.toFixed(1)}% · {poRow.att.toFixed(1)} 시도</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {playoff && playoff.length > 0 && (
        <p className="mt-4 text-[10px] text-ink-500">
          흰 세로선 = PO 평균 위치
        </p>
      )}
    </div>
  );
}
