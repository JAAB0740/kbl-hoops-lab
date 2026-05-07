import playerInfoJson from "../data/players-info.json";

/**
 * KBL 등록선수 메타정보 — 사진/국적/생년월일/신장/체중/학교/선수구분/드래프트.
 * Fetch: npm run fetch:kbl-player-info
 */

export type PlayerFlag = "국내" | "아시아쿼터" | "외국선수";

export interface PlayerSchools {
  primary: string | null;
  middle: string | null;
  high: string | null;
  university: string | null;
  graduate: string | null;
}

export interface PlayerDraft {
  year: number | null;
  round: number | null;
  rank: number | null;
}

export interface PlayerInfoEntry {
  pcode: string;
  kname: string;
  ename: string;
  teamCode: string;
  pos: string;
  backNum: string;
  flag: PlayerFlag;
  country: string;
  birthday: string;          // "YYYY-MM-DD" or ""
  pHeight: number | null;    // cm
  pWeight: number | null;    // kg
  schools: PlayerSchools;
  gradYear: number | null;
  draft: PlayerDraft | null;
  photoUrl: string | null;
  inSeason: number | null;
}

const RAW = (playerInfoJson as {
  byPcode?: Record<string, PlayerInfoEntry>;
  countByFlag?: Record<string, number>;
  fetchedAt?: string | null;
  totalRegistered?: number;
}).byPcode ?? {};

export const HAS_PLAYER_INFO = Object.keys(RAW).length > 0;
export const PLAYER_INFO_FETCHED_AT =
  (playerInfoJson as { fetchedAt?: string | null }).fetchedAt ?? null;
export const PLAYER_INFO_COUNT_BY_FLAG =
  (playerInfoJson as { countByFlag?: Record<string, number> }).countByFlag ?? {};

export function getPlayerInfo(pcode: string | undefined): PlayerInfoEntry | null {
  if (!pcode) return null;
  return RAW[pcode] ?? null;
}

/** 등록선수 전체 (필터/정렬 용이) */
export function allRegisteredPlayers(): PlayerInfoEntry[] {
  return Object.values(RAW);
}

/** 만 나이 (생년월일 → 오늘 기준) */
export function ageOf(birthday: string): number | null {
  if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return null;
  const [y, m, d] = birthday.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  const md = (now.getMonth() + 1) * 100 + now.getDate();
  const bdMd = m * 100 + d;
  if (md < bdMd) age--;
  return age;
}

/** 짧은 학력 표시 — 가장 최종 학력 */
export function topSchool(s: PlayerSchools): string | null {
  return s.graduate ?? s.university ?? s.high ?? s.middle ?? s.primary;
}

/** 드래프트 라벨 — "2016 1R 3순위" */
export function fmtDraft(d: PlayerDraft | null): string | null {
  if (!d) return null;
  const parts: string[] = [];
  if (d.year) parts.push(String(d.year));
  if (d.round) parts.push(`${d.round}R`);
  if (d.rank) parts.push(`${d.rank}순위`);
  return parts.length > 0 ? parts.join(" ") : null;
}

/** 포지션 라벨 매핑 (KBL 약어 → 한글) */
export function fmtPos(pos: string): string {
  const map: Record<string, string> = {
    G: "가드",
    GD: "가드",
    F: "포워드",
    FD: "포워드",
    C: "센터",
    "FC": "포워드/센터",
    "FG": "포워드/가드",
  };
  return map[pos] ?? pos;
}

/**
 * 시즌차 — KBL API 의 inSeason 값을 그대로 쓰면 가끔 비정상값 (39, 99 등) 이 들어옴.
 * 드래프트 연도 기반 계산값 + API 값 비교 후 안전한 값을 반환.
 *
 * 규칙:
 *  1) 드래프트 연도가 있으면 (currentSeasonStart - draftYear + 1) 로 시즌차 계산
 *  2) API 의 inSeason 이 합리적 범위 (1 ~ KBL 출범 후 시즌 수) 안이면 사용 후보
 *  3) 두 값이 ±2 이내로 비슷하면 API 값 우선 (KBL 공식 표시와 동일)
 *  4) 두 값이 크게 다르면 드래프트 기반 계산값 우선 (API 오류 방지)
 *  5) 외국인선수 등 드래프트 없는 경우 합리적 범위의 API 값만 사용
 */
const KBL_FIRST_SEASON_START_YEAR = 1997; // 1997-98 = 1시즌차

/** 현재 KBL 시즌 시작 연도 (예: 2025-26 시즌이면 2025). 10월 이후면 해당 연도, 그 이전이면 -1년. */
function currentSeasonStartYear(): number {
  const now = new Date();
  return now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
}

export function getSeasonsExperience(info: PlayerInfoEntry): number | null {
  const seasonStart = currentSeasonStartYear();
  const maxReasonable = seasonStart - KBL_FIRST_SEASON_START_YEAR + 1;

  // 드래프트 기반 계산
  const fromDraft =
    info.draft?.year &&
    info.draft.year >= KBL_FIRST_SEASON_START_YEAR &&
    info.draft.year <= seasonStart + 1
      ? seasonStart - info.draft.year + 1
      : null;

  // API inSeason — 합리적 범위만
  const fromApi =
    info.inSeason != null && info.inSeason > 0 && info.inSeason <= maxReasonable
      ? info.inSeason
      : null;

  // 둘 다 있으면 비교
  if (fromApi != null && fromDraft != null) {
    return Math.abs(fromApi - fromDraft) <= 2 ? fromApi : fromDraft;
  }

  return fromApi ?? fromDraft;
}

/** 국적 표기 — country 코드/이름 → 정규화 */
export function fmtCountry(country: string, flag: PlayerFlag): string {
  if (flag === "국내") return "대한민국";
  const c = country.trim();
  if (!c) return flag === "외국선수" ? "외국" : "아시아";
  // 흔한 코드
  const map: Record<string, string> = {
    USA: "미국",
    KOR: "대한민국",
    PHI: "필리핀",
    JPN: "일본",
    CHN: "중국",
    TPE: "대만",
    AUS: "호주",
    CAN: "캐나다",
    NGR: "나이지리아",
  };
  return map[c.toUpperCase()] ?? c;
}
