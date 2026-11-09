/**
 * 시즌별 팀 분석 데이터 로더 — /team/season/[code] 페이지에서 사용.
 *
 * TeamAnalytics 가 요구하는 Record<FilterKey, FilteredTeam[]> 전체 스펙 반환.
 * (standingsSeasonData 는 all/home/away 만 다룸.)
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { FilteredTeam, FilterKey } from "./data";
import type { TeamAdvancedStats } from "./types";

type FilteredFile = {
  filters?: Partial<Record<FilterKey, FilteredTeam[]>>;
};
type AdvancedTeamRow = {
  rank: number;
  code: string;
  shortName: string;
  advanced: TeamAdvancedStats;
};
type AdvancedFile = {
  filters?: Partial<Record<FilterKey, AdvancedTeamRow[]>>;
};

export type TeamSeasonData = {
  filters: Record<FilterKey, FilteredTeam[]>;
  clutch: ClutchFile | null;
  games: ClutchGameLite[];
  hasData: boolean;
  fetchedAt: string | null;
};

export type ClutchPlayer = {
  playerNo?: string;
  teamName4: string;
  games: number;
  wins: number;
  losses: number;
  points: number;
  fgMade: number; fgAtt: number;
  threeMade: number; threeAtt: number;
  ftMade: number; ftAtt: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
};
export type ClutchFile = {
  players?: { regular?: ClutchPlayer[]; playoff?: ClutchPlayer[] };
};

export type ClutchGameLite = {
  status: string;
  homeShort: string;
  awayShort: string;
  homeScore: number | null;
  awayScore: number | null;
};

const ALL_KEYS: FilterKey[] = [
  "all", "home", "away",
  "r1", "r2", "r3", "r4", "r5", "r6",
  "q1", "q2", "q3", "q4",
  "h1", "h2", "po",
  "home_r1", "home_r2", "home_r3", "home_r4", "home_r5", "home_r6",
  "away_r1", "away_r2", "away_r3", "away_r4", "away_r5", "away_r6",
];

const CACHE = new Map<string, TeamSeasonData>();

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

function normalizeStats(s: FilteredTeam["stats"]): FilteredTeam["stats"] {
  const fgM = s.fgMade ?? 0;
  const fgA = s.fgAtt ?? 0;
  const t3M = s.threeMade ?? 0;
  const t3A = s.threeAtt ?? 0;
  const totM = fgM + t3M;
  const totA = fgA + t3A;
  return {
    ...s,
    fgMade: totM,
    fgAtt: totA,
    fgPct: totA > 0 ? (totM / totA) * 100 : 0,
  };
}

function mergeAdvanced(
  base: FilteredTeam[],
  adv: AdvancedTeamRow[] | undefined,
): FilteredTeam[] {
  const byCode = adv && adv.length > 0
    ? new Map(adv.map((a) => [String(a.code), a.advanced]))
    : null;
  return base.map((t) => {
    const stats = normalizeStats(t.stats);
    const a = byCode?.get(String(t.code));
    return a ? { ...t, stats, advanced: a } : { ...t, stats };
  });
}

export function getTeamSeasonData(seasonCode: string): TeamSeasonData {
  const cached = CACHE.get(seasonCode);
  if (cached) return cached;
  const base = path.join(process.cwd(), "data", "season", seasonCode);
  const filtered = readJson<FilteredFile & { fetchedAt?: string }>(
    path.join(base, "team-filtered.json"),
  );
  const adv = readJson<AdvancedFile>(path.join(base, "team-advanced.json"));
  const clutch = readJson<ClutchFile>(path.join(base, "clutch.json"));
  const gamesFile = readJson<{ games?: ClutchGameLite[] }>(
    path.join(base, "games.json"),
  );
  const raw = filtered?.filters ?? {};
  const advRaw = adv?.filters ?? {};
  const filters = {} as Record<FilterKey, FilteredTeam[]>;
  for (const k of ALL_KEYS) {
    filters[k] = mergeAdvanced(raw[k] ?? [], advRaw[k]);
  }
  const out: TeamSeasonData = {
    filters,
    clutch,
    games: gamesFile?.games ?? [],
    hasData: filters.all.length > 0,
    fetchedAt: filtered?.fetchedAt ?? null,
  };
  CACHE.set(seasonCode, out);
  return out;
}

/** data/season/ 내의 team 데이터가 있는 시즌 목록. */
export type TeamSeasonMeta = {
  code: string;
  label: string;
  startYear: number;
  isCurrent: boolean;
};

const BASE_CODE = 47;
const BASE_YEAR = 2025;
const CODE_STEP = 2;

function makeMeta(code: string, currentCode: string): TeamSeasonMeta {
  const n = parseInt(code, 10);
  const startYear = BASE_YEAR + (n - BASE_CODE) / CODE_STEP;
  return {
    code,
    label: `${startYear}-${String(startYear + 1).slice(-2)}`,
    startYear,
    isCurrent: code === currentCode,
  };
}

let SEASONS_CACHE: TeamSeasonMeta[] | null = null;
export function listTeamSeasons(currentCode: string): TeamSeasonMeta[] {
  if (SEASONS_CACHE) return SEASONS_CACHE;
  const root = path.join(process.cwd(), "data", "season");
  let names: string[] = [];
  try {
    names = fs.readdirSync(root).filter((n) => /^\d+$/.test(n));
  } catch {
    names = [];
  }
  const metas: TeamSeasonMeta[] = [];
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
