/**
 * 시즌별 선수 프로필 로더 — /players/season/[code]/[id] 상세 페이지에서 사용.
 *
 * lib/playerProfiles.ts 가 현재 시즌을 모듈 로드 시 import 하도록 되어 있어서,
 * 과거 시즌 상세용으로 fs 기반 병렬 로더를 둔다. 로직은 lib/playerProfiles 와
 * 동일한 getPlayerProfile 를 흉내낸다.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type {
  ClutchPlayerStats,
  HustlePlayerStats,
  PlayerAdvancedStats,
  PlayerDetailRow,
  PlayerDetailSplits,
  PlayerProfile,
  ShootingRange,
} from "./types";

const TEAM_NAME4_TO_SHORT: Record<string, string> = {
  LG: "LG", DB: "DB", SK: "SK", KCC: "KCC", KT: "KT",
  정관장: "정관장", 소노: "소노", 현대모비스: "현대모비스",
  가스공사: "가스공사", 삼성: "삼성",
  "JUNG KWAN JANG": "정관장", JUNGKWANJANG: "정관장", KGC: "정관장",
  SONO: "소노",
  "HYUNDAI MOBIS": "현대모비스", HYUNDAIMOBIS: "현대모비스", HD: "현대모비스",
  KOGAS: "가스공사", PEGA: "가스공사", KG: "가스공사",
  SAMSUNG: "삼성", SS: "삼성",
  // legacy (과거 시즌)
  오리온: "소노", 오리온스: "소노",
  KGC인삼공사: "정관장", 인삼공사: "정관장",
  모비스: "현대모비스",
  전자랜드: "한국가스공사",
};
function normShort(raw: string | undefined | null): string {
  if (!raw) return "";
  const t = String(raw).trim();
  return TEAM_NAME4_TO_SHORT[t] ?? t;
}

interface DetailFile {
  fetchedAt?: string;
  source?: string;
  seasonCode?: string;
  splits?: PlayerDetailSplits;
}

type AdvSplits = {
  regularSeason?: { playerNo: string; advanced: PlayerAdvancedStats }[];
  playoff?: { playerNo: string; advanced: PlayerAdvancedStats }[];
  championship?: { playerNo: string; advanced: PlayerAdvancedStats }[];
  round?: Record<string, { playerNo: string; advanced: PlayerAdvancedStats }[]>;
};

type ShootingFile = {
  players?: {
    regular?: { playerNo: string; ranges: ShootingRange[] }[];
    playoff?: { playerNo: string; ranges: ShootingRange[] }[];
  };
};

type ClutchEntry = ClutchPlayerStats & { playerNo: string };
type ClutchFile = { players?: { regular?: ClutchEntry[]; playoff?: ClutchEntry[] } };

type HustleEntry = HustlePlayerStats & { playerNo: string };
type HustleFile = { players?: { regular?: HustleEntry[]; playoff?: HustleEntry[] } };

type SeasonBundle = {
  detail: DetailFile;
  advSplits: AdvSplits | undefined;
  shooting: ShootingFile;
  clutch: ClutchFile;
  hustle: HustleFile;
};

const CACHE = new Map<string, SeasonBundle>();

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function loadBundle(seasonCode: string): SeasonBundle {
  const cached = CACHE.get(seasonCode);
  if (cached) return cached;
  const base = path.join(process.cwd(), "data", "season", seasonCode);
  const detail = readJson<DetailFile>(path.join(base, "players-detail.json")) ?? {};
  const advRaw = readJson<{ splits?: AdvSplits }>(path.join(base, "players-advanced.json"));
  const shooting = readJson<ShootingFile>(path.join(base, "shooting.json")) ?? {};
  const clutch = readJson<ClutchFile>(path.join(base, "clutch.json")) ?? {};
  const hustle = readJson<HustleFile>(path.join(base, "hustle.json")) ?? {};
  const bundle: SeasonBundle = { detail, advSplits: advRaw?.splits, shooting, clutch, hustle };
  CACHE.set(seasonCode, bundle);
  return bundle;
}

function findAdv(
  arr: { playerNo: string; advanced: PlayerAdvancedStats }[] | undefined,
  playerNo: string,
): PlayerAdvancedStats | undefined {
  return arr?.find((p) => String(p.playerNo) === String(playerNo))?.advanced;
}

/** 지정 시즌의 playerNo → 풀 프로필. */
export function getPlayerProfileForSeason(
  seasonCode: string,
  playerNo: string,
): PlayerProfile | null {
  const { detail, advSplits, shooting, clutch, hustle } = loadBundle(seasonCode);
  const splits = detail.splits;
  if (!splits) return null;

  const findIn = (arr: PlayerDetailRow[] | undefined) =>
    arr?.find((p) => String(p?.playerNo) === String(playerNo)) ?? null;

  const season = findIn(splits.regularSeason);
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

  type ExtendedSplits = {
    q1?: PlayerDetailRow[]; q2?: PlayerDetailRow[];
    q3?: PlayerDetailRow[]; q4?: PlayerDetailRow[];
    h1?: PlayerDetailRow[]; h2?: PlayerDetailRow[];
    home?: PlayerDetailRow[]; away?: PlayerDetailRow[];
  };
  const ext = splits as unknown as ExtendedSplits;
  const quarters: Record<string, PlayerDetailRow | null> = {
    q1: findIn(ext.q1), q2: findIn(ext.q2),
    q3: findIn(ext.q3), q4: findIn(ext.q4),
  };
  const halves: Record<string, PlayerDetailRow | null> = {
    h1: findIn(ext.h1), h2: findIn(ext.h2),
  };
  const venue: Record<string, PlayerDetailRow | null> = {
    home: findIn(ext.home), away: findIn(ext.away),
  };

  const advRounds: Record<string, PlayerAdvancedStats | undefined> = {};
  for (const r of ["r1", "r2", "r3", "r4", "r5", "r6"]) {
    advRounds[r] = findAdv(advSplits?.round?.[r], playerNo);
  }
  const advanced = {
    season: findAdv(advSplits?.regularSeason, playerNo),
    playoff: findAdv(advSplits?.playoff, playerNo),
    rounds: advRounds,
  };

  const findShoot = (
    arr: { playerNo: string; ranges: ShootingRange[] }[] | undefined,
  ): ShootingRange[] | undefined =>
    arr?.find((p) => String(p.playerNo) === String(playerNo))?.ranges;
  const shootingOut = {
    regular: findShoot(shooting.players?.regular),
    playoff: findShoot(shooting.players?.playoff),
  };

  const findClutch = (arr: ClutchEntry[] | undefined): ClutchPlayerStats | undefined => {
    const m = arr?.find((p) => String(p.playerNo) === String(playerNo));
    if (!m) return undefined;
    const { playerNo: _, ...rest } = m;
    return rest;
  };
  const clutchOut = {
    regular: findClutch(clutch.players?.regular),
    playoff: findClutch(clutch.players?.playoff),
  };

  const findHustle = (arr: HustleEntry[] | undefined): HustlePlayerStats | undefined => {
    const m = arr?.find((p) => String(p.playerNo) === String(playerNo));
    if (!m) return undefined;
    const { playerNo: _, ...rest } = m;
    return rest;
  };
  const hustleOut = {
    regular: findHustle(hustle.players?.regular),
    playoff: findHustle(hustle.players?.playoff),
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
    shooting: shootingOut,
    clutch: clutchOut,
    hustle: hustleOut,
  };
}

