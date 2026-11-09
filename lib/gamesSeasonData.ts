/**
 * 시즌별 games 로더 — /games/season/[code] 페이지에서 사용.
 *
 * lib/gamesUtil.ts 가 현재 시즌을 모듈 로드 시 import 하도록 되어 있어서,
 * 과거 시즌용 fs 기반 병렬 로더를 둔다.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { RawGame } from "./gamesUtil";

export type GamesSeasonData = {
  games: RawGame[];
  fetchedAt: string | null;
};

const CACHE = new Map<string, GamesSeasonData>();

function readGames(seasonCode: string): GamesSeasonData {
  const cached = CACHE.get(seasonCode);
  if (cached) return cached;
  const p = path.join(process.cwd(), "data", "season", seasonCode, "games.json");
  let games: RawGame[] = [];
  let fetchedAt: string | null = null;
  try {
    const raw = fs.readFileSync(p, "utf-8");
    const parsed = JSON.parse(raw) as { games?: RawGame[]; fetchedAt?: string };
    games = (parsed.games ?? []).slice();
    fetchedAt = parsed.fetchedAt ?? null;
  } catch {
    games = [];
    fetchedAt = null;
  }
  const out: GamesSeasonData = { games, fetchedAt };
  CACHE.set(seasonCode, out);
  return out;
}

export function getGamesSeasonData(seasonCode: string): GamesSeasonData {
  return readGames(seasonCode);
}

/** data/season/ 내의 games 가 있는 시즌 목록. */
export type GamesSeasonMeta = {
  code: string;
  label: string;
  startYear: number;
  isCurrent: boolean;
};

const BASE_CODE = 47;
const BASE_YEAR = 2025;
const CODE_STEP = 2;

function makeMeta(code: string, currentCode: string): GamesSeasonMeta {
  const n = parseInt(code, 10);
  const startYear = BASE_YEAR + (n - BASE_CODE) / CODE_STEP;
  return {
    code,
    label: `${startYear}-${String(startYear + 1).slice(-2)}`,
    startYear,
    isCurrent: code === currentCode,
  };
}

let SEASONS_CACHE: GamesSeasonMeta[] | null = null;

export function listGamesSeasons(currentCode: string): GamesSeasonMeta[] {
  if (SEASONS_CACHE) return SEASONS_CACHE;
  const root = path.join(process.cwd(), "data", "season");
  let names: string[] = [];
  try {
    names = fs.readdirSync(root).filter((n) => /^\d+$/.test(n));
  } catch {
    names = [];
  }
  const metas: GamesSeasonMeta[] = [];
  for (const name of names) {
    const p = path.join(root, name, "games.json");
    try {
      const raw = fs.readFileSync(p, "utf-8");
      const parsed = JSON.parse(raw) as { games?: RawGame[] };
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
