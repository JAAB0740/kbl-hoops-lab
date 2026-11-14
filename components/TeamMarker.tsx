import { getTeamMarker } from "@/lib/teamMarker";

/**
 * 산점도용 팀 식별 마커 — 원 + 선택적 중앙 dot / 가로 띠.
 *
 *   - CustomScatter (Recharts): `shape={(p) => <TeamDot team={t} cx={p.cx} cy={p.cy} r={...} />}`
 *   - TeamEfficiencyScatter (hand SVG): `<TeamDot team={t.shortName} cx={cx} cy={cy} r={r} />`
 *
 * 띠는 r * 1.6 폭의 사각형을 원 위에 올려 clip 없이도 시각적으로 원 안에 들어감 (r ≤ 15px 가정).
 */
export function TeamDot({
  team, cx, cy, r, fillOpacity = 0.85,
}: {
  team: string;
  cx: number;
  cy: number;
  r: number;
  fillOpacity?: number;
}) {
  const m = getTeamMarker(team);
  return (
    <g>
      <circle
        cx={cx} cy={cy} r={r}
        fill={m.fill} fillOpacity={fillOpacity}
        stroke={m.stroke} strokeWidth={m.strokeWidth}
      />
      {m.hStripe && (
        <rect
          x={cx - r * 0.8}
          y={cy - (r * m.hStripe.heightRatio) / 2}
          width={r * 1.6}
          height={r * m.hStripe.heightRatio}
          fill={m.hStripe.color}
        />
      )}
      {m.innerDot && (
        <circle
          cx={cx} cy={cy}
          r={r * m.innerDot.rRatio}
          fill={m.innerDot.color}
        />
      )}
    </g>
  );
}