/** 지정 시즌의 모든 playerNo. */
export function getAllPlayerNosForSeason(seasonCode: string): string[] {
  const { detail } = loadBundle(seasonCode);
  const splits = detail.splits;
  if (!splits) return [];
  const set = new Set<string>();
  const arrays = [
    splits.regularSeason,
    splits.playoff,
    splits.regularTotal,
    ...Object.values(splits.round ?? {}),
  ];
  for (const arr of arrays) {
    for (const p of arr ?? []) {
      if (p?.playerNo) set.add(String(p.playerNo));
    }
  }
  return [...set];
}

/** 지정 시즌 같은 팀 동료 — 추천용. */
export function getTeammatesForSeason(
  seasonCode: string,
  playerNo: string,
  limit = 4,
): PlayerDetailRow[] {
  const { detail } = loadBundle(seasonCode);
  const regularSeason = detail.splits?.regularSeason ?? [];
  const me = regularSeason.find((p) => String(p?.playerNo) === String(playerNo));
  if (!me) return [];
  return regularSeason
    .filter(
      (p) =>
        p &&
        String(p.playerNo) !== String(playerNo) &&
        p.teamCode === me.teamCode,
    )
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, limit);
}

/** 지정 시즌 라운드별 추이. PlayerProfile 과 동일 shape. */
export function getRoundTrendForSeason(profile: PlayerProfile) {
  return ["r1", "r2", "r3", "r4", "r5", "r6"].map((r) => {
    const row = profile.rounds[r];
    return {
      label: r.toUpperCase(),
      games: row?.games ?? 0,
      points: row?.points ?? null,
      rebounds: row?.rebounds ?? null,
      assists: row?.assists ?? null,
      fgPct: row?.twoPct ?? row?.fgPct ?? null,
      threePct: row?.threePct ?? null,
      minutes: row?.minutes ?? null,
    };
  });
}

/** 퍼센타일 모집단 — PlayerProfile 레이더용. */
export function getRegularPopulationForSeason(seasonCode: string): PlayerDetailRow[] {
  const { detail } = loadBundle(seasonCode);
  return (detail.splits?.regularSeason ?? []).filter((p) => (p.games ?? 0) >= 1);
}
export function getPlayoffPopulationForSeason(seasonCode: string): PlayerDetailRow[] {
  const { detail } = loadBundle(seasonCode);
  return (detail.splits?.playoff ?? []).filter((p) => (p.games ?? 0) >= 1);
}

/** 메타 — fetchedAt 등. */
export function getPlayersDetailMetaForSeason(seasonCode: string): {
  fetchedAt: string | null;
  seasonCode: string;
} {
  const { detail } = loadBundle(seasonCode);
  return {
    fetchedAt: detail.fetchedAt ?? null,
    seasonCode: detail.seasonCode ?? seasonCode,
  };
}
