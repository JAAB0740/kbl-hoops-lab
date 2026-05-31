import {
  SHOT_CHART_GEOMETRY,
  ZONE_LABELS,
  type PlayerShotChart,
  type ShotZone,
} from "@/lib/shotCharts";

/**
 * 선수의 시즌 슛 차트 — 코트 SVG + 개별 슛 dot + 존별 비율.
 *
 * 데이터 소스: lib/shotCharts.ts → getPlayerShotChart(pcode)
 * (KBL 경기 차트 API 의 raw shot log 를 좌표 정규화 + 존 분류한 결과)
 *
 * 코트는 half-court orientation (왼쪽 골대 기준). 모든 슛이 normalize 되어
 * basket at (60, 195) 으로 통일됨.
 *
 * 시각적 강조:
 *  - 성공 = 팀 컬러(작은 채워진 원), 실패 = 작은 X 마크
 *  - 존 패널 = 막대 + 시도수, 색은 존별 톤
 */

const G = SHOT_CHART_GEOMETRY;

// 존별 색상 (히트 정도가 아니라 단순 카테고리 식별용)
const ZONE_COLORS: Record<ShotZone, string> = {
  at_rim:   "#f97316", // flame
  paint:    "#fb923c", // light flame
  midrange: "#94a3b8", // slate
  corner_3: "#22d3ee", // cyan
  wing_3:   "#38bdf8", // sky
  top_3:    "#818cf8", // indigo
};

// 디스플레이 순서 (림 → 외곽)
const ZONE_ORDER: ShotZone[] = [
  "at_rim",
  "paint",
  "midrange",
  "corner_3",
  "wing_3",
  "top_3",
];

export function ShotMap({
  chart,
  title = "슛 차트",
  subtitle,
}: {
  chart: PlayerShotChart;
  title?: string;
  subtitle?: string;
}) {
  if (chart.totalShots === 0) {
    return (
      <section className="card p-5">
        <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
        <p className="mt-2 text-[14px] text-ink-500">
          이 선수는 시즌 슛 로그 기록이 아직 없습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-[13px] text-ink-500">{subtitle}</p>
          )}
        </div>
        <div className="text-[13px] text-ink-500">
          <span className="stat-num text-ink-200">{chart.totalShots}</span>
          <span> 슛 · </span>
          <span className="stat-num">{chart.totalMade}</span>
          <span> 성공 · </span>
          <span className="stat-num text-ink-200">{chart.fgPct.toFixed(1)}%</span>
          <span> · {chart.gamesWithShots}경기</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_1fr]">
        {/* 코트 + 슛 점 */}
        <div>
          <CourtSVG chart={chart} />
        </div>

        {/* 존별 분류 */}
        <div className="space-y-2">
          <div className="text-[13px] uppercase tracking-wider text-ink-500">
            존별 슛 효율
          </div>
          {ZONE_ORDER.map((z) => {
            const zs = chart.byZone[z];
            const color = ZONE_COLORS[z];
            const widthPct = chart.totalShots > 0
              ? (zs.att / chart.totalShots) * 100
              : 0;
            return (
              <div key={z} className="text-[13px]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-medium text-ink-100">
                      {ZONE_LABELS[z]}
                    </span>
                  </span>
                  <span className="stat-num text-ink-300">
                    {zs.made}/{zs.att}
                    <span
                      className={[
                        "ml-2 font-semibold",
                        zs.att === 0
                          ? "text-ink-500"
                          : zs.pct >= 50
                            ? "text-hoop-400"
                            : zs.pct >= 35
                              ? "text-ink-100"
                              : "text-buzzer-400",
                      ].join(" ")}
                    >
                      {zs.att === 0 ? "—" : `${zs.pct.toFixed(1)}%`}
                    </span>
                  </span>
                </div>
                {/* 시도 분포 — 바 (가로 폭이 시도 비율) */}
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-court-800">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${widthPct}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            );
          })}
          <p className="mt-3 text-[11px] leading-snug text-ink-500">
            KBL 경기 차트 API 의 실제 슛 좌표로 직접 계산.
            존 분류는 FIBA 코트 기준 (페인트 4.9×5.8m, 3pt 6.75m).
          </p>
        </div>
      </div>
    </section>
  );
}

