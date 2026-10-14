/**
 * KBL 본선 시즌 자동 감지 — scripts/kblSeason.mjs 의 TypeScript 포팅.
 *
 * 서버/클라이언트 양쪽에서 import 가능. 매 요청마다 호출돼도 저렴.
 *
 * 환경변수 override:
 *   NEXT_PUBLIC_KBL_SEASON_CODE=49  → 클라이언트 번들에도 노출
 *   KBL_SEASON_CODE=49              → 서버 전용
 */

const BASE_CODE = 47;
const BASE_YEAR = 2025; // 2025-26 시즌 시작 연도
const CODE_STEP = 2; // KBL 본선 매년 +2 (D리그가 중간 코드 사용)

export interface KblSeason {
  /** API 호출용 코드 (예: "49") */
  code: string;
  /** 시즌 시작 연도 (예: 2026 = 2026-27 시즌) */
  startYear: number;
  /** 시즌 종료 연도 (예: 2027) */
  endYear: number;
  /** API 날짜 범위 from (YYYYMMDD) */
  from: string;
  /** API 날짜 범위 to (YYYYMMDD) */
  to: string;
}

export function getCurrentSeason(now: Date = new Date()): KblSeason {
  const envCode =
    process.env.NEXT_PUBLIC_KBL_SEASON_CODE ?? process.env.KBL_SEASON_CODE;
  if (envCode) {
    const code = parseInt(envCode, 10);
    const startYear = BASE_YEAR + (code - BASE_CODE) / CODE_STEP;
    return mkSeason(code, startYear);
  }
  // 10월 이후 = 당해년도 시작 시즌, 1-9월 = 전년도 시작 시즌
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();
  const startYear = month >= 10 ? year : year - 1;
  const code = BASE_CODE + CODE_STEP * (startYear - BASE_YEAR);
  return mkSeason(code, startYear);
}

function mkSeason(code: number, startYear: number): KblSeason {
  return {
    code: String(code),
    startYear,
    endYear: startYear + 1,
    from: `${startYear}1001`,
    to: `${startYear + 1}0630`,
  };
}

/** "2026-27" 포맷 */
export function seasonLabel(season: KblSeason = getCurrentSeason()): string {
  return `${season.startYear}-${String(season.endYear).slice(-2)}`;
}
