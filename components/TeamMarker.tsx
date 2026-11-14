import { getTeamMarker } from "@/lib/teamMarker";
import { TeamShape } from "@/components/TeamShapes";

/**
 * 산점도용 팀 마커 — 팀별 고유 shape (TeamShapes.tsx).
 *
 *   - CustomScatter (Recharts): `shape={(p) => <TeamDot team=... cx=... cy=... r=... />}`
 *   - TeamEfficiencyScatter (hand SVG): `<TeamDot team=... cx=... cy=... r=... />`
 *
 * 모든 팀 shape 는 -10..+10 좌표계에 그려져 있으므로 `scale(r/10)` 로 리사이즈.
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
    <g transform={`translate(${cx},${cy}) scale(${r / 10})`}>
      <TeamShape team={team} fill={m.fill} stroke={m.stroke} fillOpacity={fillOpacity} />
    </g>
  );
}
