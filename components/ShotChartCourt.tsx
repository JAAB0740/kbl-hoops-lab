import type { ShootingRange } from "@/lib/types";

/**
 * 농구 반코트 SVG + 6영역 heat map (NBA.com/stats 스타일).
 *
 * 영역 분할:
 *  Range 1 (림 부근): 림 반경 1.5m 반원 + 림 아래 베이스라인까지 직사각형
 *  Range 2 (페인트):  림 반경 1.5m~4m 호 + 베이스라인까지 직사각형 (R1 제외)
 *  Range 3 (미드):    3점 호 안쪽 - Range 2
 *  Range 4 (코너 3점): 좌·우 코너 사각형
 *  Range 5 (윙 3점):   3점 호 외부 좌·우 윙 (코트 위쪽까지 길게)
 *  Range 6 (탑 3점):   3점 호 외부 정면 (좁아진 모양)
 *
 * 윙·탑 분할선은 림 중심에서 60° (수평 기준) 방향으로 코트 외곽까지 연장.
 */

const VB = { w: 1500, h: 1400 };
const RIM = { x: 750, y: 1242 };
const PAINT = { x1: 505, x2: 995, y1: 820, y2: 1400 };
const FT_CIRCLE_R = 180;

// 호 반경
const RANGE1_R = 150;  // 림 부근 1.5m
const RANGE2_R = 400;  // 페인트 4m
const THREE_R = 717;   // 3점 라인

const CORNER_LEFT_X = 75;
const CORNER_RIGHT_X = 1425;
const CORNER_LINE_END_Y = 1000;

// 좌·우 윙 분할점 — 60° (수평 기준), 즉 더 위쪽으로 올림
// (750 ± 717*cos60°, 1242 - 717*sin60°) ≈ (392 / 1108, 621)
const WING_LEFT = { x: 392, y: 621 };
const WING_RIGHT = { x: 1108, y: 621 };

// 윙·탑 분할선이 코트 상단(y=0)과 만나는 점 — 60°에서는 천장에 부딪힘
// slope = (621-1242)/(392-750) = 1.734, at y=0 → x ≈ 34
const DIVIDE_LEFT_OUTER = { x: 34, y: 0 };
const DIVIDE_RIGHT_OUTER = { x: 1466, y: 0 };

/** 성공률 → NBA 스타일 색상 (빨강 cold → 노랑 → 초록 hot) */
export function pctToShotColor(pct: number, hasShots: boolean): string {
  if (!hasShots) return "#1b1e24";
  if (pct < 25) return "#7f1d1d";
  if (pct < 33) return "#dc2626";
  if (pct < 40) return "#f97316";
  if (pct < 47) return "#facc15";
  if (pct < 54) return "#84cc16";
  if (pct < 62) return "#22c55e";
  return "#15803d";
}

