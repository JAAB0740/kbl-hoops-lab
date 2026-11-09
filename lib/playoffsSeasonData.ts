/**
 * 시즌별 PO 브래킷 데이터 — /playoffs/season/[code] 에서 사용.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { buildPlayoffBracketFrom, type PlayoffRawGame, type PlayoffStandingRow } from "./playoffs";
import type { PlayoffBracket } from "./types";

type FilteredFile = {
  fetchedAt?: string;
  filters?: {
    all?: Array<{
      rank: number;
      shortName: string;
      name: string;
    }>;
  };
};

type GamesFile = {
  fetchedAt?: string;
  games?: PlayoffRawGame[];
};

export type PlayoffSeasonData = {
  bracket: PlayoffBracket;
  hasPlayoffGames: boolean;
};

const CACHE = new Map<string, PlayoffSeasonData>();

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function getPlayoffsSeasonData(seasonCode: string): PlayoffSeasonData {
  const cached = CACHE.get(seasonCode);
  if (cached) return cached;
  const base = path.join(process.cwd(), "data", "season", seasonCode);
  const gamesFile = readJson<GamesFile>(path.join(base, "games.json"));
  const filteredFile = readJson<FilteredFile>(path.join(base, "team-filtered.json"));
  const games: PlayoffRawGame[] = gamesFile?.games ?? [];
  const standings: PlayoffStandingRow[] = (filteredFile?.filters?.all ?? []).map((t) => ({
    rank: t.rank,
    shortName: t.shortName,
    name: t.name,
  }));
  const bracket = buildPlayoffBracketFrom(
    games,
    standings,
    gamesFile?.fetchedAt ?? filteredFile?.fetchedAt ?? null,
  );
  const hasPlayoffGames = games.some(
    (g) => g.tag === "6강 PO" || g.tag === "4강 PO" || g.tag === "챔피언결정전" || g.tag === "챔결" || g.tag === "CF",
  );
  const out: PlayoffSeasonData = { bracket, hasPlayoffGames };
  CACHE.set(seasonCode, out);
  return out;
}

export type PlayoffsSeasonMeta = {
  code: string;
  label: string;
  startYear: number;
  isCurrent: boolean;
};

const BASE_CODE = 47;
const BASE_YEAR = 2025;
const CODE_STEP = 2;

function makeMeta(code: string, currentCode: string): PlayoffsSeasonMeta {
  const n = parseInt(code, 10);
  const startYear = BASE_YEAR + (n - BASE_CODE) / CODE_STEP;
  return {
    code,
    label: `${startYear}-${String(startYear + 1).slice(-2)}`,
    startYear,
    isCurrent: code === currentCode,
  };
}

let SEASONS_CACHE: PlayoffsSeasonMeta[] | null = null;
export function listPlayoffsSeasons(currentCode: string): PlayoffsSeasonMeta[] {
  if (SEASONS_CACHE) return SEASONS_CACHE;
  const root = path.join(process.cwd(), "data", "season");
  let names: string[] = [];
  try {
    names = fs.readdirSync(root).filter((n) => /^\d+$/.test(n));
  } catch {
    names = [];
  }
  const metas: PlayoffsSeasonMeta[] = [];
  for (const name of names) {
    const p = path.join(root, name, "games.json");
    try {
      const raw = fs.readFileSync(p, "utf-8");
      const parsed = JSON.parse(raw) as GamesFile;
      if (!(parsed.games ?? []).length) continue;
    } catch {
      continue;
    }
    metas.push(makeMeta(name, currentCode));
  }
  metas.sort((a, b) => parseInt(b.code, 10) - parseInt(a.code, 10));
  SEASONS_CACHE = metas;
  return metas;
}
