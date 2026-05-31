"use client";

import { useState } from "react";
import {
  HEX_SIZE,
  SHOT_CHART_GEOMETRY,
  ZONE_LABELS,
  type HexBin,
  type PlayerShotChart,
} from "@/lib/shotCharts";

/**
 * 헥스빈 (Hexbin) 슛 차트 — Kirk Goldsberry 스타일.
 *
 *  - 크기: 시도수에 비례 (volume)
 *  - 색상: 리그 zone 평균 대비 FG% diff — diverging (red→yellow→green, AreaShotChart 와 통일)
 *  - 다크 모드 / 옅은 코트 라인 / 헥스 위 hover/tap 시 툴팁
 *  - 헥스 내부 텍스트 없음 (시각 우선)
 */

const G = SHOT_CHART_GEOMETRY;

/** diff (pp 단위) → diverging color. AreaShotChart 와 동일한 신호등 팔레트.
 *  -15 이하 = #991b1b (짙은 빨강, 못 넣음), 0 = #facc15 (노랑, 평균),
 *  +15 이상 = #15803d (짙은 초록, 잘 넣음). 선형 보간. */
function diffToColor(diff: number): string {
  const d = Math.max(-15, Math.min(15, diff));
  const RED = [153, 27, 27];       // #991b1b (red-800) — 평균 한참 미달
  const YELLOW = [250, 204, 21];   // #facc15 (yellow-400) — 평균
  const GREEN = [21, 128, 61];     // #15803d (green-700) — 평균 한참 초과
  let r: number, g: number, b: number;
  if (d < 0) {
    const t = (d + 15) / 15;
    r = Math.round(RED[0] + (YELLOW[0] - RED[0]) * t);
    g = Math.round(RED[1] + (YELLOW[1] - RED[1]) * t);
    b = Math.round(RED[2] + (YELLOW[2] - RED[2]) * t);
  } else {
    const t = d / 15;
    r = Math.round(YELLOW[0] + (GREEN[0] - YELLOW[0]) * t);
    g = Math.round(YELLOW[1] + (GREEN[1] - YELLOW[1]) * t);
    b = Math.round(YELLOW[2] + (GREEN[2] - YELLOW[2]) * t);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

/** 그리드 반경 대비 최대 draw 반경 — 85% 로 capping → 인접 헥스간 자연 여백 확보. */
const MAX_DRAW_R = HEX_SIZE * 0.85; // 11 * 0.85 ≈ 9.35
/** 최소 draw 반경 — 시도 1개라도 색 식별 가능한 크기 보존. */
const MIN_DRAW_R = 2.5;

/** pointy-top 6각형 vertices — SVG polygon points 문자열 */
function hexPolygonPoints(cx: number, cy: number, R: number): string {
  const xOff = (R * Math.sqrt(3)) / 2;
  const pts: Array<[number, number]> = [
    [cx, cy - R],
    [cx + xOff, cy - R / 2],
    [cx + xOff, cy + R / 2],
    [cx, cy + R],
    [cx - xOff, cy + R / 2],
    [cx - xOff, cy - R / 2],
  ];
  return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

export function HexShotMap({
  chart,
  title = "헥스빈 슛 차트",
  subtitle,
}: {
  chart: PlayerShotChart;
  title?: string;
  subtitle?: string;
}) {
  const [hovered, setHovered] = useState<HexBin | null>(null);

  if (!chart.hexBins || chart.hexBins.length === 0) {
    return null;
  }

  const W = G.HALF_W;
  const H = G.HALF_H;

  // 최대 시도 — 크기 스케일링 기준. 시도수가 너무 많은 hex(예: 림 근접 60+)는
  // 다른 hex 가 너무 작아지지 않게 capping (95th percentile 사용).
  const atts = chart.hexBins.map((h) => h.att).sort((a, b) => a - b);
  const p95Idx = Math.floor(atts.length * 0.95);
  const maxAtt = Math.max(atts[p95Idx] ?? atts[atts.length - 1] ?? 1, 1);

  /** 시도수 → draw 반경. 면적 비례(sqrt) + min/max clamp. */
  function hexRadius(att: number): number {
    const t = Math.min(1, Math.sqrt(att / maxAtt));
    return MIN_DRAW_R + (MAX_DRAW_R - MIN_DRAW_R) * t;
  }
  /** 시도수 → fillOpacity. 노이즈 줄이고 핵심 hot zone 강조 (0.55 → 1.0). */
  function hexOpacity(att: number): number {
    const t = Math.min(1, Math.sqrt(att / maxAtt));
    return 0.55 + 0.45 * t;
  }

  // 코트 라인 — 퓨어 블랙 배경 위 옅은 흰색 1px (시선을 뺏지 않음)
  const LINE = "rgba(255, 255, 255, 0.15)";
  const LINE_BRIGHT = "rgba(255, 255, 255, 0.35)"; // 림/백보드만 살짝 강조

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
        </div>
      </div>

      {/* 차트 + 툴팁 — Pure Black 배경, 네온 헥스 떠 보이게.
          max-w 로 컨테이너 축소 (~480px), aspect-ratio 는 viewBox 가 자동 유지. */}
      <div
        className="relative mx-auto max-w-[480px] overflow-hidden rounded-lg"
        style={{ backgroundColor: "#000000" }}
        onMouseLeave={() => setHovered(null)}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-auto w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* 코트 영역 외부 헥스 컷 — basket 기준 위·아래 대칭 (위 20, 아래 390) */}
          <defs>
            <clipPath id="hexmap-court-clip">
              <rect
                x={G.COURT_L_X}
                y={G.TOP_SIDELINE_Y}
                width={W - G.COURT_L_X - 5}
                height={G.BOT_SIDELINE_Y - G.TOP_SIDELINE_Y}
              />
            </clipPath>
          </defs>

          {/* ── 코트 라인 (배경) — 옅은 white. 데이터 시인성 우선. ─────────── */}
          {/* 코트 외곽 — basket 기준 위·아래 대칭 sideline (위 20, 아래 390) */}
          <rect
            x={G.COURT_L_X}
            y={G.TOP_SIDELINE_Y}
            width={W - G.COURT_L_X - 5}
            height={G.BOT_SIDELINE_Y - G.TOP_SIDELINE_Y}
            fill="none"
            stroke={LINE}
            strokeWidth="1"
          />
          {/* 페인트 */}
          <rect
            x={G.PAINT_X[0]}
            y={G.PAINT_Y[0]}
            width={G.PAINT_X[1] - G.PAINT_X[0]}
            height={G.PAINT_Y[1] - G.PAINT_Y[0]}
            fill="none"
            stroke={LINE}
            strokeWidth="1"
          />
          {/* free throw circle — FIBA 1.8m 반경 × scale 24.14 ≈ 44 */}
          <circle
            cx={G.PAINT_X[1]}
            cy={G.BASKET_Y}
            r="44"
            fill="none"
            stroke={LINE}
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          {/* 3pt 라인 — 검증 후 KBL 실제 arc r=160.
              corner 라인 y=50/360, arc-line 교차점 (100, 50) 및 (100, 360).
              chord 310 < 2r 320 → SVG arc 정상 렌더. */}
          <path
            d={[
              `M 20 50`,
              `L 100 50`,
              `A ${G.THREE_PT_R} ${G.THREE_PT_R} 0 0 1 100 360`,
              `L 20 360`,
            ].join(" ")}
            fill="none"
            stroke={LINE}
            strokeWidth="1"
          />
          {/* 백보드 + 림 */}
          <line
            x1={G.BASKET_X - 14}
            y1={G.BASKET_Y - 18}
            x2={G.BASKET_X - 14}
            y2={G.BASKET_Y + 18}
            stroke={LINE_BRIGHT}
            strokeWidth="1.5"
          />
          <circle
            cx={G.BASKET_X}
            cy={G.BASKET_Y}
            r="6"
            fill="none"
            stroke={LINE_BRIGHT}
            strokeWidth="1.5"
          />

          {/* ── 헥스빈 ───────────────────────────────────────────
              · stroke 를 퓨어 블랙(#000) + 1.5px → 헥스 사이에 검은 빈틈 → 형광 벌집이 떠 있는 느낌
              · hover 시 흰색 1.5px stroke 로 강조
              · fillOpacity 는 시도수에 비례 — 핵심 핫존 강조
              · att < 2 (싱글톤) 은 렌더 제외
              · 코트 외곽 외부 (대칭 sideline 밖) 은 clipPath 로 컷 */}
          <g clipPath="url(#hexmap-court-clip)">
            {chart.hexBins.filter((h) => h.att >= 2).map((h, i) => {
              const r = hexRadius(h.att);
              const color = diffToColor(h.diff);
              const isHovered = hovered && hovered.q === h.q && hovered.r === h.r;
              return (
                <polygon
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  points={hexPolygonPoints(h.cx, h.cy, r)}
                  fill={color}
                  fillOpacity={isHovered ? 1 : hexOpacity(h.att)}
                  stroke={isHovered ? "#ffffff" : "#000000"}
                  strokeWidth={isHovered ? 1.5 : 1.5}
                  onMouseEnter={() => setHovered(h)}
                  onClick={() => setHovered((cur) => (cur === h ? null : h))}
                  style={{ cursor: "pointer" }}
                />
              );
            })}
          </g>
        </svg>

        {/* 툴팁 — 상단 중앙 고정. 정확한 hex 위치보다 가독성 우선. */}
        {hovered && (
          <div
            className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-md border border-court-700/60 px-3 py-2 text-[12px]"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.9)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          >
            <div className="text-[13px] font-semibold text-ink-50">
              {ZONE_LABELS[hovered.zone]}
            </div>
            <div className="mt-0.5 stat-num text-ink-300">
              {hovered.made}/{hovered.att}{" "}
              <span className="font-semibold text-ink-100">
                {hovered.pct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-0.5 text-[11px]">
              <span className="text-ink-500">리그 zone 평균 대비 </span>
              <span
                className={`font-semibold ${
                  hovered.diff > 1
                    ? "text-hoop-400"
                    : hovered.diff < -1
                      ? "text-buzzer-400"
                      : "text-ink-200"
                }`}
                style={{ color: diffToColor(hovered.diff) }}
              >
                {hovered.diff > 0 ? "+" : ""}
                {hovered.diff.toFixed(1)}pp
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── 범례 ──────────────────────────────────────────── */}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4 px-1 text-[11px] text-ink-400">
        {/* 효율성 — 그라데이션 바 (헥스 컬러 스케일과 정확히 매칭) */}
        <div className="flex items-center gap-2">
          <span className="text-ink-500">차가움</span>
          <div className="flex flex-col items-center">
            <div
              className="h-2 w-32 rounded-full"
              style={{
                background:
                  "linear-gradient(to right, #991b1b, #facc15, #15803d)",
              }}
            />
            <div className="mt-0.5 flex w-32 justify-between text-[9px] text-ink-500">
              <span>−15pp</span>
              <span>0</span>
              <span>+15pp</span>
            </div>
          </div>
          <span className="text-ink-500">뜨거움</span>
        </div>

        {/* 시도량 — 3단계 크기 (실제 MIN_DRAW_R ~ MAX_DRAW_R 와 일치). 검정 stroke 통일 */}
        <div className="flex items-center gap-2">
          <span className="text-ink-500">시도</span>
          <svg width="80" height="22" viewBox="0 0 80 22">
            {[
              { x: 9,  R: MIN_DRAW_R,                          op: 0.55 },
              { x: 30, R: (MIN_DRAW_R + MAX_DRAW_R) / 2,       op: 0.78 },
              { x: 58, R: MAX_DRAW_R,                          op: 1.0  },
            ].map((s, i) => (
              <polygon
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                points={hexPolygonPoints(s.x, 11, s.R)}
                fill="#94a3b8"
                fillOpacity={s.op}
                stroke="#000000"
                strokeWidth="1.5"
              />
            ))}
          </svg>
          <span className="text-ink-500">적음 → 많음</span>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-snug text-ink-500">
        Kirk Goldsberry 스타일. 헥스 크기 = 시도수, 색상 = 해당 zone 의 리그 평균 대비
        FG% 차이. 헥스 hover/탭 시 상세 표시. 리그 baseline 은 KBL 정규+PO 38,000+ 슛 기준.
      </p>
    </section>
  );
}
