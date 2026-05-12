/**
 * 선수 프로필 — data/players-detail.json 로딩 및 한 선수의 모든 split 통합
 */

import type {
  ClutchPlayerStats,
  HustlePlayerStats,
  PlayerAdvancedStats,
  PlayerDetailRow,
  PlayerDetailSplits,
  PlayerProfile,
  ShootingRange,
} from "./types";
import detailJson from "../data/players-detail.json";
import advJson from "../data/players-advanced.json";
import shootingJson from "../data/shooting.json";
import clutchJson from "../data/clutch.json";
import hustleJson from "../data/hustle.json";

// 영문/혼합 teamName4 → 한국어 약어 (TEAM_COLORS 키와 동일하게)
const TEAM_NAME4_TO_SHORT: Record<string, string> = {
  LG: "LG", DB: "DB", SK: "SK", KCC: "KCC", KT: "KT",
  정관장: "정관장", 소노: "소노", 현대모비스: "현대모비스",
  가스공사: "가스공사", 삼성: "삼성",
  "JUNG KWAN JANG": "정관장", JUNGKWANJANG: "정관장", KGC: "정관장",
  SONO: "소노",
  "HYUNDAI MOBIS": "현대모비스", HYUNDAIMOBIS: "현대모비스", HD: "현대모비스",
  KOGAS: "가스공사", PEGA: "가스공사", KG: "가스공사",
  SAMSUNG: "삼성", SS: "삼성",
};
function normShort(raw: string | undefined | null): string {
  if (!raw) return "";
  const t = String(raw).trim();
  return TEAM_NAME4_TO_SHORT[t] ?? t;
}

interface DetailFile {
  fetchedAt: string;
  source: string;
  seasonCode: string;
  splits: PlayerDetailSplits;
}

// detailJson 의 실제 구조와 DetailFile 타입이 약간 다를 수 있어 (legacy 필드 차이) unknown 경유.
const detail = detailJson as unknown as DetailFile;

export const PLAYERS_DETAIL_META = {
  fetchedAt: detail?.fetchedAt ?? null,
  seasonCode: detail?.seasonCode ?? "47",
};

/** 모집단 — Radar/percentile 계산용. 정규시즌 평균 row 들. 시즌 1경기 이상만. */
export const REGULAR_POPULATION: PlayerDetailRow[] =
  (detail?.splits?.regularSeason ?? []).filter((p) => (p.games ?? 0) >= 1);

/** 모집단 — PO 평균 row 들. PO 1경기 이상만. */
export const PLAYOFF_POPULATION: PlayerDetailRow[] =
  (detail?.splits?.playoff ?? []).filter((p) => (p.games ?? 0) >= 1);

/** 모든 선수 (정규 평균 기반) */
export function getAllPlayerSeasons(): PlayerDetailRow[] {
  return detail?.splits?.regularSeason ?? [];
}

// Advanced 매핑 — playerNo로 찾을 수 있는 split별 advanced
type AdvSplits = {
  regularSeason?: { playerNo: string; advanced: PlayerAdvancedStats }[];
  playoff?: { playerNo: string; advanced: PlayerAdvancedStats }[];
  championship?: { playerNo: string; advanced: PlayerAdvancedStats }[];
  round?: Record<string, { playerNo: string; advanced: PlayerAdvancedStats }[]>;
};
const advSplits = (advJson as { splits?: AdvSplits }).splits;

function findAdv(
  arr: { playerNo: string; advanced: PlayerAdvancedStats }[] | undefined,
  playerNo: string,
): PlayerAdvancedStats | undefined {
  return arr?.find((p) => String(p.playerNo) === String(playerNo))?.advanced;
}

