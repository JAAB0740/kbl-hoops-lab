import type {
  GameEvent,
  PlayerLeader,
  TeamCompareRow,
  TeamStanding,
} from "./types";
import playersJson from "../data/players.json";
import playersDetailJson from "../data/players-detail.json";
import gamesJson from "../data/games.json";
import teamFilteredJson from "../data/team-filtered.json";
import teamAdvancedJson from "../data/team-advanced.json";
import playersAdvancedJson from "../data/players-advanced.json";
import type { PlayerAdvancedStats, TeamAdvancedStats } from "./types";

/**
 * 팀 순위 (STANDINGS) — data/team-filtered.json 의 filters.all 에서 derive.
 *
 * team-filtered.json 은 npm run fetch:kbl-api 로 매일 자동 갱신.
 * 옛날에 있었던 standings.json (HTML 파싱 → 4/28 stale) 의존을 제거함.
 */

// shortName 한국어 → TeamCode (TeamStanding.code) 매핑
const SHORT_TO_TEAMCODE: Record<string, TeamStanding["code"]> = {
  LG: "LG",
  정관장: "KGC",
  DB: "DB",
  SK: "SK",
  소노: "SONO",
  KCC: "KCC",
  KT: "KT",
  현대모비스: "HDMOBIS",
  가스공사: "KOGAS",
  삼성: "SAMSUNG",
};

// 순위에 따른 PO status 분류 (10팀 기준)
function rankToStatus(rank: number, total: number): TeamStanding["status"] {
  if (rank === 1) return "regular-champ";
  if (rank === 2) return "bye";
  if (rank >= 3 && rank <= 6) return "po";
  if (rank === total) return "bottom";
  return "out";
}

function statusToNote(s: TeamStanding["status"]): string {
  switch (s) {
    case "regular-champ": return "정규리그 우승";
    case "bye":           return "4강 직행";
    case "po":            return "6강 PO";
    case "bottom":        return "";
    case "out":           return "";
  }
}

function statusToAccent(s: TeamStanding["status"]): string {
  switch (s) {
    case "regular-champ": return "text-flame-500";
    case "bye":           return "text-flame-400";
    case "po":            return "text-hoop-400";
    case "bottom":        return "text-buzzer-500";
    case "out":           return "text-ink-300";
  }
}

// team-filtered.json 의 filters.all 에서 STANDINGS 빌드
type FilteredAllRow = {
  rank: number;
  code: string;        // numeric "50", "60" 등
  name: string;
  shortName: string;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  stats: { points?: number; margin?: number };
};
const filteredAll =
  (teamFilteredJson as { filters?: { all?: FilteredAllRow[] } }).filters?.all ?? [];

const totalTeams = filteredAll.length || 10;
const leaderRow = filteredAll[0];
const leaderWins = leaderRow?.wins ?? 0;
const leaderLosses = leaderRow?.losses ?? 0;

function computeGb(wins: number, losses: number): string {
  if (!leaderRow) return "-";
  const gb = ((leaderWins - wins) - (leaderLosses - losses)) / 2;
  if (gb <= 0) return "-";
  return gb.toFixed(1);
}

export const STANDINGS: TeamStanding[] = filteredAll.map((t) => {
  const status = rankToStatus(t.rank, totalTeams);
  const ppg = t.stats?.points ?? 0;
  const margin = t.stats?.margin ?? 0;
  // oppPpg = ppg - margin (KBL margin = 득점 - 실점)
  const oppPpg = Math.max(0, ppg - margin);
  return {
    rank: t.rank,
    code: SHORT_TO_TEAMCODE[t.shortName] ?? "LG",
    name: t.name,
    shortName: t.shortName,
    wins: t.wins,
    losses: t.losses,
    winPct: t.winPct,
    gb: computeGb(t.wins, t.losses),
    games: t.games ?? t.wins + t.losses,
    streak: "-",   // KBL API 미제공 — 필요시 games.json 으로 계산
    last10: "-",   // KBL API 미제공
    ppg,
    oppPpg,
    status,
    note: statusToNote(status),
    accent: statusToAccent(status),
  };
});

export const STANDINGS_META = {
  fetchedAt: (teamFilteredJson as { fetchedAt?: string }).fetchedAt ?? null,
  source: "api-stats.kbl.or.kr (team-filtered.json)",
};

// ─── 선수 득점 리더 ────────────────────────────────────
// data/players.json 이 비어 있으면 아래 목업으로 폴백.
// npm run parse:players 실행하면 실데이터로 교체됩니다.

export type RawPlayer = {
  rank: number;
  name: string;
  team: string;
  /** KBL 공식 선수 식별자 (있으면 프로필 페이지 라우팅 가능) */
  playerNo?: string;
  /** 출장 경기 수 (시즌 평균이면 시즌 G, 라운드라면 라운드 G) */
  games?: number;
  /** 2차 스탯 (있는 split만) */
  advanced?: PlayerAdvancedStats;
  stats: {
    minutes: number;
    points: number;
    assists: number;
    rebounds: number;
    oReb: number;
    dReb: number;
    steals: number;
    blocks: number;
    fgMade: number;
    fgAtt: number;
    fgPct: number;
    threeMade: number;
    threePA: number;
    threePct: number;
    twoPM: number;
    twoPA: number;
    twoPct: number;
    ftMade: number;
    ftAtt: number;
    ftPct: number;
    turnovers: number;
    fouls: number;
  };
};

// 우선순위: players-detail.json (KBL 공식 API, playerNo 포함) > players.json (HTML 파싱)
type DetailRow = {
  rank: number;
  playerNo: string;
  kname: string;
  teamName4: string;
  games: number;
  minutes: number;  // playSec (초 단위)
  points: number;
  assists: number;
  rebounds: number;
  oReb: number;
  dReb: number;
  steals: number;
  blocks: number;
  fgMade: number; fgAtt: number; fgPct: number;
  threeMade: number; threeAtt: number; threePct: number;
  twoMade: number; twoAtt: number; twoPct: number;
  ftMade: number; ftAtt: number; ftPct: number;
  turnovers: number;
  fouls: number;
};

