import {
  SHOT_CHART_GEOMETRY,
  ZONE_DETAILED_ORDER,
  type PlayerShotChart,
  type ShotZoneDetailed,
} from "@/lib/shotCharts";

/**
 * 방사형 14존 영역별 야투 — portrait, radial wedge.
 *
 *   - 림 (1) — r=60 큰 원 (베이스라인 너머 부분은 clipPath 로 잘림 → D 모양)
 *   - 페인트 (3 wedge) — r=60..120, ±22.5° / ±90° (radial 부채꼴, 원형 outer)
 *   - 미드 (5 wedge) — r=120..160, ±22.5° / ±60° / 베이스라인 외측
 *   - 코너 3 (2 rect)
 *   - 3pt (3 wedge) — arc 외측
 *
 *  clipPath: 코트 영역 (portrait x∈[5,390], y∈[5,340]) 안만 렌더. 베이스라인 (y=340)
 *  너머의 색깔/선/원 모두 잘림.
 */

const G = SHOT_CHART_GEOMETRY;
// Landscape — ShotMap / HexShotMap 과 동일 viewBox (360 × 395).
// basket at landscape (60, 205) — 화면 LEFT, 코트가 RIGHT 로 확장.
const VB_W = 360;
const VB_H = 395;

const BX = G.BASKET_X;        // 60
const BY = G.BASKET_Y;        // 205
const RIM_R = G.RIM_R;        // 58  (8 feet)
const PAINT_R = G.PAINT_R;    // 116 (16 feet)
const THREE_R = G.THREE_PT_R; // 160 (3pt arc, 6.75m)
const A_PW = G.PAINT_WING_ANGLE; // π/6 = 30°  (paint 정면 wedge ±각도)
const A_MW = G.MID_WING_ANGLE;   // π/8
const A_MC = G.MID_CORNER_ANGLE; // π/3 = 60°
const A_TW = G.THREE_WING_ANGLE; // π/8
/** Paint 좌/우 wedge 의 outer 각도 cap — 거의 ±π (전체 반평면). clipPath 가
 *  베이스라인 너머는 자동 컷 → visual = classifier (theta < -PAINT_WING / > +PAINT_WING). */
const A_PH = Math.PI - 0.001;
const COURT_R_X = 355;
// 사이드라인/베이스라인 — SHOT_CHART_GEOMETRY 에 중앙화 (ShotMap/HexShotMap 과 통일).
// basket-y=205 기준 위·아래 대칭이 되도록 위 sideline 을 y=20 으로 보정.
const COURT_L_X = G.COURT_L_X;
const TOP_SIDELINE_Y = G.TOP_SIDELINE_Y;
const BOT_SIDELINE_Y = G.BOT_SIDELINE_Y;

const f = (n: number) => n.toFixed(2);

// ─── Wedge helper — large-arc 자동 처리 ─────────────────
function wedge(rIn: number, rOut: number, a0: number, a1: number): string {
  const c0 = Math.cos(a0), s0 = Math.sin(a0);
  const c1 = Math.cos(a1), s1 = Math.sin(a1);
  const span = Math.abs(a1 - a0);
  const large = span > Math.PI ? 1 : 0;
  return [
    `M ${f(BX + rIn * c0)},${f(BY + rIn * s0)}`,
    `L ${f(BX + rOut * c0)},${f(BY + rOut * s0)}`,
    `A ${rOut},${rOut} 0 ${large},1 ${f(BX + rOut * c1)},${f(BY + rOut * s1)}`,
    `L ${f(BX + rIn * c1)},${f(BY + rIn * s1)}`,
    `A ${rIn},${rIn} 0 ${large},0 ${f(BX + rIn * c0)},${f(BY + rIn * s0)}`,
    "Z",
  ].join(" ");
}

// 핵심 점들
const ARC_C_TOP = { x: 99.7, y: 50 };
const ARC_C_BOT = { x: 99.7, y: 360 };
const ARC_TW_TOP = { x: BX + THREE_R * Math.cos(-A_TW), y: BY + THREE_R * Math.sin(-A_TW) };
const ARC_TW_BOT = { x: BX + THREE_R * Math.cos(+A_TW), y: BY + THREE_R * Math.sin(+A_TW) };
const CR_TW_TOP_Y = BY + (COURT_R_X - BX) * Math.tan(-A_TW);
const CR_TW_BOT_Y = BY + (COURT_R_X - BX) * Math.tan(+A_TW);