/** playerNo → 풀 프로필 */
export function getPlayerProfile(playerNo: string): PlayerProfile | null {
  const splits = detail?.splits;
  if (!splits) return null;

  const findIn = (arr: PlayerDetailRow[] | undefined) =>
    arr?.find((p) => String(p?.playerNo) === String(playerNo)) ?? null;

  const season = findIn(splits.regularSeason);
  // 라운드/PO에는 있는데 정규 평균에 없을 가능성도 (출장 0 시) — 다른 split에서 메타정보 가져옴
  const meta =
    season ??
    findIn(splits.playoff) ??
    findIn(splits.regularTotal) ??
    null;

  if (!meta) return null;

  const rounds: Record<string, PlayerDetailRow | null> = {};
  for (const r of ["r1", "r2", "r3", "r4", "r5", "r6"]) {
    rounds[r] = findIn(splits.round?.[r]);
  }

  // 쿼터/전후반/홈원정 split 매칭
  type ExtendedSplits = {
    q1?: PlayerDetailRow[]; q2?: PlayerDetailRow[];
    q3?: PlayerDetailRow[]; q4?: PlayerDetailRow[];
    h1?: PlayerDetailRow[]; h2?: PlayerDetailRow[];
    home?: PlayerDetailRow[]; away?: PlayerDetailRow[];
  };
  const ext = splits as unknown as ExtendedSplits;
  const quarters: Record<string, PlayerDetailRow | null> = {
    q1: findIn(ext.q1),
    q2: findIn(ext.q2),
    q3: findIn(ext.q3),
    q4: findIn(ext.q4),
  };
  const halves: Record<string, PlayerDetailRow | null> = {
    h1: findIn(ext.h1),
    h2: findIn(ext.h2),
  };
  const venue: Record<string, PlayerDetailRow | null> = {
    home: findIn(ext.home),
    away: findIn(ext.away),
  };

  // advanced split별 매칭
  const advRounds: Record<string, PlayerAdvancedStats | undefined> = {};
  for (const r of ["r1", "r2", "r3", "r4", "r5", "r6"]) {
    advRounds[r] = findAdv(advSplits?.round?.[r], playerNo);
  }
  const advanced = {
    season: findAdv(advSplits?.regularSeason, playerNo),
    playoff: findAdv(advSplits?.playoff, playerNo),
    rounds: advRounds,
  };

  // 영역별 야투 매칭
  type ShootingFile = {
    players?: {
      regular?: { playerNo: string; ranges: ShootingRange[] }[];
      playoff?: { playerNo: string; ranges: ShootingRange[] }[];
    };
  };
  const shootingFile = shootingJson as ShootingFile;
  const findShoot = (
    arr: { playerNo: string; ranges: ShootingRange[] }[] | undefined,
  ): ShootingRange[] | undefined =>
    arr?.find((p) => String(p.playerNo) === String(playerNo))?.ranges;
  const shooting = {
    regular: findShoot(shootingFile.players?.regular),
    playoff: findShoot(shootingFile.players?.playoff),
  };

  // Clutch 매칭
  type ClutchEntry = ClutchPlayerStats & { playerNo: string };
  type ClutchFile = {
    players?: { regular?: ClutchEntry[]; playoff?: ClutchEntry[] };
  };
  const clutchFile = clutchJson as ClutchFile;
  const findClutch = (
    arr: ClutchEntry[] | undefined,
  ): ClutchPlayerStats | undefined => {
    const m = arr?.find((p) => String(p.playerNo) === String(playerNo));
    if (!m) return undefined;
    const { playerNo: _, ...rest } = m;
    return rest;
  };
  const clutch = {
    regular: findClutch(clutchFile.players?.regular),
    playoff: findClutch(clutchFile.players?.playoff),
  };

  // Hustle 매칭
  type HustleEntry = HustlePlayerStats & { playerNo: string };
  type HustleFile = {
    players?: { regular?: HustleEntry[]; playoff?: HustleEntry[] };
  };
  const hustleFile = hustleJson as HustleFile;
  const findHustle = (
    arr: HustleEntry[] | undefined,
  ): HustlePlayerStats | undefined => {
    const m = arr?.find((p) => String(p.playerNo) === String(playerNo));
    if (!m) return undefined;
    const { playerNo: _, ...rest } = m;
    return rest;
  };
  const hustle = {
    regular: findHustle(hustleFile.players?.regular),
    playoff: findHustle(hustleFile.players?.playoff),
  };

  return {
    playerNo: String(meta.playerNo),
    kname: meta.kname,
    ename: meta.ename,
    team: {
      code: meta.teamCode,
      name: meta.teamName1,
      short: normShort(meta.teamName4),
    },
    season,
    seasonTotal: findIn(splits.regularTotal),
    playoff: findIn(splits.playoff),
    playoffTotal: findIn(splits.playoffTotal),
    championship: findIn(splits.championship),
    rounds,
    quarters,
    halves,
    venue,
    advanced,
    shooting,
    clutch,
    hustle,
  };
}

/** 모든 playerNo 리스트 (라우팅 정적 생성용) */
export function getAllPlayerNos(): string[] {
  const set = new Set<string>();
  const splits = detail?.splits;
  if (!splits) return [];
  const allArrays = [
    splits.regularSeason,
    splits.playoff,
    splits.regularTotal,
    ...Object.values(splits.round ?? {}),
  ];
  for (const arr of allArrays) {
    for (const p of arr ?? []) {
      if (p?.playerNo) set.add(String(p.playerNo));
    }
  }
  return [...set];
}