/** 코트 + dot 렌더링 — 별도 함수로 분리 (캐러셀 등에서 재사용 가능) */
function CourtSVG({ chart }: { chart: PlayerShotChart }) {
  const W = G.HALF_W;
  const H = G.HALF_H;
  const PAINT_X = G.PAINT_X;
  const PAINT_Y = G.PAINT_Y;

  // 3pt 코너 직선 — 데이터 검증 결과 KBL 실제 arc r=160, 코너 라인 y=50/360.
  // arc-line 교차점: (x-60)² + (50-205)² = 160² → x ≈ 100.
  const ARC_START_TOP = { x: 100, y: 50 };
  const ARC_START_BOT = { x: 100, y: 360 };
  const CORNER_TOP_BL = { x: 20, y: 50 };
  const CORNER_BOT_BL = { x: 20, y: 360 };

  return (
    <div className="overflow-hidden rounded-lg border border-court-700/60 bg-court-900/40">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-auto w-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 코트 영역 외부 슛 점을 컷 (위·아래 대칭 sideline 기준) */}
        <defs>
          <clipPath id="shotmap-court-clip">
            <rect
              x={G.COURT_L_X}
              y={G.TOP_SIDELINE_Y}
              width={W - G.COURT_L_X - 5}
              height={G.BOT_SIDELINE_Y - G.TOP_SIDELINE_Y}
            />
          </clipPath>
        </defs>

        {/* 코트 outline — basket 기준 위·아래 대칭 sideline (위 20, 아래 390) */}
        <rect
          x={G.COURT_L_X}
          y={G.TOP_SIDELINE_Y}
          width={W - G.COURT_L_X - 5}
          height={G.BOT_SIDELINE_Y - G.TOP_SIDELINE_Y}
          fill="none"
          stroke="#475569"
          strokeWidth="1.5"
        />

        {/* 페인트 박스 */}
        <rect
          x={PAINT_X[0]}
          y={PAINT_Y[0]}
          width={PAINT_X[1] - PAINT_X[0]}
          height={PAINT_Y[1] - PAINT_Y[0]}
          fill="none"
          stroke="#475569"
          strokeWidth="1.5"
        />

        {/* free throw circle — FIBA 1.8m 반경 × scale 24.14 ≈ 44 */}
        <circle
          cx={PAINT_X[1]}
          cy={G.BASKET_Y}
          r="44"
          fill="none"
          stroke="#475569"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />

        {/* 3pt 라인: 코너 직선 + arc + 반대편 코너 직선 */}
        <path
          d={[
            `M ${CORNER_TOP_BL.x} ${CORNER_TOP_BL.y}`,
            `L ${ARC_START_TOP.x} ${ARC_START_TOP.y}`,
            `A ${G.THREE_PT_R} ${G.THREE_PT_R} 0 0 1 ${ARC_START_BOT.x} ${ARC_START_BOT.y}`,
            `L ${CORNER_BOT_BL.x} ${CORNER_BOT_BL.y}`,
          ].join(" ")}
          fill="none"
          stroke="#64748b"
          strokeWidth="1.5"
        />

        {/* 림 (basket) — 작은 원 */}
        <circle
          cx={G.BASKET_X}
          cy={G.BASKET_Y}
          r="6"
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
        />
        {/* 백보드 — basket 베이스라인 측면의 짧은 line */}
        <line
          x1={G.BASKET_X - 14}
          y1={G.BASKET_Y - 18}
          x2={G.BASKET_X - 14}
          y2={G.BASKET_Y + 18}
          stroke="#f59e0b"
          strokeWidth="2"
        />

        {/* 슛 점 — 성공 = 채워진 원, 실패 = X. 코트 영역 외 슛은 clipPath 로 컷 */}
        <g clipPath="url(#shotmap-court-clip)">
          {chart.shots.map((s, i) => {
            // 슛이 viewBox 밖이면 clip (안전망)
            if (s.x < 0 || s.x > W || s.y < 0 || s.y > H) return null;
            if (s.made) {
              return (
                <circle
                  key={i}
                  cx={s.x}
                  cy={s.y}
                  r="3.5"
                  fill="#10b981"
                  fillOpacity="0.7"
                  stroke="#065f46"
                  strokeWidth="0.5"
                />
              );
            }
            // 미스 — 작은 X (두 개의 짧은 라인)
            return (
              <g
                key={i}
                stroke="#ef4444"
                strokeOpacity="0.55"
                strokeWidth="1.2"
              >
                <line x1={s.x - 3} y1={s.y - 3} x2={s.x + 3} y2={s.y + 3} />
                <line x1={s.x - 3} y1={s.y + 3} x2={s.x + 3} y2={s.y - 3} />
              </g>
            );
          })}
        </g>
      </svg>
      <div className="flex justify-end gap-3 px-2 py-1 text-[11px] text-ink-500">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-hoop-500" />
          성공
        </span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden className="text-buzzer-400">×</span>
          실패
        </span>
      </div>
    </div>
  );
}
