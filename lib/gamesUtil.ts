import gamesJson from "../data/games.json";

export type RawGame = {
  /** KBL 게임 식별자 (예: "S47G01N184") — 박스스코어 fetch 용. 옛 데이터엔 없을 수 있음 */
  gmkey?: string;
  date: string;          // "2026-05-05"
  time: string;          // "19:00"
  tag: string;           // "정규리그" | "6강 PO" | "4강 PO" | "챔피언결정전"
  homeTeam: string;      // "고양 소노 스카이거너스"
  homeShort: string;     // "소노"
  awayTeam: string;
  awayShort: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "scheduled" | "live" | "final";
  /** 경기장 (옛 데이터엔 없을 수 있음) */
  stadium?: string;
};

export const ALL_GAMES: RawGame[] =
  ((gamesJson as { games?: RawGame[] }).games ?? []).slice();

export const GAMES_FETCHED_AT: string | null =
  (gamesJson as { fetchedAt?: string }).fetchedAt ?? null;

/** 정식 KBL 10팀 (EASL/올스타 팀 제외용) */
export const KBL_TEAMS = [
  "LG", "정관장", "DB", "SK", "소노",
  "KCC", "KT", "현대모비스", "가스공사", "삼성",
] as const;

const KBL_TEAM_SET: Set<string> = new Set(KBL_TEAMS);

export function isKblTeam(short: string): boolean {
  return KBL_TEAM_SET.has(short);
}

/** KBL 팀이 등장한 경기인지 (양 팀 모두 KBL이면 정규/PO, 한쪽만이면 EASL 같은 클럽전) */
export function isAllKblGame(g: RawGame): boolean {
  return isKblTeam(g.homeShort) && isKblTeam(g.awayShort);
}

/**
 * URL-safe game id 생성 — 같은 날 같은 팀끼리 두 번 이상 만나는 케이스를 위해 time 도 포함.
 * 형태: "YYYYMMDD-HHMM-HOMESHORT-AWAYSHORT"
 */
export function gameToId(g: RawGame): string {
  const d = g.date.replace(/-/g, "");
  const t = (g.time || "0000").replace(":", "");
  return `${d}-${t}-${encodeURIComponent(g.homeShort)}-${encodeURIComponent(g.awayShort)}`;
}

export function findGameById(id: string): RawGame | null {
  const decoded = decodeURIComponent(id);
  // URL 인코딩이 풀린 형태로 비교
  const m = decoded.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})-(.+?)-(.+)$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, home, away] = m;
  const date = `${y}-${mo}-${d}`;
  const time = `${h}:${mi}`;
  return (
    ALL_GAMES.find(
      (g) =>
        g.date === date &&
        g.time === time &&
        g.homeShort === home &&
        g.awayShort === away,
    ) ?? null
  );
}

/** YYYY-MM-DD 비교 */
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const TODAY_KEY = dateKey(new Date());

/** 오늘 경기 (예정/진행중/종료 모두) */
export function gamesToday(): RawGame[] {
  return ALL_GAMES.filter((g) => g.date === TODAY_KEY);
}