/** 같은 팀 동료 — 대시보드에서 추천용 */
export function getTeammates(playerNo: string, limit = 4): PlayerDetailRow[] {
  const me = detail?.splits?.regularSeason?.find(
    (p) => String(p?.playerNo) === String(playerNo),
  );
  if (!me) return [];
  return (detail.splits.regularSeason ?? [])
    .filter(
      (p) =>
        p &&
        String(p.playerNo) !== String(playerNo) &&
        p.teamCode === me.teamCode,
    )
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, limit);
}

/**
 * 라운드 다중 집계 — 선택된 라운드들의 per-game stat을 games 가중평균으로 합산.
 * 비율(FG%, 3P%, FT%, 2P%)은 made와 att를 각각 가중합해서 다시 계산.
 *
 * rounds 배열이 비어있거나 모든 라운드에 출장 0이면 null.
 */
export function aggregateRoundSet(
  profile: PlayerProfile,
  rounds: number[],
): PlayerDetailRow | null {
  if (!rounds || rounds.length === 0) return null;
  const rows: PlayerDetailRow[] = [];
  const validRounds = rounds.filter((n) => n >= 1 && n <= 6);
  for (const r of validRounds) {
    const row = profile.rounds[`r${r}`];
    if (row && (row.games ?? 0) > 0) rows.push(row);
  }
  if (rows.length === 0) return null;

  const totalGames = rows.reduce((n, r) => n + (r.games ?? 0), 0);
  if (totalGames === 0) return null;

  // 단순 가중평균 (per-game)
  const wAvg = (key: keyof PlayerDetailRow) => {
    const sum = rows.reduce(
      (n, r) => n + ((r[key] as number) ?? 0) * (r.games ?? 0),
      0,
    );
    return sum / totalGames;
  };

  // 비율: made / att 다시 계산
  const wAvgRatio = (madeKey: keyof PlayerDetailRow, attKey: keyof PlayerDetailRow) => {
    const made = rows.reduce(
      (n, r) => n + ((r[madeKey] as number) ?? 0) * (r.games ?? 0),
      0,
    );
    const att = rows.reduce(
      (n, r) => n + ((r[attKey] as number) ?? 0) * (r.games ?? 0),
      0,
    );
    return att > 0 ? (made / att) * 100 : 0;
  };

  const totalWins = rows.reduce((n, r) => n + (r.wins ?? 0), 0);
  const totalLosses = rows.reduce((n, r) => n + (r.losses ?? 0), 0);
  const head = rows[0];

  return {
    rank: 0,
    playerNo: head.playerNo,
    kname: head.kname,
    ename: head.ename,
    teamCode: head.teamCode,
    teamName1: head.teamName1,
    teamName4: head.teamName4,
    games: totalGames,
    wins: totalWins,
    losses: totalLosses,
    minutes: wAvg("minutes"),
    points: wAvg("points"),
    fgMade: wAvg("fgMade"),
    fgAtt: wAvg("fgAtt"),
    fgPct: wAvgRatio("fgMade", "fgAtt"),
    threeMade: wAvg("threeMade"),
    threeAtt: wAvg("threeAtt"),
    threePct: wAvgRatio("threeMade", "threeAtt"),
    twoMade: wAvg("twoMade"),
    twoAtt: wAvg("twoAtt"),
    twoPct: wAvgRatio("twoMade", "twoAtt"),
    ftMade: wAvg("ftMade"),
    ftAtt: wAvg("ftAtt"),
    ftPct: wAvgRatio("ftMade", "ftAtt"),
    rebounds: wAvg("rebounds"),
    oReb: wAvg("oReb"),
    dReb: wAvg("dReb"),
    assists: wAvg("assists"),
    steals: wAvg("steals"),
    blocks: wAvg("blocks"),
    turnovers: wAvg("turnovers"),
    fouls: wAvg("fouls"),
  };
}

/**
 * 라운드 연속 범위 집계 — fromR ~ toR (1~6).
 * 내부적으로 aggregateRoundSet 위임.
 */
export function aggregateRoundRange(
  profile: PlayerProfile,
  fromR: number,
  toR: number,
): PlayerDetailRow | null {
  if (fromR > toR) return null;
  const rounds: number[] = [];
  for (let r = fromR; r <= toR; r++) rounds.push(r);
  return aggregateRoundSet(profile, rounds);
}

/** 라운드별 추이 — 차트용 (라운드 X축 + 핵심 stat Y축) */
export function getRoundTrend(profile: PlayerProfile) {
  const stats = ["r1", "r2", "r3", "r4", "r5", "r6"].map((r) => {
    const row = profile.rounds[r];
    return {
      label: r.toUpperCase(),
      games: row?.games ?? 0,
      points: row?.points ?? null,
      rebounds: row?.rebounds ?? null,
      assists: row?.assists ?? null,
      fgPct: row?.fgPct ?? null,
      threePct: row?.threePct ?? null,
      minutes: row?.minutes ?? null,
    };
  });
  return stats;
}