// Mid baseline polygon 의 inner arc (r=PAINT_R) 베이스라인 (x=20) 만나는 점
// 60 + 120*cos(θ) = 20 → cos(θ) = -1/3 → θ = ±1.911 → y = 205 + 120*sin = 205 ± 113.16
const PAINT_BL_TOP_Y = BY - Math.sqrt(PAINT_R * PAINT_R - (BX - COURT_L_X) * (BX - COURT_L_X));
const PAINT_BL_BOT_Y = BY + Math.sqrt(PAINT_R * PAINT_R - (BX - COURT_L_X) * (BX - COURT_L_X));
const MID_EB_IN_TOP = { x: BX + PAINT_R * Math.cos(-A_MC), y: BY + PAINT_R * Math.sin(-A_MC) };
const MID_EB_OUT_TOP = { x: BX + THREE_R * Math.cos(-A_MC), y: BY + THREE_R * Math.sin(-A_MC) };
const MID_EB_IN_BOT = { x: BX + PAINT_R * Math.cos(+A_MC), y: BY + PAINT_R * Math.sin(+A_MC) };
const MID_EB_OUT_BOT = { x: BX + THREE_R * Math.cos(+A_MC), y: BY + THREE_R * Math.sin(+A_MC) };

// ─── 14존 SVG path ──────────────────────────────────
const ZONE_PATHS: Record<ShotZoneDetailed, string> = {
  // 1. 림 — r=60 큰 원 (clipPath 가 베이스라인 너머 잘라 D 모양)
  rim: `M ${BX + RIM_R},${BY} A ${RIM_R},${RIM_R} 0 0,1 ${BX - RIM_R},${BY} A ${RIM_R},${RIM_R} 0 0,1 ${BX + RIM_R},${BY} Z`,

  // 2-4. 페인트 radial wedge (rIn=70, rOut=120)
  //   paint_left/right 의 각도 범위 = (±A_PW, ±π) — classifier 의 theta < -PAINT_WING /
  //   theta > +PAINT_WING 와 정확히 일치. 베이스라인 너머의 wedge 부분은 clipPath 가
  //   자동으로 컷 → 시각이 페인트 사각형 끝(베이스라인)까지 자연스럽게 연결.
  paint_left:   wedge(RIM_R, PAINT_R, -A_PH, -A_PW),
  paint_center: wedge(RIM_R, PAINT_R, -A_PW, +A_PW),
  paint_right:  wedge(RIM_R, PAINT_R, +A_PW, +A_PH),

  // 5. 좌 베이스라인 — paint outer ~ 3pt arc, 외측 cap 까지
  mid_baseline_top: [
    `M ${f(MID_EB_IN_TOP.x)},${f(MID_EB_IN_TOP.y)}`,
    `L ${f(MID_EB_OUT_TOP.x)},${f(MID_EB_OUT_TOP.y)}`,
    `A ${THREE_R},${THREE_R} 0 0,0 ${ARC_C_TOP.x},${ARC_C_TOP.y}`,
    `L ${COURT_L_X},${ARC_C_TOP.y}`,
    `L ${COURT_L_X},${f(PAINT_BL_TOP_Y)}`,
    `A ${PAINT_R},${PAINT_R} 0 0,1 ${f(MID_EB_IN_TOP.x)},${f(MID_EB_IN_TOP.y)}`,
    "Z",
  ].join(" "),

  // 6. 좌 엘보
  mid_elbow_top: wedge(PAINT_R, THREE_R, -A_MC, -A_MW),

  // 7. FT 정면
  mid_center: wedge(PAINT_R, THREE_R, -A_MW, +A_MW),

  // 8. 우 엘보
  mid_elbow_bot: wedge(PAINT_R, THREE_R, +A_MW, +A_MC),

  // 9. 우 베이스라인 (mirror)
  mid_baseline_bot: [
    `M ${f(MID_EB_IN_BOT.x)},${f(MID_EB_IN_BOT.y)}`,
    `L ${f(MID_EB_OUT_BOT.x)},${f(MID_EB_OUT_BOT.y)}`,
    `A ${THREE_R},${THREE_R} 0 0,1 ${ARC_C_BOT.x},${ARC_C_BOT.y}`,
    `L ${COURT_L_X},${ARC_C_BOT.y}`,
    `L ${COURT_L_X},${f(PAINT_BL_BOT_Y)}`,
    `A ${PAINT_R},${PAINT_R} 0 0,0 ${f(MID_EB_IN_BOT.x)},${f(MID_EB_IN_BOT.y)}`,
    "Z",
  ].join(" "),

  // 10. 좌 코너 3 (직사각형 — top sideline y=20 으로 조정해서 우 코너와 높이 균일)
  corner_3_top: `M 20,${TOP_SIDELINE_Y} L 100,${TOP_SIDELINE_Y} L 100,50 L 20,50 Z`,

  // 11. 좌 윙 3 (top sideline y=TOP_SIDELINE_Y 반영)
  wing_3_top: [
    `M ${f(ARC_TW_TOP.x)},${f(ARC_TW_TOP.y)}`,
    `L ${COURT_R_X},${f(CR_TW_TOP_Y)}`,
    `L ${COURT_R_X},${TOP_SIDELINE_Y}`,
    `L 100,${TOP_SIDELINE_Y}`,
    `L 100,50`,
    `L ${ARC_C_TOP.x},${ARC_C_TOP.y}`,
    `A ${THREE_R},${THREE_R} 0 0,1 ${f(ARC_TW_TOP.x)},${f(ARC_TW_TOP.y)}`,
    "Z",
  ].join(" "),

  // 12. 탑 3
  top_3_center: [
    `M ${f(ARC_TW_TOP.x)},${f(ARC_TW_TOP.y)}`,
    `L ${COURT_R_X},${f(CR_TW_TOP_Y)}`,
    `L ${COURT_R_X},${f(CR_TW_BOT_Y)}`,
    `L ${f(ARC_TW_BOT.x)},${f(ARC_TW_BOT.y)}`,
    `A ${THREE_R},${THREE_R} 0 0,0 ${f(ARC_TW_TOP.x)},${f(ARC_TW_TOP.y)}`,
    "Z",
  ].join(" "),

  // 13. 우 윙 3
  wing_3_bot: [
    `M ${f(ARC_TW_BOT.x)},${f(ARC_TW_BOT.y)}`,
    `L ${COURT_R_X},${f(CR_TW_BOT_Y)}`,
    `L ${COURT_R_X},${BOT_SIDELINE_Y}`,
    `L 100,${BOT_SIDELINE_Y}`,
    `L 100,360`,
    `L ${ARC_C_BOT.x},${ARC_C_BOT.y}`,
    `A ${THREE_R},${THREE_R} 0 0,0 ${f(ARC_TW_BOT.x)},${f(ARC_TW_BOT.y)}`,
    "Z",
  ].join(" "),

  // 14. 우 코너 3 (직사각형)
  corner_3_bot: `M 20,360 L 100,360 L 100,${BOT_SIDELINE_Y} L 20,${BOT_SIDELINE_Y} Z`,
};

