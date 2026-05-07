import type { FilteredTeam } from "@/lib/data";
import { TEAM_COLORS } from "@/lib/data";

/**
 * Off Rtg × Def Rtg 산점도.
 *  - x축: Offensive Rating (오른쪽 = 공격 효율 ↑)
 *  - y축: Defensive Rating (위쪽 = 실점 적음, y축 반전)
 *  - 우상단 = 강팀, 좌하단 = 약팀
 *  - 점 색상 = 팀 컬러, 점 크기 = 승수 비례
 *  - 사분면 라벨: 강팀 / 슛 좋은 약팀 / 수비 좋은 약팀 / 약팀
 */
export function TeamEfficiencyScatter({
  teams,
  title = "공수 효율 산점도",
}: {
  teams: FilteredTeam[];
  title?: string;
}) {
  const withAdv = teams.filter((t) => t.advanced);
  if (withAdv.length === 0) return null;

  const W = 720, H = 480;
  const PAD = { l: 60, r: 20, t: 30, b: 50 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const xs = withAdv.map((t) => t.advanced!.offRtg);
  const ys = withAdv.map((t) => t.advanced!.defRtg);
  const xMin = Math.min(...xs) - 2;
  const xMax = Math.max(...xs) + 2;
  const yMin = Math.min(...ys) - 2;
  const yMax = Math.max(...ys) + 2;
  const xMid = (xMin + xMax) / 2;
  const yMid = (yMin + yMax) / 2;

  const x2px = (v: number) => PAD.l + ((v - xMin) / (xMax - xMin)) * innerW;
  // y축 반전: 작을수록 위 (실점 적음 = 좋음)
  const y2px = (v: number) => PAD.t + ((v - yMin) / (yMax - yMin)) * innerH;

  const maxWins = Math.max(...withAdv.map((t) => t.wins));
  const r = (wins: number) => 6 + (wins / Math.max(maxWins, 1)) * 12;

  // 격자값
  const xTicks = 5;
  const yTicks = 5;

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">{title}</h3>
          <p className="mt-0.5 text-[11px] text-ink-500">
            우상단 = 강팀 (공격 효율 ↑ · 실점 ↓) · 점 크기 = 승수
          </p>
        </div>
        <div className="text-[11px] text-ink-500">
          <span className="stat-num text-ink-300">{withAdv.length}</span>팀
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* 격자 */}
          <g stroke="#1f2937" strokeWidth="1">
            {Array.from({ length: xTicks + 1 }, (_, i) => {
              const x = PAD.l + (innerW * i) / xTicks;
              return <line key={`xg${i}`} x1={x} y1={PAD.t} x2={x} y2={PAD.t + innerH} />;
            })}
            {Array.from({ length: yTicks + 1 }, (_, i) => {
              const y = PAD.t + (innerH * i) / yTicks;
              return <line key={`yg${i}`} x1={PAD.l} y1={y} x2={PAD.l + innerW} y2={y} />;
            })}
          </g>

          {/* 사분면 분할선 (평균) */}
          <g stroke="#374151" strokeDasharray="6 5" strokeWidth="1.5">
            <line x1={x2px(xMid)} y1={PAD.t} x2={x2px(xMid)} y2={PAD.t + innerH} />
            <line x1={PAD.l} y1={y2px(yMid)} x2={PAD.l + innerW} y2={y2px(yMid)} />
          </g>

          {/* 사분면 라벨 */}
          <g
            fontFamily="-apple-system, sans-serif"
            fontSize="10"
            fontWeight="600"
            fill="#6b7280"
            textAnchor="middle"
          >
            <text x={x2px(xMid) + innerW * 0.25} y={y2px(yMid) - innerH * 0.42}>강팀 (공·수 모두 ↑)</text>
            <text x={x2px(xMid) - innerW * 0.25} y={y2px(yMid) - innerH * 0.42}>수비형 약팀</text>
            <text x={x2px(xMid) + innerW * 0.25} y={y2px(yMid) + innerH * 0.42}>슛 잘하는 약팀</text>
            <text x={x2px(xMid) - innerW * 0.25} y={y2px(yMid) + innerH * 0.42}>약팀 (공·수 모두 ↓)</text>
          </g>

          {/* x축 — Off Rtg */}
          <g
            fontFamily="-apple-system, sans-serif"
            fontSize="10"
            fill="#9ca3af"
            textAnchor="middle"
          >
            {Array.from({ length: xTicks + 1 }, (_, i) => {
              const v = xMin + ((xMax - xMin) * i) / xTicks;
              const x = PAD.l + (innerW * i) / xTicks;
              return <text key={`xt${i}`} x={x} y={H - PAD.b + 16}>{v.toFixed(0)}</text>;
            })}
            <text x={PAD.l + innerW / 2} y={H - 8} fontSize="11" fontWeight="600" fill="#d1d5db">
              Offensive Rating →
            </text>
          </g>

          {/* y축 — Def Rtg */}
          <g
            fontFamily="-apple-system, sans-serif"
            fontSize="10"
            fill="#9ca3af"
            textAnchor="end"
          >
            {Array.from({ length: yTicks + 1 }, (_, i) => {
              const v = yMin + ((yMax - yMin) * i) / yTicks;
              const y = PAD.t + (innerH * i) / yTicks;
              return <text key={`yt${i}`} x={PAD.l - 8} y={y + 4}>{v.toFixed(0)}</text>;
            })}
            <text
              x={20}
              y={PAD.t + innerH / 2}
              fontSize="11"
              fontWeight="600"
              fill="#d1d5db"
              textAnchor="middle"
              transform={`rotate(-90, 20, ${PAD.t + innerH / 2})`}
            >
              ← Defensive Rating
            </text>
          </g>

          {/* 점 */}
          <g>
            {withAdv.map((t) => {
              const cx = x2px(t.advanced!.offRtg);
              const cy = y2px(t.advanced!.defRtg);
              const color = TEAM_COLORS[t.shortName] ?? "#94a3b8";
              return (
                <g key={t.code}>
                  <circle cx={cx} cy={cy} r={r(t.wins)} fill={color} fillOpacity="0.55" stroke={color} strokeWidth="2" />
                  <text
                    x={cx}
                    y={cy - r(t.wins) - 4}
                    fontFamily="-apple-system, sans-serif"
                    fontSize="11"
                    fontWeight="600"
                    fill="#e5e7eb"
                    stroke="#0d0f13"
                    strokeWidth="3"
                    paintOrder="stroke"
                    textAnchor="middle"
                  >
                    {t.shortName}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