// KBL API teamName4 (영문/혼합) → 한국어 약어 (TEAM_COLORS 키와 통일)
const TEAM_NAME4_TO_SHORT: Record<string, string> = {
  LG: "LG",
  DB: "DB",
  SK: "SK",
  KCC: "KCC",
  KT: "KT",
  // 한국어로 들어오는 케이스도 그대로 통과
  정관장: "정관장",
  소노: "소노",
  현대모비스: "현대모비스",
  가스공사: "가스공사",
  삼성: "삼성",
  // 영문으로 들어오는 케이스
  "JUNG KWAN JANG": "정관장",
  JUNGKWANJANG: "정관장",
  KGC: "정관장",
  SONO: "소노",
  "HYUNDAI MOBIS": "현대모비스",
  HYUNDAIMOBIS: "현대모비스",
  HD: "현대모비스",
  KOGAS: "가스공사",
  PEGA: "가스공사",
  KG: "가스공사",
  SAMSUNG: "삼성",
  SS: "삼성",
};

function normalizeTeamShort(raw: string): string {
  if (!raw) return raw;
  const trimmed = raw.trim();
  return TEAM_NAME4_TO_SHORT[trimmed] ?? trimmed;
}

function detailRowToRaw(p: DetailRow): RawPlayer {
  return {
    rank: p.rank,
    name: p.kname,
    team: normalizeTeamShort(p.teamName4),
    playerNo: String(p.playerNo),
    games: p.games,
    stats: {
      minutes:   (p.minutes ?? 0) / 60, // 초 → 분
      points:    p.points ?? 0,
      assists:   p.assists ?? 0,
      rebounds:  p.rebounds ?? 0,
      oReb:      p.oReb ?? 0,
      dReb:      p.dReb ?? 0,
      steals:    p.steals ?? 0,
      blocks:    p.blocks ?? 0,
      fgMade:    p.fgMade ?? 0,
      fgAtt:     p.fgAtt ?? 0,
      fgPct:     p.fgPct ?? 0,
      threeMade: p.threeMade ?? 0,
      threePA:   p.threeAtt ?? 0,
      threePct:  p.threePct ?? 0,
      twoPM:     p.twoMade ?? 0,
      twoPA:     p.twoAtt ?? 0,
      twoPct:    p.twoPct ?? 0,
      ftMade:    p.ftMade ?? 0,
      ftAtt:     p.ftAtt ?? 0,
      ftPct:     p.ftPct ?? 0,
      turnovers: p.turnovers ?? 0,
      fouls:     p.fouls ?? 0,
    },
  };
}

const detailSplits = (playersDetailJson as {
  splits?: {
    regularSeason?: DetailRow[];
    playoff?: DetailRow[];
    round?: Record<string, DetailRow[]>;
  };
}).splits;

// Advanced (선수) — playerNo로 매칭해서 RawPlayer.advanced에 병합
type PlayerAdvRow = {
  playerNo: string;
  advanced: PlayerAdvancedStats;
};
const playersAdvSplits = (
  playersAdvancedJson as {
    splits?: {
      regularSeason?: PlayerAdvRow[];
      playoff?: PlayerAdvRow[];
      championship?: PlayerAdvRow[];
      round?: Record<string, PlayerAdvRow[]>;
    };
  }
).splits;

function buildAdvMap(arr?: PlayerAdvRow[]): Map<string, PlayerAdvancedStats> {
  const map = new Map<string, PlayerAdvancedStats>();
  for (const r of arr ?? []) {
    if (r?.playerNo && r.advanced) map.set(String(r.playerNo), r.advanced);
  }
  return map;
}

function detailToRawWithAdv(
  rows: DetailRow[] | undefined,
  advMap: Map<string, PlayerAdvancedStats>,
): RawPlayer[] {
  return (rows ?? [])
    .filter((p) => p?.kname)
    .map((p) => {
      const base = detailRowToRaw(p);
      const adv = advMap.get(String(p.playerNo));
      return adv ? { ...base, advanced: adv } : base;
    });
}

const seasonAdvMap = buildAdvMap(playersAdvSplits?.regularSeason);
const rawPlayersFromDetail: RawPlayer[] = detailToRawWithAdv(
  detailSplits?.regularSeason,
  seasonAdvMap,
);

/** 라운드별 RawPlayer (PlayersExplorer 라운드 토글에서 사용) */
export const PLAYERS_BY_ROUND: Record<string, RawPlayer[]> = {
  r1: detailToRawWithAdv(detailSplits?.round?.r1, buildAdvMap(playersAdvSplits?.round?.r1)),
  r2: detailToRawWithAdv(detailSplits?.round?.r2, buildAdvMap(playersAdvSplits?.round?.r2)),
  r3: detailToRawWithAdv(detailSplits?.round?.r3, buildAdvMap(playersAdvSplits?.round?.r3)),
  r4: detailToRawWithAdv(detailSplits?.round?.r4, buildAdvMap(playersAdvSplits?.round?.r4)),
  r5: detailToRawWithAdv(detailSplits?.round?.r5, buildAdvMap(playersAdvSplits?.round?.r5)),
  r6: detailToRawWithAdv(detailSplits?.round?.r6, buildAdvMap(playersAdvSplits?.round?.r6)),
};

/** PO 선수 평균 (RawPlayer 형식) */
export const PLAYERS_PLAYOFF: RawPlayer[] = detailToRawWithAdv(
  detailSplits?.playoff,
  buildAdvMap(playersAdvSplits?.playoff),
);

// 홈/원정/쿼터/전후반 전용 — detail.splits에 추가된 새 키
type DetailSplitsExtended = {
  home?: DetailRow[]; away?: DetailRow[];
  q1?: DetailRow[]; q2?: DetailRow[]; q3?: DetailRow[]; q4?: DetailRow[];
  h1?: DetailRow[]; h2?: DetailRow[];
};
type AdvSplitsExtended = {
  home?: PlayerAdvRow[]; away?: PlayerAdvRow[];
  q1?: PlayerAdvRow[]; q2?: PlayerAdvRow[]; q3?: PlayerAdvRow[]; q4?: PlayerAdvRow[];
  h1?: PlayerAdvRow[]; h2?: PlayerAdvRow[];
};
const detailExt = (detailSplits ?? {}) as DetailSplitsExtended;
const advExt = (playersAdvSplits ?? {}) as AdvSplitsExtended;

/**
 * 선수 split 키별 RawPlayer (PlayersExplorer 의 venue/quarter/half 토글에서 사용)
 * 키: home, away, q1~q4, h1, h2
 */