const COURT_3PT_PATH = "M 20,50 L 99.7,50 A 160,160 0 0,1 99.7,360 L 20,360";

// ─── 라벨 위치 (portrait) ──────────────────────────
//   paint_left wedge 의 centroid: midAngle = -5π/16, midR = 90 (avg of 60, 120)
//   landscape (60+90*cos(-5π/16), 205+90*sin(-5π/16)) ≈ (110, 130)
//   portrait (130, 250)
type LabelSpec = {
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  showName: boolean;
  pctSize: number;
  sampleSize: number;
};

// LABEL_SPECS — landscape coordinates (basket at left 60,205, court extends right).
// 한글 zone name 모두 제거 — pct + made/att 만 표시 (2-line layout, showName=false).
const LABEL_SPECS: Record<ShotZoneDetailed, LabelSpec> = {
  rim:              { x: 80,  y: 205, w: 50, h: 30, rx: 6, showName: false, pctSize: 14, sampleSize: 9 },
  paint_left:       { x: 92,  y: 130, w: 46, h: 28, rx: 6, showName: false, pctSize: 13, sampleSize: 9 },
  paint_center:     { x: 145, y: 205, w: 50, h: 28, rx: 6, showName: false, pctSize: 13, sampleSize: 9 },
  paint_right:      { x: 92,  y: 280, w: 46, h: 28, rx: 6, showName: false, pctSize: 13, sampleSize: 9 },
  mid_baseline_top: { x: 75,  y: 75,  w: 46, h: 28, rx: 6, showName: false, pctSize: 12, sampleSize: 8 },
  mid_baseline_bot: { x: 75,  y: 335, w: 46, h: 28, rx: 6, showName: false, pctSize: 12, sampleSize: 8 },
  mid_elbow_top:    { x: 172, y: 108, w: 50, h: 30, rx: 6, showName: false, pctSize: 13, sampleSize: 9 },
  mid_center:       { x: 208, y: 205, w: 50, h: 30, rx: 6, showName: false, pctSize: 13, sampleSize: 9 },
  mid_elbow_bot:    { x: 172, y: 302, w: 50, h: 30, rx: 6, showName: false, pctSize: 13, sampleSize: 9 },
  corner_3_top:     { x: 60,  y: 35,  w: 34, h: 26, rx: 5, showName: false, pctSize: 11, sampleSize: 8 },
  corner_3_bot:     { x: 60,  y: 375, w: 34, h: 26, rx: 5, showName: false, pctSize: 11, sampleSize: 8 },
  wing_3_top:       { x: 260, y: 65,  w: 52, h: 30, rx: 6, showName: false, pctSize: 14, sampleSize: 9 },
  top_3_center:     { x: 298, y: 205, w: 52, h: 30, rx: 7, showName: false, pctSize: 14, sampleSize: 9 },
  wing_3_bot:       { x: 260, y: 345, w: 52, h: 30, rx: 6, showName: false, pctSize: 14, sampleSize: 9 },
};

