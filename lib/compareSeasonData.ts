/**
 * 시즌별 비교 데이터 — /compare/season/[code] 에서 사용.
 *
 * CompareClient 가 요구하는 { standings, players } 를 임의 시즌에 대해 조립.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { TeamStanding } from "./types";
import {
  buildAdvMap,
  detailToRawWithAdv,
  type DetailRow,
  type PlayerAdvRow,
  type RawPlayer,
  type TeamFullStats,
} from "./data";

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

type FilteredAllRow = {
  rank: number;
  code: string;
  name: string;
  shortName: string;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  stats: {
    points?: number; margin?: number;
    assists?: number; rebounds?: number;
    oReb?: number; dReb?: number;
    steals?: number; blocks?: number;
    fgMade?: number; fgAtt?: number; fgPct?: number;
    threeMade?: number; threeAtt?: number; threePct?: number;
    ftMade?: number; ftAtt?: number; ftPct?: number;
    turnovers?: number;
  };
};

type FilteredFile = {
  filters?: { all?: FilteredAllRow[] };
};

type DetailFile = {
  splits?: {
    regularSeason?: DetailRow[];
  };
};

type AdvFile = {
  splits?: {
    regularSeason?: PlayerAdvRow[];
  };
};

const SEASON_COMPLETE_THRESHOLD = 50;

function rankToStatus(
  rank: number,
  total: number,
  isSeasonComplete: boolean,
): TeamStanding["status"] {
  if (!isSeasonComplete) return "out";
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

export type CompareSeasonData = {
  standings: TeamStanding[];
  players: RawPlayer[];
  teamStats: Record<string, TeamFullStats>;
  hasRealTeamStats: boolean;
  hasData: boolean;
};

const CACHE = new Map<string, CompareSeasonData>();

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function buildStandings(filteredAll: FilteredAllRow[]): TeamStanding[] {
  const totalTeams = filteredAll.length || 10;
  const leaderRow = filteredAll[0];
  const leaderWins = leaderRow?.wins ?? 0;
  const leaderLosses = leaderRow?.losses ?? 0;
  const isSeasonComplete =
    leaderWins + leaderLosses >= SEASON_COMPLETE_THRESHOLD;

  const computeGb = (wins: number, losses: number): string => {
    if (!leaderRow) return "-";
    const gb = (leaderWins - wins - (leaderLosses - losses)) / 2;
    if (gb <= 0) return "-";
    return gb.toFixed(1);
  };

  return filteredAll.map((t) => {
    const status = rankToStatus(t.rank, totalTeams, isSeasonComplete);
    const ppg = t.stats?.points ?? 0;
    const margin = t.stats?.margin ?? 0;
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
      streak: "-",
      last10: "-",
      ppg,
      oppPpg,
      status,
      note: statusToNote(status),
      accent: statusToAccent(status),
    };
  });
}

function buildTeamStats(
  filteredAll: FilteredAllRow[],
): { teamStats: Record<string, TeamFullStats>; hasReal: boolean } {
  const teamStats: Record<string, TeamFullStats> = {};
  for (const t of filteredAll) {
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
      fgPct:     s.fgPct ?? 0,
      threePct:  s.threePct ?? 0,
      ftPct:     s.ftPct ?? 0,
      turnovers: s.turnovers ?? 0,
    };
    teamStats[t.shortName] = stats;
    const tc = SHORT_TO_TEAMCODE[t.shortName];
    if (tc) teamStats[tc] = stats;
  }
  return { teamStats, hasReal: filteredAll.length >= 10 };
}

export function getCompareSeasonData(seasonCode: string): CompareSeasonData {
  const cached = CACHE.get(seasonCode);
  if (cached) return cached;
  const base = path.join(process.cwd(), "data", "season", seasonCode);
  const filtered = readJson<FilteredFile>(path.join(base, "team-filtered.json"));
  const detail = readJson<DetailFile>(path.join(base, "players-detail.json"));
  const adv = readJson<AdvFile>(path.join(base, "players-advanced.json"));

  const filteredAll = filtered?.filters?.all ?? [];
  const standings = buildStandings(filteredAll);
  const { teamStats, hasReal } = buildTeamStats(filteredAll);
  const players = detailToRawWithAdv(
    detail?.splits?.regularSeason,
    buildAdvMap(adv?.splits?.regularSeason),
  );

  const out: CompareSeasonData = {
    standings,
    players,
    teamStats,
    hasRealTeamStats: hasReal,
    hasData: standings.length > 0 || players.length > 0,
  };
  CACHE.set(seasonCode, out);
  return out;
}

export type CompareSeasonMeta = {
  code: string;
  label: string;
  startYear: number;
  isCurrent: boolean;
};

const BASE_CODE = 47;
const BASE_YEAR = 2025;
const CODE_STEP = 2;

function makeMeta(code: string, currentCode: string): CompareSeasonMeta {
  const n = parseInt(code, 10);
  const startYear = BASE_YEAR + (n - BASE_CODE) / CODE_STEP;
  return {
    code,
    label: `${startYear}-${String(startYear + 1).slice(-2)}`,
    startYear,
    isCurrent: code === currentCode,
  };
}

let SEASONS_CACHE: CompareSeasonMeta[] | null = null;
export function listCompareSeasons(currentCode: string): CompareSeasonMeta[] {
  if (SEASONS_CACHE) return SEASONS_CACHE;
  const root = path.join(process.cwd(), "data", "season");
  let names: string[] = [];
  try {
    names = fs.readdirSync(root).filter((n) => /^\d+$/.test(n));
  } catch {
    names = [];
  }
  const metas: CompareSeasonMeta[] = [];
  for (const name of names) {
    const p = path.join(root, name, "team-filtered.json");
    try {
      const raw = fs.readFileSync(p, "utf-8");
      const parsed = JSON.parse(raw) as FilteredFile;
      if (!(parsed.filters?.all ?? []).length) continue;
    } catch {
      continue;
    }
    metas.push(makeMeta(name, currentCode));
  }
  metas.sort((a, b) => parseInt(b.code, 10) - parseInt(a.code, 10));
  SEASONS_CACHE = metas;
  return metas;
}