export const PLAYERS_BY_KEY: Record<string, RawPlayer[]> = {
  home: detailToRawWithAdv(detailExt.home, buildAdvMap(advExt.home)),
  away: detailToRawWithAdv(detailExt.away, buildAdvMap(advExt.away)),
  q1:   detailToRawWithAdv(detailExt.q1,   buildAdvMap(advExt.q1)),
  q2:   detailToRawWithAdv(detailExt.q2,   buildAdvMap(advExt.q2)),
  q3:   detailToRawWithAdv(detailExt.q3,   buildAdvMap(advExt.q3)),
  q4:   detailToRawWithAdv(detailExt.q4,   buildAdvMap(advExt.q4)),
  h1:   detailToRawWithAdv(detailExt.h1,   buildAdvMap(advExt.h1)),
  h2:   detailToRawWithAdv(detailExt.h2,   buildAdvMap(advExt.h2)),
};

/**
 * 두 RawPlayer[] 리스트를 games 가중평균으로 합치기 (선수별).
 * 정규+PO 같이 보기 등에 사용.
 */
export function combinePlayerLists(...lists: RawPlayer[][]): RawPlayer[] {
  const byKey = new Map<string, RawPlayer[]>();
  for (const list of lists) {
    for (const p of list) {
      if (!p.games || p.games <= 0) continue;
      const key = p.playerNo ?? `${p.name}__${p.team}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(p);
    }
  }

  const out: RawPlayer[] = [];
  for (const [, rows] of byKey) {
    if (rows.length === 0) continue;
    const head = rows[0];
    const totalG = rows.reduce((n, r) => n + (r.games ?? 0), 0);
    if (totalG === 0) continue;

    const wAvg = (key: keyof RawPlayer["stats"]) =>
      rows.reduce((n, r) => n + (r.stats[key] ?? 0) * (r.games ?? 0), 0) / totalG;
    const wRatio = (
      mKey: keyof RawPlayer["stats"],
      aKey: keyof RawPlayer["stats"],
    ) => {
      const m = rows.reduce(
        (n, r) => n + (r.stats[mKey] ?? 0) * (r.games ?? 0),
        0,
      );
      const a = rows.reduce(
        (n, r) => n + (r.stats[aKey] ?? 0) * (r.games ?? 0),
        0,
      );
      return a > 0 ? (m / a) * 100 : 0;
    };

    let advanced: PlayerAdvancedStats | undefined;
    if (rows.every((r) => r.advanced != null)) {
      const wAdv = (k: keyof PlayerAdvancedStats) =>
        rows.reduce((n, r) => n + (r.advanced![k] ?? 0) * (r.games ?? 0), 0) / totalG;
      advanced = {
        per: wAdv("per"),
        offRtg: wAdv("offRtg"),
        defRtg: wAdv("defRtg"),
        netRtg: wAdv("netRtg"),
        efgPct: wAdv("efgPct"),
        tsPct: wAdv("tsPct"),
        astPct: wAdv("astPct"),
        astTo: wAdv("astTo"),
        astRatio: wAdv("astRatio"),
        orebPct: wAdv("orebPct"),
        drebPct: wAdv("drebPct"),
        rebPct: wAdv("rebPct"),
        usgPct: wAdv("usgPct"),
        pace: wAdv("pace"),
        tovPct: wAdv("tovPct"),
        toRatio: wAdv("toRatio"),
        pie: wAdv("pie"),
        poss: rows.reduce((n, r) => n + (r.advanced!.poss ?? 0), 0),
      };
    }

    out.push({
      rank: 0,
      name: head.name,
      team: head.team,
      playerNo: head.playerNo,
      games: totalG,
      advanced,
      stats: {
        minutes: wAvg("minutes"),
        points: wAvg("points"),
        assists: wAvg("assists"),
        rebounds: wAvg("rebounds"),
        oReb: wAvg("oReb"),
        dReb: wAvg("dReb"),
        steals: wAvg("steals"),
        blocks: wAvg("blocks"),
        fgMade: wAvg("fgMade"),
        fgAtt: wAvg("fgAtt"),
        fgPct: wRatio("fgMade", "fgAtt"),
        threeMade: wAvg("threeMade"),
        threePA: wAvg("threePA"),
        threePct: wRatio("threeMade", "threePA"),
        twoPM: wAvg("twoPM"),
        twoPA: wAvg("twoPA"),
        twoPct: wRatio("twoPM", "twoPA"),
        ftMade: wAvg("ftMade"),
        ftAtt: wAvg("ftAtt"),
        ftPct: wRatio("ftMade", "ftAtt"),
        turnovers: wAvg("turnovers"),
        fouls: wAvg("fouls"),
      },
    });
  }
  out.sort((a, b) => b.stats.points - a.stats.points);
  out.forEach((p, i) => (p.rank = i + 1));
  return out;
}

const rawPlayersFromHtml = (playersJson as { players: RawPlayer[] }).players ?? [];

// detail이 있으면 그걸 우선 사용
const rawPlayers: RawPlayer[] =
  rawPlayersFromDetail.length > 0 ? rawPlayersFromDetail : rawPlayersFromHtml;

/**
 * 선수별 라운드 다중 선택 가중평균 — RawPlayer[] 반환.
 * rounds 비어있으면 기본 ALL_PLAYERS 그대로 반환은 호출 측 책임.
 */
export function aggregatePlayersForRoundSet(
  perRound: Record<string, RawPlayer[]>,
  rounds: number[],
): RawPlayer[] {
  if (!rounds || rounds.length === 0) return [];
  const valid = rounds.filter((n) => n >= 1 && n <= 6);
  if (valid.length === 0) return [];

  // 선수별 row 모으기
  const byPlayer = new Map<string, RawPlayer[]>();
  for (const r of valid) {
    const list = perRound[`r${r}`] ?? [];
    for (const p of list) {
      if (!p.games || p.games <= 0) continue;
      const key = p.playerNo ?? `${p.name}__${p.team}`;
      if (!byPlayer.has(key)) byPlayer.set(key, []);
      byPlayer.get(key)!.push(p);
    }
  }

  const out: RawPlayer[] = [];
  for (const [, rows] of byPlayer) {
    if (rows.length === 0) continue;
    const head = rows[0];
    const totalG = rows.reduce((n, r) => n + (r.games ?? 0), 0);
    if (totalG === 0) continue;

    const wAvg = (key: keyof RawPlayer["stats"]) =>
      rows.reduce((n, r) => n + (r.stats[key] ?? 0) * (r.games ?? 0), 0) / totalG;

    const wRatio = (
      mKey: keyof RawPlayer["stats"],
      aKey: keyof RawPlayer["stats"],
    ) => {
      const m = rows.reduce(
        (n, r) => n + (r.stats[mKey] ?? 0) * (r.games ?? 0),
        0,
      );
      const a = rows.reduce(
        (n, r) => n + (r.stats[aKey] ?? 0) * (r.games ?? 0),
        0,
      );
      return a > 0 ? (m / a) * 100 : 0;
    };

    // advanced 가중평균
    let advanced: PlayerAdvancedStats | undefined;
    if (rows.every((r) => r.advanced != null)) {
      const wAdv = (k: keyof PlayerAdvancedStats) =>
        rows.reduce((n, r) => n + (r.advanced![k] ?? 0) * (r.games ?? 0), 0) / totalG;
      advanced = {
        per:      wAdv("per"),
        offRtg:   wAdv("offRtg"),
        defRtg:   wAdv("defRtg"),
        netRtg:   wAdv("netRtg"),
        efgPct:   wAdv("efgPct"),
        tsPct:    wAdv("tsPct"),
        astPct:   wAdv("astPct"),
        astTo:    wAdv("astTo"),
        astRatio: wAdv("astRatio"),
        orebPct:  wAdv("orebPct"),
        drebPct:  wAdv("drebPct"),
        rebPct:   wAdv("rebPct"),
        usgPct:   wAdv("usgPct"),
        pace:     wAdv("pace"),
        tovPct:   wAdv("tovPct"),
        toRatio:  wAdv("toRatio"),
        pie:      wAdv("pie"),
        poss:     rows.reduce((n, r) => n + (r.advanced!.poss ?? 0), 0),
      };
    }

    out.push({
      rank: 0, // 호출 측에서 재부여
      name: head.name,
      team: head.team,
      playerNo: head.playerNo,
      games: totalG,
      advanced,
      stats: {
        minutes:   wAvg("minutes"),
        points:    wAvg("points"),
        assists:   wAvg("assists"),
        rebounds:  wAvg("rebounds"),
        oReb:      wAvg("oReb"),
        dReb:      wAvg("dReb"),
        steals:    wAvg("steals"),
        blocks:    wAvg("blocks"),
        fgMade:    wAvg("fgMade"),
        fgAtt:     wAvg("fgAtt"),
        fgPct:     wRatio("fgMade", "fgAtt"),
        threeMade: wAvg("threeMade"),
        threePA:   wAvg("threePA"),
        threePct:  wRatio("threeMade", "threePA"),
        twoPM:     wAvg("twoPM"),
        twoPA:     wAvg("twoPA"),
        twoPct:    wRatio("twoPM", "twoPA"),
        ftMade:    wAvg("ftMade"),
        ftAtt:     wAvg("ftAtt"),
        ftPct:     wRatio("ftMade", "ftAtt"),
        turnovers: wAvg("turnovers"),
        fouls:     wAvg("fouls"),
      },
    });
  }

  // 득점순으로 rank 부여
  out.sort((a, b) => b.stats.points - a.stats.points);
  out.forEach((p, i) => (p.rank = i + 1));
  return out;
}

const MOCK_SCORING_LEADERS: PlayerLeader[] = [
  { rank: 1, name: "이재도", team: "LG", value: 22.4, unit: "PPG" },
  { rank: 2, name: "허 웅", team: "KCC", value: 21.1, unit: "PPG" },
  { rank: 3, name: "이정현", team: "KGC", value: 19.8, unit: "PPG" },
  { rank: 4, name: "김선형", team: "SK", value: 18.9, unit: "PPG" },
  { rank: 5, name: "변준형", team: "DB", value: 18.2, unit: "PPG" },
];

// 팀 정보가 비어있는 선수는 리더보드에서 제외
const validPlayers = rawPlayers.filter((p) => p.team);

type StatKey = "points" | "assists" | "rebounds" | "steals" | "blocks";

function topByStat(stat: StatKey, unit: string, count = 5): PlayerLeader[] {
  return [...validPlayers]
    .sort((a, b) => b.stats[stat] - a.stats[stat])
    .slice(0, count)
    .map((p, i) => ({
      rank: i + 1,
      name: p.name,
      team: p.team,
      value: p.stats[stat],
      unit,
    }));
}

export const SCORING_LEADERS: PlayerLeader[] =
  validPlayers.length >= 5 ? topByStat("points", "PPG") : MOCK_SCORING_LEADERS;

const MOCK_ASSIST_LEADERS: PlayerLeader[] = [
  { rank: 1, name: "김선형", team: "SK", value: 7.2, unit: "APG" },
  { rank: 2, name: "이선 알바노", team: "DB", value: 6.7, unit: "APG" },
  { rank: 3, name: "이재도", team: "LG", value: 5.8, unit: "APG" },
  { rank: 4, name: "이정현", team: "소노", value: 5.2, unit: "APG" },
  { rank: 5, name: "변준형", team: "DB", value: 5.1, unit: "APG" },
];
export const ASSIST_LEADERS: PlayerLeader[] =
  validPlayers.length >= 5 ? topByStat("assists", "APG") : MOCK_ASSIST_LEADERS;

const MOCK_REBOUND_LEADERS: PlayerLeader[] = [
  { rank: 1, name: "숀 롱", team: "KCC", value: 12.5, unit: "RPG" },
  { rank: 2, name: "네이던 나이트", team: "소노", value: 11.4, unit: "RPG" },
  { rank: 3, name: "자밀 워니", team: "SK", value: 10.9, unit: "RPG" },
  { rank: 4, name: "헨리 엘런슨", team: "DB", value: 9.2, unit: "RPG" },
  { rank: 5, name: "케렘 칸터", team: "삼성", value: 9.1, unit: "RPG" },
];
export const REBOUND_LEADERS: PlayerLeader[] =
  validPlayers.length >= 5 ? topByStat("rebounds", "RPG") : MOCK_REBOUND_LEADERS;

// 추후 사용할 전체 선수 데이터
export const ALL_PLAYERS = rawPlayers;

// ─── 팀 필터링 데이터 (KBL API) ──────────────────────
// data/team-filtered.json 에서 { all, home, away } 로 구조화돼있음

export type FilteredTeam = {
  rank: number;
  code: string;
  name: string;
  shortName: string;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  stats: {
    points: number;
    assists: number;
    rebounds: number;
    oReb: number;
    dReb: number;
    steals: number;
    blocks: number;
    fgMade: number;
    fgAtt: number;
    fgPct: number;
    threeMade: number;
    threeAtt: number;
    threePct: number;
    ftMade: number;
    ftAtt: number;
    ftPct: number;
    turnovers: number;
    fouls?: number;
    margin?: number;
  };
  advanced?: TeamAdvancedStats;
};

export type FilterKey =
  | "all" | "home" | "away"
  | "r1" | "r2" | "r3" | "r4" | "r5" | "r6"
  | "q1" | "q2" | "q3" | "q4"
  | "h1" | "h2"
  | "po"
  | "home_r1" | "home_r2" | "home_r3" | "home_r4" | "home_r5" | "home_r6"
  | "away_r1" | "away_r2" | "away_r3" | "away_r4" | "away_r5" | "away_r6";

type FilteredData = {
  filters: Partial<Record<FilterKey, FilteredTeam[]>>;
};

const filteredRaw = (teamFilteredJson as Partial<FilteredData>).filters ?? {};

// Advanced 데이터 병합: 각 split 별로 teamCode 매칭해서 advanced 필드 채움
type AdvancedTeamRow = {
  rank: number;
  code: string;
  shortName: string;
  advanced: TeamAdvancedStats;
};
const advFilters = (
  teamAdvancedJson as { filters?: Partial<Record<FilterKey, AdvancedTeamRow[]>> }
).filters ?? {};

function mergeAdvanced(
  base: FilteredTeam[],
  adv: AdvancedTeamRow[] | undefined,
): FilteredTeam[] {
  if (!adv || adv.length === 0) return base;
  const byCode = new Map(adv.map((a) => [String(a.code), a.advanced]));
  return base.map((t) => {
    const a = byCode.get(String(t.code));
    return a ? { ...t, advanced: a } : t;
  });
}

export const STANDINGS_FILTERS: Record<FilterKey, FilteredTeam[]> = {
  all:  mergeAdvanced(filteredRaw.all  ?? [], advFilters.all),
  home: mergeAdvanced(filteredRaw.home ?? [], advFilters.home),
  away: mergeAdvanced(filteredRaw.away ?? [], advFilters.away),
  r1:   mergeAdvanced(filteredRaw.r1   ?? [], advFilters.r1),
  r2:   mergeAdvanced(filteredRaw.r2   ?? [], advFilters.r2),
  r3:   mergeAdvanced(filteredRaw.r3   ?? [], advFilters.r3),
  r4:   mergeAdvanced(filteredRaw.r4   ?? [], advFilters.r4),
  r5:   mergeAdvanced(filteredRaw.r5   ?? [], advFilters.r5),
  r6:   mergeAdvanced(filteredRaw.r6   ?? [], advFilters.r6),
  q1:   mergeAdvanced(filteredRaw.q1   ?? [], advFilters.q1),
  q2:   mergeAdvanced(filteredRaw.q2   ?? [], advFilters.q2),
  q3:   mergeAdvanced(filteredRaw.q3   ?? [], advFilters.q3),
  q4:   mergeAdvanced(filteredRaw.q4   ?? [], advFilters.q4),
  h1:   mergeAdvanced(filteredRaw.h1   ?? [], advFilters.h1),
  h2:   mergeAdvanced(filteredRaw.h2   ?? [], advFilters.h2),
  po:   mergeAdvanced(filteredRaw.po   ?? [], advFilters.po),
  // 홈 × 라운드
  home_r1: mergeAdvanced(filteredRaw.home_r1 ?? [], advFilters.home_r1),
  home_r2: mergeAdvanced(filteredRaw.home_r2 ?? [], advFilters.home_r2),
  home_r3: mergeAdvanced(filteredRaw.home_r3 ?? [], advFilters.home_r3),
  home_r4: mergeAdvanced(filteredRaw.home_r4 ?? [], advFilters.home_r4),
  home_r5: mergeAdvanced(filteredRaw.home_r5 ?? [], advFilters.home_r5),
  home_r6: mergeAdvanced(filteredRaw.home_r6 ?? [], advFilters.home_r6),
  // 원정 × 라운드
  away_r1: mergeAdvanced(filteredRaw.away_r1 ?? [], advFilters.away_r1),
  away_r2: mergeAdvanced(filteredRaw.away_r2 ?? [], advFilters.away_r2),
  away_r3: mergeAdvanced(filteredRaw.away_r3 ?? [], advFilters.away_r3),
  away_r4: mergeAdvanced(filteredRaw.away_r4 ?? [], advFilters.away_r4),
  away_r5: mergeAdvanced(filteredRaw.away_r5 ?? [], advFilters.away_r5),
  away_r6: mergeAdvanced(filteredRaw.away_r6 ?? [], advFilters.away_r6),
};

/** venue × round 조합용 데이터 — TeamAnalytics에서 venue+round 동시 적용 시 사용 */
export const VENUE_BY_ROUND: Record<"all" | "home" | "away", Record<string, FilteredTeam[]>> = {
  all: {
    r1: STANDINGS_FILTERS.r1, r2: STANDINGS_FILTERS.r2, r3: STANDINGS_FILTERS.r3,
    r4: STANDINGS_FILTERS.r4, r5: STANDINGS_FILTERS.r5, r6: STANDINGS_FILTERS.r6,
  },
  home: {
    r1: STANDINGS_FILTERS.home_r1, r2: STANDINGS_FILTERS.home_r2, r3: STANDINGS_FILTERS.home_r3,
    r4: STANDINGS_FILTERS.home_r4, r5: STANDINGS_FILTERS.home_r5, r6: STANDINGS_FILTERS.home_r6,
  },
  away: {
    r1: STANDINGS_FILTERS.away_r1, r2: STANDINGS_FILTERS.away_r2, r3: STANDINGS_FILTERS.away_r3,
    r4: STANDINGS_FILTERS.away_r4, r5: STANDINGS_FILTERS.away_r5, r6: STANDINGS_FILTERS.away_r6,
  },
};

/**
 * 정규시즌 + 플레이오프 팀 row를 games 가중평균으로 결합 (스코프='전체' 모드용).
 * 비율은 made/att를 다시 합산해 재계산.
 */
export function combineTeamLists(...lists: FilteredTeam[][]): FilteredTeam[] {
  const byCode = new Map<string, FilteredTeam[]>();
  for (const list of lists) {
    for (const t of list) {
      if (!t.games || t.games <= 0) continue;
      if (!byCode.has(t.code)) byCode.set(t.code, []);
      byCode.get(t.code)!.push(t);
    }
  }
  if (byCode.size === 0) return [];

  const out: FilteredTeam[] = [];
  for (const [, rows] of byCode) {
    const head = rows[0];
    const totalG = rows.reduce((n, r) => n + r.games, 0);
    const totalW = rows.reduce((n, r) => n + r.wins, 0);
    const totalL = rows.reduce((n, r) => n + r.losses, 0);
    const wAvg = (pick: (t: FilteredTeam) => number) =>
      rows.reduce((n, r) => n + pick(r) * r.games, 0) / totalG;
    const wRatio = (
      m: (t: FilteredTeam) => number,
      a: (t: FilteredTeam) => number,
    ) => {
      const ms = rows.reduce((n, r) => n + m(r) * r.games, 0);
      const as = rows.reduce((n, r) => n + a(r) * r.games, 0);
      return as > 0 ? (ms / as) * 100 : 0;
    };

    let advanced: TeamAdvancedStats | undefined;
    if (rows.every((r) => r.advanced != null)) {
      const wAdv = (k: keyof TeamAdvancedStats) =>
        rows.reduce((n, r) => n + (r.advanced![k] ?? 0) * r.games, 0) / totalG;
      advanced = {
        offRtg: wAdv("offRtg"),
        defRtg: wAdv("defRtg"),
        netRtg: wAdv("netRtg"),
        efgPct: wAdv("efgPct"),
        tsPct: wAdv("tsPct"),
        astPct: wAdv("astPct"),
        astTo: wAdv("astTo"),
        astRatio: wAdv("astRatio"),
        orebPct: wAdv("orebPct"),
        drebPct: wAdv("drebPct"),
        rebPct: wAdv("rebPct"),
        tovPct: wAdv("tovPct"),
        pace: wAdv("pace"),
        pie: wAdv("pie"),
        poss: rows.reduce((n, r) => n + (r.advanced!.poss ?? 0), 0),
      };
    }

    out.push({
      rank: 0,
      code: head.code,
      name: head.name,
      shortName: head.shortName,
      games: totalG,
      wins: totalW,
      losses: totalL,
      winPct: totalG > 0 ? totalW / totalG : 0,
      stats: {
        points:    wAvg((t) => t.stats.points),
        assists:   wAvg((t) => t.stats.assists),
        rebounds:  wAvg((t) => t.stats.rebounds),
        oReb:      wAvg((t) => t.stats.oReb),
        dReb:      wAvg((t) => t.stats.dReb),
        steals:    wAvg((t) => t.stats.steals),
        blocks:    wAvg((t) => t.stats.blocks),
        fgMade:    wAvg((t) => t.stats.fgMade),
        fgAtt:     wAvg((t) => t.stats.fgAtt),
        fgPct:     wRatio((t) => t.stats.fgMade, (t) => t.stats.fgAtt),
        threeMade: wAvg((t) => t.stats.threeMade),
        threeAtt:  wAvg((t) => t.stats.threeAtt),
        threePct:  wRatio((t) => t.stats.threeMade, (t) => t.stats.threeAtt),
        ftMade:    wAvg((t) => t.stats.ftMade),
        ftAtt:     wAvg((t) => t.stats.ftAtt),
        ftPct:     wRatio((t) => t.stats.ftMade, (t) => t.stats.ftAtt),
        turnovers: wAvg((t) => t.stats.turnovers),
        fouls:     wAvg((t) => t.stats.fouls ?? 0),
        margin:    wAvg((t) => t.stats.margin ?? 0),
      },
      advanced,
    });
  }
  out.sort((a, b) => b.winPct - a.winPct || b.wins - a.wins);
  out.forEach((t, i) => (t.rank = i + 1));
  return out;
}

export const HAS_FILTERED_STANDINGS =
  STANDINGS_FILTERS.all.length >= 10 &&
  STANDINGS_FILTERS.home.length >= 10 &&
  STANDINGS_FILTERS.away.length >= 10;

/**
 * 라운드 다중 선택 집계 — 선택된 라운드들의 가중평균(games 기준)으로
 * 가짜 FilteredTeam[] 을 만든다. 비율(FG%, 3P%, FT%)은 made/att 가중합산 후 재계산.
 *
 * 빈 Set이면 null 반환 (호출 측에서 'all'로 폴백)
 */
export function aggregateTeamRoundSet(
  filters: Record<FilterKey, FilteredTeam[]>,
  rounds: number[],
): FilteredTeam[] | null {
  if (!rounds || rounds.length === 0) return null;
  const rKeys = rounds
    .filter((n) => n >= 1 && n <= 6)
    .map((n) => `r${n}` as FilterKey);
  if (rKeys.length === 0) return null;

  // 팀 코드별로 라운드 row 모으기
  const byTeam = new Map<string, FilteredTeam[]>();
  for (const k of rKeys) {
    for (const t of filters[k] ?? []) {
      if (!byTeam.has(t.code)) byTeam.set(t.code, []);
      byTeam.get(t.code)!.push(t);
    }
  }
  if (byTeam.size === 0) return null;

  function wAvg(rows: FilteredTeam[], pick: (t: FilteredTeam) => number): number {
    let sum = 0, n = 0;
    for (const t of rows) {
      sum += pick(t) * t.games;
      n += t.games;
    }
    return n > 0 ? sum / n : 0;
  }

  function wRatio(
    rows: FilteredTeam[],
    made: (t: FilteredTeam) => number,
    att: (t: FilteredTeam) => number,
  ): number {
    let m = 0, a = 0;
    for (const t of rows) {
      m += made(t) * t.games;
      a += att(t) * t.games;
    }
    return a > 0 ? (m / a) * 100 : 0;
  }

  const out: FilteredTeam[] = [];
  for (const [, rows] of byTeam) {
    if (rows.length === 0) continue;
    const head = rows[0];
    const totalGames = rows.reduce((n, r) => n + r.games, 0);
    const totalWins = rows.reduce((n, r) => n + r.wins, 0);
    const totalLosses = rows.reduce((n, r) => n + r.losses, 0);

    // advanced 가중평균 (모든 row에 advanced 있으면)
    let advanced: TeamAdvancedStats | undefined;
    const allHaveAdv = rows.every((t) => t.advanced != null);
    if (allHaveAdv) {
      const wAdv = (key: keyof TeamAdvancedStats) =>
        rows.reduce((n, r) => n + (r.advanced![key] ?? 0) * r.games, 0) / totalGames;
      advanced = {
        offRtg:   wAdv("offRtg"),
        defRtg:   wAdv("defRtg"),
        netRtg:   wAdv("netRtg"),
        efgPct:   wAdv("efgPct"),
        tsPct:    wAdv("tsPct"),
        astPct:   wAdv("astPct"),
        astTo:    wAdv("astTo"),
        astRatio: wAdv("astRatio"),
        orebPct:  wAdv("orebPct"),
        drebPct:  wAdv("drebPct"),
        rebPct:   wAdv("rebPct"),
        tovPct:   wAdv("tovPct"),
        pace:     wAdv("pace"),
        pie:      wAdv("pie"),
        poss:     rows.reduce((n, r) => n + (r.advanced!.poss ?? 0), 0),
      };
    }

    out.push({
      rank: 0, // 나중에 winPct로 재정렬해 부여
      code: head.code,
      name: head.name,
      shortName: head.shortName,
      games: totalGames,
      wins: totalWins,
      losses: totalLosses,
      winPct: totalGames > 0 ? totalWins / totalGames : 0,
      stats: {
        points:    wAvg(rows, (t) => t.stats.points),
        assists:   wAvg(rows, (t) => t.stats.assists),
        rebounds:  wAvg(rows, (t) => t.stats.rebounds),
        oReb:      wAvg(rows, (t) => t.stats.oReb),
        dReb:      wAvg(rows, (t) => t.stats.dReb),
        steals:    wAvg(rows, (t) => t.stats.steals),
        blocks:    wAvg(rows, (t) => t.stats.blocks),
        fgMade:    wAvg(rows, (t) => t.stats.fgMade),
        fgAtt:     wAvg(rows, (t) => t.stats.fgAtt),
        fgPct:     wRatio(rows, (t) => t.stats.fgMade, (t) => t.stats.fgAtt),
        threeMade: wAvg(rows, (t) => t.stats.threeMade),
        threeAtt:  wAvg(rows, (t) => t.stats.threeAtt),
        threePct:  wRatio(rows, (t) => t.stats.threeMade, (t) => t.stats.threeAtt),
        ftMade:    wAvg(rows, (t) => t.stats.ftMade),
        ftAtt:     wAvg(rows, (t) => t.stats.ftAtt),
        ftPct:     wRatio(rows, (t) => t.stats.ftMade, (t) => t.stats.ftAtt),
        turnovers: wAvg(rows, (t) => t.stats.turnovers),
        fouls:     wAvg(rows, (t) => t.stats.fouls ?? 0),
        margin:    wAvg(rows, (t) => t.stats.margin ?? 0),
      },
      advanced,
    });
  }

  // winPct → wins → points 순으로 정렬, rank 부여
  out.sort(
    (a, b) =>
      b.winPct - a.winPct || b.wins - a.wins || b.stats.points - a.stats.points,
  );
  out.forEach((t, i) => (t.rank = i + 1));
  return out;
}

export const FILTER_LABELS: Record<FilterKey, string> = {
  all:  "전체",
  home: "홈",
  away: "원정",
  r1:   "1라운드",
  r2:   "2라운드",
  r3:   "3라운드",
  r4:   "4라운드",
  r5:   "5라운드",
  r6:   "6라운드",
  q1:   "1쿼터",
  q2:   "2쿼터",
  q3:   "3쿼터",
  q4:   "4쿼터",
  h1:   "전반",
  h2:   "후반",
  po:   "플레이오프",
  home_r1: "홈 1R", home_r2: "홈 2R", home_r3: "홈 3R",
  home_r4: "홈 4R", home_r5: "홈 5R", home_r6: "홈 6R",
  away_r1: "원정 1R", away_r2: "원정 2R", away_r3: "원정 3R",
  away_r4: "원정 4R", away_r5: "원정 5R", away_r6: "원정 6R",
};

/**
 * KBL 10개 팀 공식 로고 기반 브랜드 컬러
 * - 다크 배경 시인성 확보 위해 빨강 계열 4팀(LG·정관장·SK·현대모비스)은
 *   밝기/채도 차이 + 현대모비스는 로고 공 오렌지 활용해 분산
 * - KT는 원래 검정이지만 다크 테마에서 안 보여서 흰색 사용
 */
export const TEAM_COLORS: Record<string, string> = {
  LG:        "#FACC15", // 노랑 (LG Sakers 독수리 로고)
  정관장:     "#DC2626", // 진한 빨강 (Red Boosters)
  DB:        "#10B981", // 에메랄드 (Promy)
  SK:        "#F87171", // 살몬 레드 (Knights)
  소노:       "#38BDF8", // 하늘색 (Sky Gunners)
  KCC:       "#1E40AF", // 네이비 (Egis)
  KT:        "#F5F5F5", // 흰색 (SonicBoom - 검정 대체)
  현대모비스:  "#9CA3AF", // 회색 (Phoebus)
  가스공사:   "#06B6D4", // 시안 (Pegasus)
  삼성:       "#3B82F6", // 파랑 (Samsung Thunders)
};

/** 팀 축약명 → 브랜드 컬러. 알 수 없는 팀은 회색 반환. */
export function teamColor(shortName: string): string {
  return TEAM_COLORS[shortName] ?? "#94a3b8";
}

// 아래는 아직 목업 데이터 (PO 일정 / 팀 비교 / 뉴스)
// ─────────────────────────────────────────────────────────────

type RawGame = {
  homeTeam: string;
  homeShort: string;
  awayTeam: string;
  awayShort: string;
  date: string | null;
  time: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  tag: string;
};

const rawGames = (gamesJson as { games: RawGame[] }).games ?? [];

const MOCK_TODAY_GAMES: GameEvent[] = [
  {
    id: "g1",
    when: "19:00",
    home: { name: "서울 SK", short: "SK" },
    away: { name: "고양 소노", short: "소노" },
    tag: "6강 PO G2",
    status: "scheduled",
  },
  {
    id: "g2",
    when: "21:30",
    home: { name: "원주 DB", short: "DB" },
    away: { name: "부산 KCC", short: "KCC" },
    tag: "6강 PO G2",
    status: "scheduled",
  },
];

/**
 * 오늘의 경기 — games.json 에서 추출.
 *  1) 오늘 날짜 경기가 있으면 그걸 우선
 *  2) 없으면 가장 가까운 다음 경기일의 모든 경기 (최대 4개)
 *  3) 아예 없으면 목업
 */
function pickTodayGames(games: RawGame[]): GameEvent[] {
  if (games.length === 0) return MOCK_TODAY_GAMES;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = games.filter((g) => g.date && g.date >= today && g.status !== "cancelled");
  if (upcoming.length === 0) return MOCK_TODAY_GAMES;

  // 오늘 경기
  let picked = upcoming.filter((g) => g.date === today);
  // 오늘 없으면 가장 빠른 날짜 경기 전부 (같은 날 경기 여러 개 모아 표시)
  if (picked.length === 0) {
    const nextDate = upcoming[0].date;
    picked = upcoming.filter((g) => g.date === nextDate);
  }

  return picked.slice(0, 4).map((g, i) => ({
    id: `g${i + 1}`,
    when: g.time ?? "시간 미정",
    home: { name: g.homeTeam, short: g.homeShort },
    away: { name: g.awayTeam, short: g.awayShort },
    tag: g.tag || "KBL",
    status: (g.status === "final" ? "final" : g.status === "live" ? "live" : "scheduled") as GameEvent["status"],
  }));
}

export const TODAY_GAMES: GameEvent[] = pickTodayGames(rawGames);

// ─── 팀 평균 스탯 (Daum 기록 순위 파싱) ─────────────────

export type TeamFullStats = {
  points: number;
  oppPoints: number;
  assists: number;
  rebounds: number;
  oReb: number;  // 공격 리바운드
  dReb: number;  // 수비 리바운드
  steals: number;
  blocks: number;
  fgMade: number;
  fgAtt: number;
  threeMade: number;
  threeAtt: number;
  ftMade: number;
  ftAtt: number;
  fgPct: number;
  threePct: number;
  ftPct: number;
  turnovers: number;
};

// TEAM_STATS — team-filtered.json 의 filters.all 에서 derive (자동 갱신 데이터)
type FilteredAllStats = FilteredAllRow & {
  stats: {
    points?: number; assists?: number; rebounds?: number;
    oReb?: number; dReb?: number; steals?: number; blocks?: number;
    fgMade?: number; fgAtt?: number; fgPct?: number;
    threeMade?: number; threeAtt?: number; threePct?: number;
    ftMade?: number; ftAtt?: number; ftPct?: number;
    turnovers?: number; margin?: number;
  };
};
const filteredAllForStats =
  (teamFilteredJson as { filters?: { all?: FilteredAllStats[] } }).filters?.all ?? [];

export const HAS_REAL_TEAM_STATS = filteredAllForStats.length >= 10;

/** 팀 축약명(LG, 정관장 등) 또는 코드로 평균 스탯 조회 */
export const TEAM_STATS: Record<string, TeamFullStats> = {};
for (const t of filteredAllForStats) {
  const s = t.stats ?? {};
  const stats: TeamFullStats = {
    points:    s.points ?? 0,
    oppPoints: Math.max(0, (s.points ?? 0) - (s.margin ?? 0)),
    assists:   s.assists ?? 0,
    rebounds:  s.rebounds ?? 0,
    oReb:      s.oReb ?? 0,
    dReb:      s.dReb ?? 0,
    steals:    s.steals ?? 0,
    blocks:    s.blocks ?? 0,
    fgMade:    s.fgMade ?? 0,
    fgAtt:     s.fgAtt ?? 0,
    threeMade: s.threeMade ?? 0,
    threeAtt:  s.threeAtt ?? 0,
    ftMade:    s.ftMade ?? 0,
    ftAtt:     s.ftAtt ?? 0,
    fgPct:     s.fgPct ?? 0,    // percent scale (0-100), 기존 team-stats.json 와 동일
    threePct:  s.threePct ?? 0,
    ftPct:     s.ftPct ?? 0,
    turnovers: s.turnovers ?? 0,
  };
  TEAM_STATS[t.shortName] = stats;
  // TeamCode 매핑도 키로 추가
  const tc = SHORT_TO_TEAMCODE[t.shortName];
  if (tc) TEAM_STATS[tc] = stats;
}

function fmtPct(v: number) {
  return `.${Math.round(v * 10)}`; // 47.0 → .470
}

// 대시보드 "팀 비교" 카드 — LG vs DB (실데이터 있으면 실데이터, 없으면 목업)
function buildCompareRows(aShort: string, bShort: string): TeamCompareRow[] {
  if (!HAS_REAL_TEAM_STATS) {
    return [
      { label: "경기당 득점 (PPG)", leftValue: "88.9", rightValue: "85.1", leftBetter: true },
      { label: "리바운드 (RPG)",    leftValue: "44.2", rightValue: "41.7", leftBetter: true },
      { label: "어시스트 (APG)",    leftValue: "22.1", rightValue: "19.5", leftBetter: true },
      { label: "야투 성공률 (FG%)", leftValue: ".484", rightValue: ".462", leftBetter: true },
      { label: "3P 성공률",         leftValue: ".372", rightValue: ".389", leftBetter: false },
      { label: "실점 허용 (OPPG)",  leftValue: "80.4", rightValue: "80.9", leftBetter: true },
    ];
  }
  const a = TEAM_STATS[aShort]!;
  const b = TEAM_STATS[bShort]!;
  return [
    { label: "경기당 득점 (PPG)", leftValue: a.points.toFixed(1),    rightValue: b.points.toFixed(1),    leftBetter: a.points    > b.points },
    { label: "리바운드 (RPG)",    leftValue: a.rebounds.toFixed(1),  rightValue: b.rebounds.toFixed(1),  leftBetter: a.rebounds  > b.rebounds },
    { label: "어시스트 (APG)",    leftValue: a.assists.toFixed(1),   rightValue: b.assists.toFixed(1),   leftBetter: a.assists   > b.assists },
    { label: "야투 성공률 (FG%)", leftValue: fmtPct(a.fgPct),        rightValue: fmtPct(b.fgPct),        leftBetter: a.fgPct     > b.fgPct },
    { label: "3P 성공률",         leftValue: fmtPct(a.threePct),     rightValue: fmtPct(b.threePct),     leftBetter: a.threePct  > b.threePct },
    { label: "실점 허용 (OPPG)",  leftValue: a.oppPoints.toFixed(1), rightValue: b.oppPoints.toFixed(1), leftBetter: a.oppPoints < b.oppPoints }, // 낮을수록 좋음
  ];
}

export const COMPARE_ROWS: TeamCompareRow[] = buildCompareRows("LG", "DB");

export const HEADLINES = [
  {
    id: "h1",
    badge: "정규리그",
    title: "창원 LG, 12년 만에 정규리그 우승 확정 — 통합 우승 정조준",
    time: "2시간 전",
  },
  {
    id: "h2",
    badge: "6강 PO",
    title: "SK vs 소노, G1 연장 접전 끝에 SK 승리",
    time: "어제",
  },
  {
    id: "h3",
    badge: "꼴찌 결정전",
    title: "삼성, 가스공사전 패배로 5시즌 연속 최하위",
    time: "2일 전",
  },
];