// ─── 색상 (리그 평균 대비 relative scale) ───────────────────
// 각 zone 의 player FG% 를 리그 평균과 비교 (diff = pct - league_avg).
// 3pt(평균~35%)와 페인트(평균~55%)를 동일 absolute 스케일에서 평가하면
// 3pt 35% 가 너무 빨갛게 보이는 문제를 해결 — zone 평균 기준으로 ±pp 비교.
const MIN_SAMPLE = 5;
const INSUFFICIENT_COLOR = "#27272a";

function fgPctColor(pct: number, att: number, leagueAvg: number): string {
  if (att < MIN_SAMPLE) return INSUFFICIENT_COLOR;
  const diff = pct - leagueAvg;
  if (diff < -12) return "#991b1b"; // way below — red-800
  if (diff < -6)  return "#ef4444"; // below — red-500
  if (diff < -2)  return "#fb923c"; // slightly below — orange-400
  if (diff < +2)  return "#facc15"; // 평균 — yellow-400
  if (diff < +6)  return "#84cc16"; // slightly above — lime-500
  if (diff < +12) return "#22c55e"; // above — green-500
  return "#15803d";                  // way above — green-700
}

const LEGEND_BUCKETS: { c: string; l: string }[] = [
  { c: "#991b1b", l: "−12" },
  { c: "#ef4444", l: "−6" },
  { c: "#fb923c", l: "−2" },
  { c: "#facc15", l: "평균" },
  { c: "#84cc16", l: "+2" },
  { c: "#22c55e", l: "+6" },
  { c: "#15803d", l: "+12" },
];