export function ShotChartCourt({
  ranges,
  title = "영역별 야투 — 코트 맵",
  subtitle,
}: {
  ranges?: ShootingRange[];
  title?: string;
  subtitle?: string;
}) {
  if (!ranges || ranges.length === 0) return null;

  const r = (n: number) => ranges.find((x) => x.range === n);
  const r1 = r(1), r2 = r(2), r3 = r(3), r4 = r(4), r5 = r(5), r6 = r(6);

  const c1 = r1 ? pctToShotColor(r1.pct, r1.att > 0) : "#1b1e24";
  const c2 = r2 ? pctToShotColor(r2.pct, r2.att > 0) : "#1b1e24";
  const c3 = r3 ? pctToShotColor(r3.pct, r3.att > 0) : "#1b1e24";
  const c4 = r4 ? pctToShotColor(r4.pct, r4.att > 0) : "#1b1e24";
  const c5 = r5 ? pctToShotColor(r5.pct, r5.att > 0) : "#1b1e24";
  const c6 = r6 ? pctToShotColor(r6.pct, r6.att > 0) : "#1b1e24";

  const fmt = (pct: number, att: number) =>
    att > 0 ? `${pct.toFixed(1)}%` : "—";

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink-50">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 text-[11px] text-ink-500">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex justify-center">
        <svg
          viewBox={`0 0 ${VB.w} ${VB.h}`}
          className="h-auto w-full max-w-md"
          xmlns="http://www.w3.org/2000/svg"
          style={{ background: "#0d0f13" }}
        >
          {/* ───────── 영역 색칠 ───────── */}

          {/* Range 6 — 탑 3점 (윙 분할선 사이의 좁은 영역) */}
          <path
            d={`
              M ${WING_LEFT.x} ${WING_LEFT.y}
              L ${DIVIDE_LEFT_OUTER.x} ${DIVIDE_LEFT_OUTER.y}
              L ${DIVIDE_RIGHT_OUTER.x} ${DIVIDE_RIGHT_OUTER.y}
              L ${WING_RIGHT.x} ${WING_RIGHT.y}
              A ${THREE_R} ${THREE_R} 0 0 0 ${WING_LEFT.x} ${WING_LEFT.y}
              Z
            `}
            fill={c6}
          />

          {/* Range 5 좌측 윙 (코트 좌상단 모서리까지) */}
          <path
            d={`
              M 0 0
              L ${DIVIDE_LEFT_OUTER.x} ${DIVIDE_LEFT_OUTER.y}
              L ${WING_LEFT.x} ${WING_LEFT.y}
              A ${THREE_R} ${THREE_R} 0 0 0 ${CORNER_LEFT_X} ${CORNER_LINE_END_Y}
              L 0 ${CORNER_LINE_END_Y}
              Z
            `}
            fill={c5}
          />
          {/* Range 5 우측 윙 */}
          <path
            d={`
              M ${VB.w} 0
              L ${DIVIDE_RIGHT_OUTER.x} ${DIVIDE_RIGHT_OUTER.y}
              L ${WING_RIGHT.x} ${WING_RIGHT.y}
              A ${THREE_R} ${THREE_R} 0 0 1 ${CORNER_RIGHT_X} ${CORNER_LINE_END_Y}
              L ${VB.w} ${CORNER_LINE_END_Y}
              Z
            `}
            fill={c5}
          />

          {/* Range 4 — 코너 3점 좌·우 (사각형) */}
          <rect
            x="0"
            y={CORNER_LINE_END_Y}
            width={CORNER_LEFT_X}
            height={VB.h - CORNER_LINE_END_Y}
            fill={c4}
          />
          <rect
            x={CORNER_RIGHT_X}
            y={CORNER_LINE_END_Y}
            width={VB.w - CORNER_RIGHT_X}
            height={VB.h - CORNER_LINE_END_Y}
            fill={c4}
          />

          {/* Range 3 — 미드레인지 (3점 안쪽 - Range 2 stadium) */}
          <path
            d={`
              M ${CORNER_LEFT_X} ${CORNER_LINE_END_Y}
              A ${THREE_R} ${THREE_R} 0 0 1 ${CORNER_RIGHT_X} ${CORNER_LINE_END_Y}
              L ${CORNER_RIGHT_X} ${VB.h}
              L ${CORNER_LEFT_X} ${VB.h}
              Z
              M ${RIM.x - RANGE2_R} ${RIM.y}
              A ${RANGE2_R} ${RANGE2_R} 0 0 1 ${RIM.x + RANGE2_R} ${RIM.y}
              L ${RIM.x + RANGE2_R} ${VB.h}
              L ${RIM.x - RANGE2_R} ${VB.h}
              Z
            `}
            fill={c3}
            fillRule="evenodd"
          />

          {/* Range 2 — 페인트 (스타디움 모양: 호 + 베이스라인까지 직사각형, R1 제외) */}
          <path
            d={`
              M ${RIM.x - RANGE2_R} ${RIM.y}
              A ${RANGE2_R} ${RANGE2_R} 0 0 1 ${RIM.x + RANGE2_R} ${RIM.y}
              L ${RIM.x + RANGE2_R} ${VB.h}
              L ${RIM.x - RANGE2_R} ${VB.h}
              Z
              M ${RIM.x - RANGE1_R} ${RIM.y}
              A ${RANGE1_R} ${RANGE1_R} 0 0 1 ${RIM.x + RANGE1_R} ${RIM.y}
              L ${RIM.x + RANGE1_R} ${VB.h}
              L ${RIM.x - RANGE1_R} ${VB.h}
              Z
            `}
            fill={c2}
            fillRule="evenodd"
          />

          {/* Range 1 — 림 부근 (반원 + 베이스라인까지 직사각형) */}
          <path
            d={`
              M ${RIM.x - RANGE1_R} ${RIM.y}
              A ${RANGE1_R} ${RANGE1_R} 0 0 1 ${RIM.x + RANGE1_R} ${RIM.y}
              L ${RIM.x + RANGE1_R} ${VB.h}
              L ${RIM.x - RANGE1_R} ${VB.h}
              Z
            `}
            fill={c1}
          />

          {/* ───────── 코트 라인 (흰색 stroke, 두껍게) ───────── */}
          <g stroke="#ffffff" strokeWidth="8" fill="none" strokeLinejoin="round">
            {/* 코트 외곽 */}
            <rect x="0" y="0" width={VB.w} height={VB.h} />
            {/* 페인트 박스 */}
            <rect
              x={PAINT.x1}
              y={PAINT.y1}
              width={PAINT.x2 - PAINT.x1}
              height={PAINT.y2 - PAINT.y1}
            />
            {/* 자유투 서클 위 반원 (실선) */}
            <path
              d={`M ${PAINT.x1} ${PAINT.y1} A ${FT_CIRCLE_R} ${FT_CIRCLE_R} 0 0 1 ${PAINT.x2} ${PAINT.y1}`}
            />
            {/* 자유투 서클 아래 반원 (점선) */}
            <path
              d={`M ${PAINT.x1} ${PAINT.y1} A ${FT_CIRCLE_R} ${FT_CIRCLE_R} 0 0 0 ${PAINT.x2} ${PAINT.y1}`}
              strokeDasharray="22 22"
            />
            {/* 3점 라인 (코너 직선 + 호) */}
            <path
              d={`
                M ${CORNER_LEFT_X} ${VB.h}
                L ${CORNER_LEFT_X} ${CORNER_LINE_END_Y}
                A ${THREE_R} ${THREE_R} 0 0 1 ${CORNER_RIGHT_X} ${CORNER_LINE_END_Y}
                L ${CORNER_RIGHT_X} ${VB.h}
              `}
            />
            {/* 영역 분할 호 (가독성용) */}
            <path
              d={`M ${RIM.x - RANGE1_R} ${RIM.y} A ${RANGE1_R} ${RANGE1_R} 0 0 1 ${RIM.x + RANGE1_R} ${RIM.y}`}
              opacity="0.7"
              strokeWidth="5"
            />
            <path
              d={`M ${RIM.x - RANGE2_R} ${RIM.y} A ${RANGE2_R} ${RANGE2_R} 0 0 1 ${RIM.x + RANGE2_R} ${RIM.y}`}
              opacity="0.7"
              strokeWidth="5"
            />
            {/* 영역 분할: Range 1·2 베이스라인 직선 (반경 끝에서 베이스라인까지) */}
            <line
              x1={RIM.x - RANGE1_R}
              y1={RIM.y}
              x2={RIM.x - RANGE1_R}
              y2={VB.h}
              opacity="0.7"
              strokeWidth="5"
            />
            <line
              x1={RIM.x + RANGE1_R}
              y1={RIM.y}
              x2={RIM.x + RANGE1_R}
              y2={VB.h}
              opacity="0.7"
              strokeWidth="5"
            />
            <line
              x1={RIM.x - RANGE2_R}
              y1={RIM.y}
              x2={RIM.x - RANGE2_R}
              y2={VB.h}
              opacity="0.7"
              strokeWidth="5"
            />
            <line
              x1={RIM.x + RANGE2_R}
              y1={RIM.y}
              x2={RIM.x + RANGE2_R}
              y2={VB.h}
              opacity="0.7"
              strokeWidth="5"
            />
            {/* 윙·탑 분할선 (림 중심 → 호 → 외곽까지 점선 연장) */}
            <line
              x1={RIM.x}
              y1={RIM.y}
              x2={DIVIDE_LEFT_OUTER.x}
              y2={DIVIDE_LEFT_OUTER.y}
              opacity="0.55"
              strokeWidth="4"
              strokeDasharray="18 14"
            />
            <line
              x1={RIM.x}
              y1={RIM.y}
              x2={DIVIDE_RIGHT_OUTER.x}
              y2={DIVIDE_RIGHT_OUTER.y}
              opacity="0.55"
              strokeWidth="4"
              strokeDasharray="18 14"
            />
            {/* 백보드 */}
            <line
              x1={RIM.x - 100}
              y1={RIM.y + 35}
              x2={RIM.x + 100}
              y2={RIM.y + 35}
              strokeWidth="10"
            />
            {/* 림 (주황) */}
            <circle
              cx={RIM.x}
              cy={RIM.y}
              r="26"
              stroke="#f59e0b"
              strokeWidth="8"
            />
          </g>

          {/* ───────── 영역별 % 텍스트 (큰 글씨) ───────── */}
          <g
            fontFamily="-apple-system, sans-serif"
            fontWeight="800"
            textAnchor="middle"
            fill="#ffffff"
            stroke="#0d0f13"
            strokeWidth="5"
            paintOrder="stroke"
          >
            {/* Range 1 — 림 부근 (림 아래 직사각형 안) */}
            {r1 && (
              <text x={RIM.x} y={RIM.y + 105} fontSize="68">
                {fmt(r1.pct, r1.att)}
              </text>
            )}
            {/* Range 2 — 페인트 (림 위 호 영역 가운데) */}
            {r2 && (
              <text x={RIM.x} y={RIM.y - 210} fontSize="72">
                {fmt(r2.pct, r2.att)}
              </text>
            )}
            {/* Range 3 — 미드레인지 */}
            {r3 && (
              <text x={RIM.x} y="730" fontSize="72">
                {fmt(r3.pct, r3.att)}
              </text>
            )}
            {/* Range 4 — 코너 3점 (좌·우, 사각형 가운데) */}
            {r4 && (
              <>
                <text x="40" y="1250" fontSize="50">
                  {fmt(r4.pct, r4.att)}
                </text>
                <text x="1460" y="1250" fontSize="50">
                  {fmt(r4.pct, r4.att)}
                </text>
              </>
            )}
            {/* Range 5 — 윙 3점 (좌·우, 윙 영역 가운데) */}
            {r5 && (
              <>
                <text x="180" y="560" fontSize="68">
                  {fmt(r5.pct, r5.att)}
                </text>
                <text x="1320" y="560" fontSize="68">
                  {fmt(r5.pct, r5.att)}
                </text>
              </>
            )}
            {/* Range 6 — 탑 3점 (위쪽 가운데) */}
            {r6 && (
              <text x={RIM.x} y="320" fontSize="76">
                {fmt(r6.pct, r6.att)}
              </text>
            )}
          </g>

          {/* ───────── 영역 라벨 ───────── */}
          <g
            fontFamily="-apple-system, sans-serif"
            fontWeight="600"
            textAnchor="middle"
            fill="#e5e7eb"
            stroke="#0d0f13"
            strokeWidth="4"
            paintOrder="stroke"
          >
            <text x={RIM.x} y={RIM.y - 115} fontSize="40">림 부근</text>
            <text x={RIM.x} y={RIM.y - 295} fontSize="44">페인트</text>
            <text x={RIM.x} y="640" fontSize="46">미드레인지</text>
            <text x="40" y="1170" fontSize="36">코너</text>
            <text x="1460" y="1170" fontSize="36">코너</text>
            <text x="180" y="470" fontSize="44">윙 3점</text>
            <text x="1320" y="470" fontSize="44">윙 3점</text>
            <text x={RIM.x} y="220" fontSize="46">탑 3점</text>
          </g>
        </svg>
      </div>

      {/* 범례 */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-ink-500">
        <span className="font-medium text-ink-300">성공률:</span>
        {[
          { c: "#7f1d1d", l: "<25%" },
          { c: "#dc2626", l: "25~33" },
          { c: "#f97316", l: "33~40" },
          { c: "#facc15", l: "40~47" },
          { c: "#84cc16", l: "47~54" },
          { c: "#22c55e", l: "54~62" },
          { c: "#15803d", l: "62%+" },
        ].map((s) => (
          <span key={s.l} className="inline-flex items-center gap-1">
            <span
              className="inline-block h-3 w-5 rounded"
              style={{ backgroundColor: s.c }}
            />
            <span>{s.l}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
