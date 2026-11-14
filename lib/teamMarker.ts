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
  /** 범례(legend)에 쓸 색 — 어두운 배경에서 안 보이는 fill(검정) 등 보정용 */
  legend: string;
  /** 점 중앙 작은 dot — 보조 식별자 */
  innerDot?: { color: string; rRatio: number };
  /** 점 위 가로 띠 — 보조 식별자 */
  hStripe?: { color: string; heightRatio: number };
}

export function getTeamMarker(short: string): TeamMarker {
  switch (short) {
    case "KT":
      // 흰 테두리 + 검정 fill — 어두운 배경에서 역상 식별
      return { fill: "#000000", stroke: "#FFFFFF", strokeWidth: 1.5, legend: "#FFFFFF" };
    case "소노":
      // 더 밝은 하늘색 (sky-300)
      return { fill: "#7DD3FC", stroke: "#7DD3FC", strokeWidth: 1.5, legend: "#7DD3FC" };
    case "KCC":
      // 더 어두운 네이비 (blue-900)
      return { fill: "#1E3A8A", stroke: "#1E3A8A", strokeWidth: 1.5, legend: "#1E3A8A" };
    case "가스공사":
      // 기존 시안 + 하얀 가로 줄무늬
      return {
        fill: "#06B6D4", stroke: "#06B6D4", strokeWidth: 1.5, legend: "#06B6D4",
        hStripe: { color: "#FFFFFF", heightRatio: 0.2 },
      };
    case "SK":
      // 기존 살몬 + 하얀 중앙점
      return {
        fill: "#F87171", stroke: "#F87171", strokeWidth: 1.5, legend: "#F87171",
        innerDot: { color: "#FFFFFF", rRatio: 0.35 },
      };
    case "정관장":
      // 기존 빨강 + 검정 중앙점
      return {
        fill: "#DC2626", stroke: "#DC2626", strokeWidth: 1.5, legend: "#DC2626",
        innerDot: { color: "#000000", rRatio: 0.35 },
      };
    default: {
      const c = TEAM_COLORS[short] ?? "#94a3b8";
      return { fill: c, stroke: c, strokeWidth: 1.5, legend: c };
    }
  }
}
