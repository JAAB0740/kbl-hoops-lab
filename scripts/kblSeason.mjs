/**
 * KBL 본선 시즌 코드 자동 계산.
 *
 * 시즌 기간: 매년 10월 ~ 다음해 5월 (챔피언결정전 포함).
 * 코드 패턴 (API 검증):
 *   - 47 = 2025-26 본선
 *   - 48 = (D리그 등 다른 리그가 사용)
 *   - 49 = 2026-27 본선
 *   → KBL 본선은 매년 +2 증가 (D리그가 중간 코드 사용 추정)
 *
 * 10월 1일 기준으로 시즌 전환.
 *
 * 환경변수 override:
 *   KBL_SEASON_CODE=49  → 수동 지정 (매년 +2 가정이 틀렸을 때)
 *   KBL_SEASON_YEAR=2026 → 시즌 시작 연도 수동 지정 (code 는 공식으로 계산)
 */

const BASE_CODE = 47;
const BASE_YEAR = 2025; // 2025-26 시즌의 시작 연도
const CODE_STEP = 2; // 매년 증가분

/**
 * @param {Date} [now] — 기준 시각 (default: 현재)
 * @returns {{code: string, startYear: number, endYear: number, from: string, to: string}}
 */
export function getCurrentSeason(now = new Date()) {
  // KBL_SEASON_CODE override
  if (process.env.KBL_SEASON_CODE) {
    const code = parseInt(process.env.KBL_SEASON_CODE, 10);
    const startYear = BASE_YEAR + (code - BASE_CODE) / CODE_STEP;
    return {
      code: String(code),
      startYear,
      endYear: startYear + 1,
      from: `${startYear}1001`,
      to: `${startYear + 1}0630`,
    };
  }

  // KBL_SEASON_YEAR override (시즌 시작 연도)
  let startYear;
  if (process.env.KBL_SEASON_YEAR) {
    startYear = parseInt(process.env.KBL_SEASON_YEAR, 10);
  } else {
    // 10월 이후 = 당해년도 시작 시즌, 1~9월 = 전년도 시작 시즌
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();
    startYear = month >= 10 ? year : year - 1;
  }

  const code = BASE_CODE + CODE_STEP * (startYear - BASE_YEAR);
  return {
    code: String(code),
    startYear,
    endYear: startYear + 1,
    from: `${startYear}1001`,
    to: `${startYear + 1}0630`,
  };
}

/** 콘솔 디버그용 */
export function logSeason(season = getCurrentSeason()) {
  console.log(
    `[KBL season] code=${season.code} · ${season.startYear}-${String(season.endYear).slice(-2)} · ${season.from} ~ ${season.to}`,
  );
}
