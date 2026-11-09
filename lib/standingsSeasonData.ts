/**
 * 시즌별 standings 로더 — /standings/season/[code] 페이지에서 사용.
 *
 * lib/data.ts 가 현재 시즌을 모듈 로드 시 import 하도록 되어 있어서,
 * 과거 시즌용 fs 기반 병렬 로더를 둔다. FilterableStandings 는 all/home/away 만
 * 쓰므로 그 3개 split 만 반환.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { FilteredTeam } from "./data";
import type { TeamAdvancedStats } from "./types";

type FilterKey = "all" | "home" | "away";
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

export type StandingsSeasonData = {
  filters: { all: FilteredTeam[]; home: FilteredTeam[]; away: FilteredTeam[] };
  hasData: boolean;
};

const CACHE = new Map<string, StandingsSeasonData>();

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

export function getStandingsSeasonData(seasonCode: string): StandingsSeasonData {
  const cached = CACHE.get(seasonCode);
  if (cached) return cached;
  const base = path.join(process.cwd(), "data", "season", seasonCode);
  const filtered = readJson<FilteredFile>(path.join(base, "team-filtered.json"));
  const adv = readJson<AdvancedFile>(path.join(base, "team-advanced.json"));
  const raw = filtered?.filters ?? {};
  const advRaw = adv?.filters ?? {};
  const out: StandingsSeasonData = {
    filters: {
      all: mergeAdvanced(raw.all ?? [], advRaw.all),
      home: mergeAdvanced(raw.home ?? [], advRaw.home),
      away: mergeAdvanced(raw.away ?? [], advRaw.away),
    },
    hasData: (raw.all ?? []).length > 0,
  };
  CACHE.set(seasonCode, out);
  return out;
}

/** data/season/ 내의 standings 가 있는 시즌 목록. */
export type StandingsSeasonMeta = {
  code: string;
  label: string;
  startYear: number;
  isCurrent: boolean;
};

const BASE_CODE = 47;
const BASE_YEAR = 2025;
const CODE_STEP = 2;

function makeMeta(code: string, currentCode: string): StandingsSeasonMeta {
  const n = parseInt(code, 10);
  const startYear = BASE_YEAR + (n - BASE_CODE) / CODE_STEP;
  return {
    code,
    label: `${startYear}-${String(startYear + 1).slice(-2)}`,
    startYear,
    isCurrent: code === currentCode,
  };
}

let SEASONS_CACHE: StandingsSeasonMeta[] | null = null;
export function listStandingsSeasons(currentCode: string): StandingsSeasonMeta[] {
  if (SEASONS_CACHE) return SEASONS_CACHE;
  const root = path.join(process.cwd(), "data", "season");
  let names: string[] = [];
  try {
    names = fs.readdirSync(root).filter((n) => /^\d+$/.test(n));
  } catch {
    names = [];
  }
  const metas: StandingsSeasonMeta[] = [];
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