export function AreaShotChart({
  chart,
  title = "영역별 야투 — 방사형 14존",
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
          <span className="stat-num text-ink-100">{chart.totalShots}</span>
          <span> 슛 · </span>
          <span className="stat-num">{chart.totalMade}</span>
          <span> 성공 · </span>
          <span className="stat-num text-ink-100">{chart.fgPct.toFixed(1)}%</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-court-700/60 bg-court-950">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-auto w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* ===== ClipPath — 베이스라인 너머 영역 잘라냄 ===== */}
          <defs>
            <clipPath id="area-court-clip">
              {/* Landscape court bounds: x∈[20,355], y∈[TOP_SIDELINE_Y, BOT_SIDELINE_Y] */}
              <rect x="20" y={TOP_SIDELINE_Y} width="335" height={BOT_SIDELINE_Y - TOP_SIDELINE_Y} />
            </clipPath>
          </defs>

          {/* ===== 클립된 영역: zone fills + 코트 라인 + 림 ===== */}
          <g clipPath="url(#area-court-clip)">
            <g>
              {/* Zone fills — 리그 평균 대비 relative color, vibrant 톤 */}
              {ZONE_DETAILED_ORDER.map((z) => {
                const zs = chart.byZoneDetailed[z];
                const isInsufficient = zs.att < MIN_SAMPLE;
                const leagueAvg = chart.leagueZoneDetailedAvg[z] ?? 0;
                return (
                  <path
                    key={z}
                    d={ZONE_PATHS[z]}
                    fill={fgPctColor(zs.pct, zs.att, leagueAvg)}
                    fillOpacity={isInsufficient ? 0.35 : 0.6}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth="1"
                  />
                );
              })}

              {/* 코트 라인 */}
              <g
                fill="none"
                stroke="rgba(255,255,255,0.55)"
                strokeLinejoin="round"
                strokeLinecap="round"
              >
                <rect x="20" y={TOP_SIDELINE_Y} width="335" height={BOT_SIDELINE_Y - TOP_SIDELINE_Y} strokeWidth="1.2" />
                <rect
                  x={G.PAINT_X[0]}
                  y={G.PAINT_Y[0]}
                  width={G.PAINT_X[1] - G.PAINT_X[0]}
                  height={G.PAINT_Y[1] - G.PAINT_Y[0]}
                  strokeWidth="1.2"
                />
                <circle cx={G.PAINT_X[1]} cy={BY} r="44" strokeWidth="1.2" strokeDasharray="3 3" />
                <path d={COURT_3PT_PATH} strokeWidth="1.5" />
              </g>

              {/* 백보드 */}
              <line
                x1={BX - 14}
                y1={BY - 22}
                x2={BX - 14}
                y2={BY + 22}
                stroke="#f59e0b"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </g>
          </g>

          {/* ===== 텍스트 (zone name 없이 pct + made/att 2-line 만) ===== */}
          <g fontFamily="ui-sans-serif, -apple-system, system-ui, sans-serif">
            {ZONE_DETAILED_ORDER.map((z) => {
              const zs = chart.byZoneDetailed[z];
              const spec = LABEL_SPECS[z];
              const isInsufficient = zs.att < MIN_SAMPLE;
              // 2-line layout — pct 위, made/att 아래.
              const pctY = spec.y - spec.h / 2 + 9;
              const sampleY = spec.y + spec.h / 2 - 6;

              return (
                <g key={z}>
                  <rect
                    x={spec.x - spec.w / 2}
                    y={spec.y - spec.h / 2}
                    width={spec.w}
                    height={spec.h}
                    rx={spec.rx}
                    ry={spec.rx}
                    fill="rgba(0,0,0,0.72)"
                  />
                  {isInsufficient ? (
                    <text
                      x={spec.x}
                      y={spec.y + 1}
                      fontSize={spec.h >= 28 ? 12 : 10}
                      fontWeight="600"
                      fill="#71717a"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {zs.att === 0 ? "—" : `${zs.made}/${zs.att}`}
                    </text>
                  ) : (
                    <>
                      <text
                        x={spec.x}
                        y={pctY}
                        fontSize={spec.pctSize}
                        fontWeight="700"
                        fill="#ffffff"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {zs.pct.toFixed(1)}%
                      </text>
                      <text
                        x={spec.x}
                        y={sampleY}
                        fontSize={spec.sampleSize}
                        fontWeight="500"
                        fill="#cccccc"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {zs.made}/{zs.att}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px] text-ink-500">
          <span>시도 {MIN_SAMPLE}회 미만은 회색 · 색은 zone 별 리그 평균 대비 ±%p</span>
          <div className="flex items-center gap-1">
            <span className="text-ink-300">vs 평균</span>
            {LEGEND_BUCKETS.map((b) => (
              <span key={b.l} className="flex items-center gap-0.5">
                <span
                  className="inline-block h-2 w-3 rounded-[1px]"
                  style={{ backgroundColor: b.c }}
                  aria-hidden
                />
                <span>{b.l}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
