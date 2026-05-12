"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

/**
 * 8축 Radar (Spider) Chart — 선수/팀 다차원 비교.
 *
 * 각 축은 0~100 percentile (리그 분포 대비 위치) — 직관적 해석 가능.
 * 여러 series 를 overlay 해서 비교 (예: 정규시즌 vs PO, 선수 A vs B).
 */

export interface RadarSeries {
  /** Legend 에 표시될 이름 (예: "정규시즌", "PO", "이정현") */
  label: string;
  /** 라인/면 색상 (hex) */
  color: string;
  /** 각 축의 percentile 값 (0~100). axes 와 같은 순서/길이 */
  values: number[];
  /** Tooltip 에 표시할 원본 stat 값 (옵션) — 예: ["18.5 PPG", "5.1 APG", ...] */
  rawLabels?: string[];
}

interface Props {
  title?: string;
  subtitle?: string;
  /** 축 라벨 (예: ["PPG", "RPG", "APG", "STL", "BLK", "FG%", "3P%", "FT%"]) */
  axes: string[];
  /** 1~3개 권장 (4개부터 가독성 떨어짐) */
  series: RadarSeries[];
  /** 차트 높이 (기본 320) */
  height?: number;
}

interface DataPoint {
  axis: string;
  [seriesLabel: string]: string | number;
}

export function StatRadar({
  title,
  subtitle,
  axes,
  series,
  height = 320,
}: Props) {
  // recharts 형식으로 변환: [{ axis: "PPG", 정규시즌: 78, PO: 92 }, ...]
  const data: DataPoint[] = axes.map((axis, i) => {
    const point: DataPoint = { axis };
    for (const s of series) {
      point[s.label] = s.values[i] ?? 0;
    }
    return point;
  });

  // axis 인덱스 → series 별 rawLabels 매핑 (tooltip 용)
  const rawByAxis: Record<string, Record<string, string>> = {};
  axes.forEach((axis, i) => {
    rawByAxis[axis] = {};
    for (const s of series) {
      if (s.rawLabels?.[i]) rawByAxis[axis][s.label] = s.rawLabels[i];
    }
  });

  return (
    <div className="card p-5">
      {title && (
        <div className="mb-3">
          <h3 className="text-base font-semibold text-ink-50">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-[12px] text-ink-500">{subtitle}</p>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#1b1e24" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: "#a1a1aa", fontSize: 13, fontWeight: 500 }}
          />
          <PolarRadiusAxis
            domain={[0, 100]}
            tick={false}
            axisLine={false}
            stroke="#1b1e24"
          />
          {series.map((s) => (
            <Radar
              key={s.label}
              name={s.label}
              dataKey={s.label}
              stroke={s.color}
              fill={s.color}
              fillOpacity={0.25}
              strokeWidth={2}
            />
          ))}
          <Tooltip
            contentStyle={{
              backgroundColor: "#131519",
              border: "1px solid #1b1e24",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#fafafa", fontWeight: 600 }}
            formatter={(value: number, name: string, props: { payload?: DataPoint }) => {
              const axis = String(props.payload?.axis ?? "");
              const raw = rawByAxis[axis]?.[name];
              return [
                raw ? `${raw} (상위 ${value}%)` : `상위 ${value}%`,
                name,
              ];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "12px", color: "#a1a1aa" }}
            iconType="circle"
          />
        </RadarChart>
      </ResponsiveContainer>

      <p className="mt-2 text-center text-[11px] text-ink-500">
        각 축 = 리그 분포 대비 상위 percentile (100 = 리그 1위, 50 = 중간)
      </p>
    </div>
  );
}
