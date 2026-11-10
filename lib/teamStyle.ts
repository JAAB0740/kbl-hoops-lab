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
  winPct?: number;
  stats: {
    fgAtt: number;
    threeAtt: number;
    points: number;
    margin?: number;
  };
}

const ADV: AdvancedRow[] =
  ((teamAdvancedJson as { filters?: { all?: AdvancedRow[] } }).filters?.all) ?? [];
type Filters = {
  all?: FilteredRow[]; home?: FilteredRow[]; away?: FilteredRow[]; q4?: FilteredRow[];
};
const FIL_BY_KEY = (teamFilteredJson as { filters?: Filters }).filters ?? {};
const FIL: FilteredRow[] = FIL_BY_KEY.all ?? [];

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

/** 분할 (홈/원정/Q4) 승률·마진 — "경기 성격별 약점" 표시용. */
export interface TeamSplits {
  homeWinPct: number | null;   // 이 팀이 홈일 때 승률
  awayWinPct: number | null;   // 이 팀이 원정일 때 승률
  q4Margin: number | null;     // Q4 득실 평균 마진 (+ 리드 확장 / − 줄어듦)
}

export function getTeamSplits(shortName: string): TeamSplits {
  const home = FIL_BY_KEY.home?.find((r) => r.shortName === shortName);
  const away = FIL_BY_KEY.away?.find((r) => r.shortName === shortName);
  const q4   = FIL_BY_KEY.q4?.find((r) => r.shortName === shortName);
  return {
    homeWinPct: home && home.winPct != null ? home.winPct * 100 : null,
    awayWinPct: away && away.winPct != null ? away.winPct * 100 : null,
    q4Margin:   q4 && q4.stats.margin != null ? q4.stats.margin : null,
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
