/**
 * 산점도 (CustomScatter / TeamEfficiencyScatter) 전용 팀 마커 스타일.
 *
 * TEAM_COLORS 는 standings/bars/hero 카드 전역 색이라 건드리지 않고,
 * 산점도 점(dot)만 구분력 높도록 별도 매핑을 둔다.
 */
import { TEAM_COLORS } from "./data";

export interface TeamMarker {
  fill: string;
  stroke: string;
  strokeWidth: number;
  /** 범례 텍스트 + 아이콘 색 */
  legend: string;
}

/**
 * 산점도 전용 팀 색 — TEAM_COLORS 글로벌과 분리.
 * shape 로 1차 식별, 색으로 2차 식별. 범례 텍스트 색도 이 값 사용.
 */
const SCATTER_COLOR: Record<string, string> = {
  KT:        "#FFFFFF", // 흰색 (별)
  DB:        "#10B981", // 초록 (D)
  삼성:      "#3B82F6", // 파랑 (번개)
  소노:      "#7DD3FC", // 하늘색 (구름)
  현대모비스: "#9CA3AF", // 회색 (태양)
  KCC:       "#1E3A8A", // 짙은 네이비 (방패)
  정관장:    "#800000", // 마룬 (방패)
  LG:        "#FACC15", // 노랑 (날카로운 날개)
  가스공사:  "#3B82F6", // 파랑 (둥근 날개) — 삼성과 같은 hue, shape 로 구분
  SK:        "#EF4444", // 빨강 (기사 투구)
};

export function getTeamMarker(short: string): TeamMarker {
  const c = SCATTER_COLOR[short] ?? TEAM_COLORS[short] ?? "#94a3b8";
  return { fill: c, stroke: c, strokeWidth: 1.5, legend: c };
}
