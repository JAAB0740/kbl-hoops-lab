"use client";

import { useMemo, useState } from "react";
import type { FilteredTeam, FilterKey } from "@/lib/data";
import { TEAM_COLORS } from "@/lib/data";

/**
 * 라운드별 팀 추이 라인 차트 (1~6라운드).
 *  - 각 팀의 선택된 metric 값을 라운드 축에 따라 라인으로 표시.
 *  - 메트릭 선택 가능: 승률 / PPG / FG% / 3P% / OffRtg / DefRtg / NetRtg / eFG% / TOV%
 *  - 마우스 hover 시 해당 팀 라인 강조, 나머지 디밍.
 */

type Metric = {
  key: string;
  label: string;
  desc: string;
  pick: (t: FilteredTeam) => number | null;
  fmt: (v: number) => string;
  /** y축 0 baseline 사용 여부 */
  zeroBased: boolean;
  invert?: boolean; // 낮을수록 좋음
};

const METRICS: Metric[] = [
  {
    key: "winPct",
    label: "승률",
    desc: "라운드별 승률",
    pick: (t) => t.winPct * 100,
    fmt: (v) => `${v.toFixed(1)}%`,
    zeroBased: true,
  },
  {
    key: "ppg",
    label: "PPG",
    desc: "라운드별 경기당 득점",
    pick: (t) => t.stats.points,
    fmt: (v) => v.toFixed(1),
    zeroBased: false,
  },
  {
    key: "fgPct",
    label: "FG%",
    desc: "라운드별 야투 성공률",
    pick: (t) => t.stats.fgPct,
    fmt: (v) => `${v.toFixed(1)}%`,
    zeroBased: false,
  },
  {
    key: "threePct",
    label: "3P%",
    desc: "라운드별 3점슛 성공률",
    pick: (t) => t.stats.threePct,
    fmt: (v) => `${v.toFixed(1)}%`,
    zeroBased: false,
  },
  {
    key: "offRtg",
    label: "ORtg",
    desc: "라운드별 공격 효율 (100 포제션당 득점)",
    pick: (t) => t.advanced?.offRtg ?? null,
    fmt: (v) => v.toFixed(1),
    zeroBased: false,
  },
  {
    key: "defRtg",
    label: "DRtg",
    desc: "라운드별 수비 효율 (낮을수록 좋음)",
    pick: (t) => t.advanced?.defRtg ?? null,
    fmt: (v) => v.toFixed(1),
    zeroBased: false,
    invert: true,
  },
  {
    key: "netRtg",
    label: "NetRtg",
    desc: "라운드별 순효율 (Off - Def)",
    pick: (t) => t.advanced?.netRtg ?? null,
    fmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`,
    zeroBased: false,
  },
  {
    key: "efgPct",
    label: "eFG%",
    desc: "Effective FG% (3점 가중)",
    pick: (t) => t.advanced?.efgPct ?? null,
    fmt: (v) => `${v.toFixed(1)}%`,
    zeroBased: false,
  },
  {
    key: "tovPct",
    label: "TOV%",
    desc: "턴오버 비율 (낮을수록 좋음)",
    pick: (t) => t.advanced?.tovPct ?? null,
    fmt: (v) => `${v.toFixed(1)}%`,
    zeroBased: false,
    invert: true,
  },
];

const ROUND_KEYS: FilterKey[] = ["r1", "r2", "r3", "r4", "r5", "r6"];

export function TeamRoundTrend({
  filters,
  title = "라운드별 팀 추이",
}: {
  filters: Record<FilterKey, FilteredTeam[]>;
  title?: string;
}) {
  const [metricKey, setMetricKey] = useState<string>("winPct");
  const [highlight, setHighlight] = useState<string | null>(null);

  const metric = METRICS.find((m) => m.key === metricKey) ?? METRICS[0];

  // 각 팀 × 라운드 매트릭스
  const teamSeries = useMemo(() => {
    const byCode = new Map<string, { team: FilteredTeam; values: (number | null)[] }>();
    for (const round of ROUND_KEYS) {
      const arr = filters[round] ?? [];
      for (const t of arr) {
        if (!byCode.has(t.code)) {
          byCode.set(t.code, { team: t, values: Array(ROUND_KEYS.length).fill(null) });
        }
      }
    }
    for (let i = 0; i < ROUND_KEYS.length; i++) {
      const arr = filters[ROUND_KEYS[i]] ?? [];
      for (const t of arr) {
        const slot = byCode.get(t.code);
        if (!slot) continue;
        slot.values[i] = metric.pick(t);
      }
    }
    return [...byCode.values()];
  }, [filters, metric]);

  // y범위
  const allValues = teamSeries.flatMap((s) => s.values).filter((v): v is number => v != null);
  if (allValues.length === 0) return null;
  let yMin = Math.min(...allValues);
  let yMax = Math.max(...allValues);
  if (metric.zeroBased) yMin = 0;
  const ySpan = yMax - yMin;
  yMin -= ySpan * 0.05;
  yMax += ySpan * 0.05;

  const W = 760, H = 380;
  const PAD = { l: 50, r: 110, t: 20, b: 36 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const xAt = (i: number) =>
    PAD.l + (innerW * i) / (ROUND_KEYS.length - 1);
  const yAt = (v: number) =>
    PAD.t + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const yTicks = 5;

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
          <p className="mt-0.5 text-[12px] text-ink-500">{metric.desc}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((m) => {
            const active = m.key === metricKey;
            return (
              <button
                key={m.key}
                onClick={() => setMetricKey(m.key)}
                className={[
                  "rounded-md px-2.5 py-1 text-[12px] font-medium transition",
                  active
                    ? "bg-flame-500/20 text-flame-400 ring-1 ring-flame-500/40"
                    : "border border-court-700 bg-court-800/70 text-ink-300 hover:border-court-600 hover:text-ink-100",
                ].join(" ")}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          xmlns="http://www.w3.org/2000/svg"
          onMouseLeave={() => setHighlight(null)}
        >
          {/* y 격자 */}
          <g stroke="#1f2937" strokeWidth="1">
            {Array.from({ length: yTicks + 1 }, (_, i) => {
              const y = PAD.t + (innerH * i) / yTicks;
              return (
                <line
                  key={`yg${i}`}
                  x1={PAD.l}
                  y1={y}
                  x2={PAD.l + innerW}
                  y2={y}
                />
              );
            })}
          </g>

          {/* y 라벨 */}
          <g
            fontFamily="-apple-system, sans-serif"
            fontSize="10"
            fill="#9ca3af"
            textAnchor="end"
          >
            {Array.from({ length: yTicks + 1 }, (_, i) => {
              const v = yMax - ((yMax - yMin) * i) / yTicks;
              const y = PAD.t + (innerH * i) / yTicks;
              return (
                <text key={`yl${i}`} x={PAD.l - 8} y={y + 4}>
                  {metric.fmt(v)}
                </text>
              );
            })}
          </g>

          {/* x 라벨 (라운드) */}
          <g
            fontFamily="-apple-system, sans-serif"
            fontSize="11"
            fontWeight="500"
            fill="#9ca3af"
            textAnchor="middle"
          >
            {ROUND_KEYS.map((_, i) => (
              <text key={`xl${i}`} x={xAt(i)} y={H - PAD.b + 18}>
                {i + 1}R
              </text>
            ))}
          </g>

          {/* 라인 */}
          <g>
            {teamSeries.map((s) => {
              const color = TEAM_COLORS[s.team.shortName] ?? "#94a3b8";
              const isHighlight = highlight === s.team.code;
              const isDimmed = highlight !== null && !isHighlight;
              const opacity = isDimmed ? 0.18 : 1;
              const sw = isHighlight ? 3.5 : 2;
              // 라인 path (null 값 건너뛰기)
              const points = s.values
                .map((v, i) => (v == null ? null : { x: xAt(i), y: yAt(v) }))
                .filter((p): p is { x: number; y: number } => p !== null);
              if (points.length === 0) return null;
              const path = points
                .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                .join(" ");
              return (
                <g
                  key={s.team.code}
                  onMouseEnter={() => setHighlight(s.team.code)}
                  style={{ cursor: "pointer", opacity }}
                >
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={sw}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={isHighlight ? 4.5 : 3}
                      fill={color}
                      stroke="#0d0f13"
                      strokeWidth="1.5"
                    />
                  ))}
                </g>
              );
            })}
          </g>

          {/* 우측 팀 라벨 (마지막 라운드 끝점에 표시) */}
          <g
            fontFamily="-apple-system, sans-serif"
            fontSize="10"
            fontWeight="600"
          >
            {teamSeries
              .map((s) => {
                // 마지막 non-null 값
                let lastIdx = -1;
                for (let i = s.values.length - 1; i >= 0; i--) {
                  if (s.values[i] != null) {
                    lastIdx = i;
                    break;
                  }
                }
                if (lastIdx < 0) return null;
                const lastVal = s.values[lastIdx]!;
                return {
                  team: s.team,
                  x: xAt(lastIdx),
                  y: yAt(lastVal),
                };
              })
              .filter((p): p is NonNullable<typeof p> => p !== null)
              // y 좌표 정렬 → 라벨 겹침 줄이기 위해 그대로 그림 (간단히)
              .map((p) => {
                const color = TEAM_COLORS[p.team.shortName] ?? "#94a3b8";
                const isHighlight = highlight === p.team.code;
                const isDimmed = highlight !== null && !isHighlight;
                return (
                  <text
                    key={p.team.code}
                    x={PAD.l + innerW + 6}
                    y={p.y + 4}
                    fill={color}
                    opacity={isDimmed ? 0.25 : 1}
                    onMouseEnter={() => setHighlight(p.team.code)}
                    style={{ cursor: "pointer" }}
                  >
                    {p.team.shortName}
                  </text>
                );
              })}
          </g>
        </svg>
      </div>

      <p className="mt-2 text-[11px] text-ink-500">
        ※ 마우스를 라인 위에 올리면 해당 팀 강조. {metric.invert ? "이 메트릭은 낮을수록 좋음." : ""}
      </p>
    </div>
  );
}