/** 다음 N일 안에 예정된 경기 (오늘 제외) */
export function gamesUpcoming(days = 7): RawGame[] {
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(today.getDate() + days);
  const cutoffKey = dateKey(cutoff);
  return ALL_GAMES.filter(
    (g) =>
      g.date > TODAY_KEY &&
      g.date <= cutoffKey &&
      g.status !== "final",
  ).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

/** 최근 N개의 종료된 경기 (오늘 종료 포함, 최신순) */
export function gamesRecent(n = 8): RawGame[] {
  return ALL_GAMES.filter((g) => g.status === "final" && g.date <= TODAY_KEY)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
    .slice(0, n);
}

/** 팀 short 이름이 등장하는 모든 경기 (날짜순) */
export function gamesByTeam(short: string): RawGame[] {
  return ALL_GAMES.filter(
    (g) => g.homeShort === short || g.awayShort === short,
  ).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

/**
 * 팀의 최근 N경기 폼 — W/L 배열 (최신순)
 *  - beforeDate / beforeTime 가 주어지면 해당 시점 이전(<) 경기만 집계
 */
export function teamRecentForm(
  short: string,
  n = 5,
  beforeDate?: string,
  beforeTime?: string,
): ("W" | "L")[] {
  const cutoff = beforeDate ? beforeDate + (beforeTime ?? "99:99") : null;
  const recent = ALL_GAMES.filter(
    (g) =>
      g.status === "final" &&
      (g.homeShort === short || g.awayShort === short) &&
      (!cutoff || g.date + g.time < cutoff),
  )
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
    .slice(0, n);
  return recent.map((g) => {
    const isHome = g.homeShort === short;
    const my = isHome ? g.homeScore : g.awayScore;
    const opp = isHome ? g.awayScore : g.homeScore;
    if (my == null || opp == null) return "L";
    return my > opp ? "W" : "L";
  });
}

/**
 * 두 팀의 head-to-head (정규시즌 + PO 모두 종료된 경기만)
 *  - beforeDate / beforeTime 가 주어지면 해당 시점 이전(<) 경기만 집계
 */
export function headToHead(
  a: string,
  b: string,
  beforeDate?: string,
  beforeTime?: string,
): {
  aWins: number;
  bWins: number;
  games: RawGame[];
} {
  const cutoff = beforeDate ? beforeDate + (beforeTime ?? "99:99") : null;
  const games = ALL_GAMES.filter(
    (g) =>
      g.status === "final" &&
      ((g.homeShort === a && g.awayShort === b) ||
        (g.homeShort === b && g.awayShort === a)) &&
      (!cutoff || g.date + g.time < cutoff),
  ).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  let aWins = 0;
  let bWins = 0;
  for (const g of games) {
    const homeWon =
      g.homeScore != null && g.awayScore != null && g.homeScore > g.awayScore;
    const winner = homeWon ? g.homeShort : g.awayShort;
    if (winner === a) aWins++;
    else bWins++;
  }
  return { aWins, bWins, games };
}

/** 모든 게임에서 사용된 태그 집합 */
export function allTags(): string[] {
  const set = new Set<string>();
  for (const g of ALL_GAMES) set.add(g.tag);
  return [...set];
}

/**
 * 특정 시점 이전(<)까지의 정규시즌 W-L 기록.
 * 정규리그 태그만 카운트 (PO/EASL/올스타 제외).
 */
export function regularSeasonRecordBefore(
  short: string,
  beforeDate: string,
  beforeTime?: string,
): { wins: number; losses: number; games: number; winPct: number } {
  const cutoff = beforeDate + (beforeTime ?? "99:99");
  let wins = 0;
  let losses = 0;
  for (const g of ALL_GAMES) {
    if (g.tag !== "정규리그") continue;
    if (g.status !== "final") continue;
    if (g.homeShort !== short && g.awayShort !== short) continue;
    if (g.date + g.time >= cutoff) continue;
    const isHome = g.homeShort === short;
    const my = isHome ? g.homeScore : g.awayScore;
    const opp = isHome ? g.awayScore : g.homeScore;
    if (my == null || opp == null) continue;
    if (my > opp) wins++;
    else losses++;
  }
  const games = wins + losses;
  return { wins, losses, games, winPct: games > 0 ? wins / games : 0 };
}

/**
 * 특정 시점 이전(<)까지의 팀 점수 통계 — PPG / 실점 / 마진.
 *  - regularOnly: true 면 정규리그만, false 면 PO 포함 (팀이 출장한 모든 final 경기)
 *  - lastN: 마지막 N경기로 한정 (recent form 평균용). 0 또는 미지정이면 전체.
 */
export function teamScoringBefore(
  short: string,
  beforeDate: string,
  beforeTime?: string,
  opts?: { regularOnly?: boolean; lastN?: number },
): {
  games: number;
  ppg: number;
  oppPpg: number;
  margin: number;
} {
  const cutoff = beforeDate + (beforeTime ?? "99:99");
  let games = ALL_GAMES.filter((g) => {
    if (g.status !== "final") return false;
    if (g.homeShort !== short && g.awayShort !== short) return false;
    if (g.date + g.time >= cutoff) return false;
    if (opts?.regularOnly && g.tag !== "정규리그") return false;
    return true;
  });
  // 최신순 정렬 후 lastN 만 슬라이스
  if (opts?.lastN && opts.lastN > 0) {
    games = games
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
      .slice(0, opts.lastN);
  }
  let pf = 0;
  let pa = 0;
  for (const g of games) {
    const isHome = g.homeShort === short;
    const my = isHome ? g.homeScore : g.awayScore;
    const opp = isHome ? g.awayScore : g.homeScore;
    if (my == null || opp == null) continue;
    pf += my;
    pa += opp;
  }
  const n = games.length;
  return {
    games: n,
    ppg: n > 0 ? pf / n : 0,
    oppPpg: n > 0 ? pa / n : 0,
    margin: n > 0 ? (pf - pa) / n : 0,
  };
}

/**
 * 특정 시점 기준 KBL 10팀 순위 (정규시즌 W-L).
 * 모든 팀의 기록이 0-0 이면(시즌 개막 전) 모두 rank=null.
 */
/** 정규리그 H2H 만 카운트 (PO 제외). KBL 공식 타이브레이커 룰.
 *  aMargin = a 입장에서 두 팀끼리 게임 점수 합 - 실점 합 (골득실).
 */
function h2hRegularBefore(
  a: string,
  b: string,
  beforeDate: string,
  beforeTime?: string,
): { aWins: number; bWins: number; aMargin: number } {
  const cutoff = beforeDate + (beforeTime ?? "99:99");
  let aWins = 0;
  let bWins = 0;
  let aMargin = 0;
  for (const g of ALL_GAMES) {
    if (g.tag !== "정규리그") continue;
    if (g.status !== "final") continue;
    if (g.date + g.time >= cutoff) continue;
    const ab = g.homeShort === a && g.awayShort === b;
    const ba = g.homeShort === b && g.awayShort === a;
    if (!ab && !ba) continue;
    if (g.homeScore == null || g.awayScore == null) continue;

    // a 입장에서 점수 - 실점 누적
    const aScore = ab ? g.homeScore : g.awayScore;
    const bScore = ab ? g.awayScore : g.homeScore;
    aMargin += aScore - bScore;

    if (g.homeScore === g.awayScore) continue;
    const homeWon = g.homeScore > g.awayScore;
    if (ab) homeWon ? aWins++ : bWins++;
    else homeWon ? bWins++ : aWins++;
  }
  return { aWins, bWins, aMargin };
}

export function standingsAsOf(
  beforeDate: string,
  beforeTime?: string,
): { team: string; wins: number; losses: number; winPct: number; rank: number | null }[] {
  const records = KBL_TEAMS.map((t) => {
    const r = regularSeasonRecordBefore(t, beforeDate, beforeTime);
    return { team: t, ...r };
  });
  const totalGames = records.reduce((n, r) => n + r.games, 0);
  if (totalGames === 0) {
    // 시즌 개막 전 — 순위 없음
    return records.map((r) => ({ ...r, rank: null }));
  }
  // 정렬 타이브레이커 — KBL 공식 룰:
  //  1) 승률 desc
  //  2) 승수 desc
  //  3) 상대 전적 (정규리그 한정) — 승수
  //  4) 상대 전적 골득실 — 두 팀끼리 게임의 점수차 합
  //  5) 알파벳 (최후 fallback)
  const sorted = [...records].sort((a, b) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    if (b.wins !== a.wins) return b.wins - a.wins;
    const h2h = h2hRegularBefore(a.team, b.team, beforeDate, beforeTime);
    if (h2h.aWins !== h2h.bWins) return h2h.bWins - h2h.aWins;
    if (h2h.aMargin !== 0) return -h2h.aMargin; // a 입장 마진 +이면 a가 위
    return a.team.localeCompare(b.team);
  });
  return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
}

/** 시즌에 경기가 있는 월 집합 (YYYY-MM, 정렬) */
export function seasonMonths(): string[] {
  const set = new Set<string>();
  for (const g of ALL_GAMES) set.add(g.date.slice(0, 7));
  return [...set].sort();
}

/** 특정 월(YYYY-MM)의 첫 경기 날짜 */
export function firstGameDateInMonth(ym: string): string | null {
  const dates = ALL_GAMES.filter((g) => g.date.startsWith(ym)).map((g) => g.date);
  if (dates.length === 0) return null;
  return dates.sort()[0];
}

/** 모든 게임에서 사용된 팀 short 이름 집합 */
export function allTeamShorts(opts?: { kblOnly?: boolean }): string[] {
  const set = new Set<string>();
  for (const g of ALL_GAMES) {
    set.add(g.homeShort);
    set.add(g.awayShort);
  }
  let arr = [...set];
  if (opts?.kblOnly) arr = arr.filter(isKblTeam);
  // KBL 팀은 STANDINGS 순서 유지, 그 외는 가나다순
  if (opts?.kblOnly) {
    arr.sort((a, b) => KBL_TEAMS.indexOf(a as typeof KBL_TEAMS[number]) - KBL_TEAMS.indexOf(b as typeof KBL_TEAMS[number]));
  } else {
    arr.sort();
  }
  return arr;
}

/** 같은 날짜의 게임들을 그룹핑 (날짜 → games[]) */
export function groupByDate(games: RawGame[]): Map<string, RawGame[]> {
  const map = new Map<string, RawGame[]>();
  for (const g of games) {
    if (!map.has(g.date)) map.set(g.date, []);
    map.get(g.date)!.push(g);
  }
  // 시간순 정렬
  for (const [, arr] of map) {
    arr.sort((a, b) => a.time.localeCompare(b.time));
  }
  return map;
}

/** 날짜 표시: "5월 5일 (화)" */
export function fmtDate(d: string): string {
  const dt = new Date(d + "T00:00:00");
  const m = dt.getMonth() + 1;
  const day = dt.getDate();
  const dow = ["일", "월", "화", "수", "목", "금", "토"][dt.getDay()];
  return `${m}월 ${day}일 (${dow})`;
}

/** 카운트다운 텍스트 */
export function countdownTo(d: string, t: string): string {
  const target = new Date(`${d}T${t || "19:00"}:00`);
  const now = new Date();
  const ms = target.getTime() - now.getTime();
  if (ms < 0) return "지남";
  const h = Math.floor(ms / 3600000);
  const days = Math.floor(h / 24);
  if (days >= 1) return `D-${days}`;
  if (h >= 1) return `${h}시간 후`;
  const m = Math.floor(ms / 60000);
  return `${m}분 후`;
}
