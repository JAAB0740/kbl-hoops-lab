/**
 * 팀 스타일 지표 — Pace / OffRtg / DRtg / 3PA 비중 / OReb%.
 *
 * `team-advanced.json` 과 `team-filtered.json` 의 filters.all[] 에서
 * shortName 매칭으로 한 팀의 "스타일" 번들을 뽑는다. GamePreviewPoints
 * (/games/[id] 경기 미리보기) 에서 양 팀 비교용.
 */
import teamAdvancedJson from "../data/season/49/team-advanced.json";
import teamFilteredJson from "../data/season/49/team-filtered.json";

interface AdvancedRow {
  shortName: string;
  advanced: {
    offRtg: number;
    defRtg: number;
    netRtg: number;
    pace: number;
    orebPct: number;
    tovPct: number;
  };
}
interface FilteredRow {
  shortName: string;
  stats: {
    fgAtt: number;
    threeAtt: number;
    points: number;
  };
}

const ADV: AdvancedRow[] =
  ((teamAdvancedJson as { filters?: { all?: AdvancedRow[] } }).filters?.all) ?? [];
const FIL: FilteredRow[] =
  ((teamFilteredJson as { filters?: { all?: FilteredRow[] } }).filters?.all) ?? [];

export interface TeamStyle {
  pace: number;         // poss / 48min (team-advanced 가 48 기준)
  offRtg: number;
  defRtg: number;
  threeRate: number;    // 3PA / FGA * 100
  orebPct: number;
}

export function getTeamStyle(shortName: string): TeamStyle | null {
  const a = ADV.find((r) => r.shortName === shortName);
  const f = FIL.find((r) => r.shortName === shortName);
  if (!a && !f) return null;
  const threeRate =
    f && f.stats.fgAtt > 0 ? (f.stats.threeAtt / f.stats.fgAtt) * 100 : 0;
  return {
    pace: a?.advanced.pace ?? 0,
    offRtg: a?.advanced.offRtg ?? 0,
    defRtg: a?.advanced.defRtg ?? 0,
    threeRate,
    orebPct: a?.advanced.orebPct ?? 0,
  };
}

/** 리그 전체 min/max — 상대 위치 (리그 상위/하위) 라벨링용. */
export function leagueStyleRange(): Record<keyof TeamStyle, { min: number; max: number }> {
  const all = ADV.map((a) => a.shortName)
    .map((s) => getTeamStyle(s))
    .filter((x): x is TeamStyle => !!x);
  const range = <K extends keyof TeamStyle>(key: K) => {
    const vals = all.map((t) => t[key]).filter((v) => Number.isFinite(v));
    return { min: Math.min(...vals), max: Math.max(...vals) };
  };
  return {
    pace: range("pace"),
    offRtg: range("offRtg"),
    defRtg: range("defRtg"),
    threeRate: range("threeRate"),
    orebPct: range("orebPct"),
  };
}
