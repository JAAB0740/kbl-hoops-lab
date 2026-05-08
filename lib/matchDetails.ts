import matchDetailsJson from "../data/match-details.json";

/**
 * KBL 게임 상세 정보 — 쿼터별 스코어 + 관중 수 + 시작/종료 시간.
 *
 * Fetch: npm run fetch:kbl-match-detail
 * Source: https://api.kbl.or.kr/match/{gmkey}
 *
 * data/match-details.json 의 byGmkey 인덱스로 게임키 → 상세 매핑.
 */

export interface MatchDetail {
  /** 1Q~4Q 쿼터 점수 [q1, q2, q3, q4] */
  home: number[];
  away: number[];
  /** 연장(EQ) 점수 — 연장 없으면 빈 배열, 있으면 [eq1, eq2, ...] */
  homeEq: number[];
  awayEq: number[];
  /** 관중 수 */
  crowds: number | null;
  /** 시작 시각 — KBL API 응답 그대로 ("1900" → 19:00) */
  gameStart: string | null;
  /** 종료 시각 ("2101" → 21:01) */
  gameEnd: string | null;
}

const RAW = (matchDetailsJson as {
  byGmkey?: Record<string, MatchDetail>;
}).byGmkey ?? {};

export const MATCH_DETAILS_FETCHED_AT =
  (matchDetailsJson as { fetchedAt?: string | null }).fetchedAt ?? null;

/** 게임키 → 상세. 없으면 null. */
export function getMatchDetail(gmkey: string | undefined): MatchDetail | null {
  if (!gmkey) return null;
  return RAW[gmkey] ?? null;
}

/** "1900" → "19:00" 포맷. */
export function fmtKblTime(t: string | null | undefined): string {
  if (!t || !/^\d{4}$/.test(t)) return "—";
  return `${t.slice(0, 2)}:${t.slice(2, 4)}`;
}

/** 쿼터 합 (연장 포함). */
export function totalScore(side: { q: number[]; eq: number[] }): number {
  return [...side.q, ...side.eq].reduce((a, b) => a + b, 0);
}
