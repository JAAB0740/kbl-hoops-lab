/**
 * 시즌별 선수 데이터 로더 — /players/[season] 이 사용.
 *
 * lib/data.ts 가 하는 일을 "임의의 시즌 코드" 에 대해 수행.
 * 현재 시즌 (49) 도 처리 가능 → /players 를 이거로 통일 가능.
 *
 * fs.readFileSync 로 data/season/<code>/players-detail.json 과
 * players-advanced.json 을 읽어서 lib/data.ts 의 helper 로 가공.
 *
 * 과거 시즌 폴더에 placeholder 가 있으면 반환 데이터가 비어있을 수 있음.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  buildAdvMap,
  detailToRawWithAdv,
  type DetailRow,
  type PlayerAdvRow,
  type RawPlayer,
} from "./data";

type DetailFile = {
  splits?: {
    regularSeason?: DetailRow[];
    playoff?: DetailRow[];
    round?: Record<string, DetailRow[]>;
    home?: DetailRow[]; away?: DetailRow[];
    q1?: DetailRow[]; q2?: DetailRow[]; q3?: DetailRow[]; q4?: DetailRow[];
    h1?: DetailRow[]; h2?: DetailRow[];
  };
};

type AdvFile = {
  splits?: {
    regularSeason?: PlayerAdvRow[];
    playoff?: PlayerAdvRow[];
    round?: Record<string, PlayerAdvRow[]>;
    home?: PlayerAdvRow[]; away?: PlayerAdvRow[];
    q1?: PlayerAdvRow[]; q2?: PlayerAdvRow[]; q3?: PlayerAdvRow[]; q4?: PlayerAdvRow[];
    h1?: PlayerAdvRow[]; h2?: PlayerAdvRow[];
  };
};

export type PlayersSeasonData = {
  allPlayers: RawPlayer[];
  playersPlayoff: RawPlayer[];
  playersByRound: Record<string, RawPlayer[]>;
  playersByKey: Record<string, RawPlayer[]>;
};

const CACHE = new Map<string, PlayersSeasonData>();

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
}

/**
 * seasonCode (예: "49", "47") 에 해당하는 선수 데이터 번들 반환.
 * 데이터 없으면 빈 리스트 반환 (호출 측이 적절히 메시지 표시).
 */
export function getPlayersSeasonData(seasonCode: string): PlayersSeasonData {
  const cached = CACHE.get(seasonCode);
  if (cached) return cached;

  const base = path.join(process.cwd(), "data", "season", seasonCode);
  const detail = readJson<DetailFile>(path.join(base, "players-detail.json"));
  const adv = readJson<AdvFile>(path.join(base, "players-advanced.json"));

  const detailSplits = detail?.splits;
  const advSplits = adv?.splits;

  const seasonAdvMap = buildAdvMap(advSplits?.regularSeason);
  const allPlayers = detailToRawWithAdv(
    detailSplits?.regularSeason,
    seasonAdvMap,
  );
  const playersPlayoff = detailToRawWithAdv(
    detailSplits?.playoff,
    buildAdvMap(advSplits?.playoff),
  );

  const playersByRound: Record<string, RawPlayer[]> = {};
  for (const rk of ["r1", "r2", "r3", "r4", "r5", "r6"] as const) {
    playersByRound[rk] = detailToRawWithAdv(
      detailSplits?.round?.[rk],
      buildAdvMap(advSplits?.round?.[rk]),
    );
  }

  const playersByKey: Record<string, RawPlayer[]> = {};
  for (const sk of ["home", "away", "q1", "q2", "q3", "q4", "h1", "h2"] as const) {
    playersByKey[sk] = detailToRawWithAdv(
      detailSplits?.[sk],
      buildAdvMap(advSplits?.[sk]),
    );
  }

  const data: PlayersSeasonData = {
    allPlayers,
    playersPlayoff,
    playersByRound,
    playersByKey,
  };
  CACHE.set(seasonCode, data);
  return data;
}

/**
 * data/season/ 안의 모든 유효한 시즌 코드. 선수 데이터가 있는 시즌만.
 * 현재 시즌 포함.
 * 시즌 셀렉터와 generateStaticParams 가 사용.
 */
export type PlayersSeasonMeta = {
  code: string;
  label: string;
  startYear: number;
  isCurrent: boolean;
};

const BASE_CODE = 47;
const BASE_YEAR = 2025;
const CODE_STEP = 2;

function makeMeta(code: string, currentCode: string): PlayersSeasonMeta {
  const n = parseInt(code, 10);
  const startYear = BASE_YEAR + (n - BASE_CODE) / CODE_STEP;
  return {
    code,
    label: `${startYear}-${String(startYear + 1).slice(-2)}`,
    startYear,
    isCurrent: code === currentCode,
  };
}

let SEASONS_CACHE: PlayersSeasonMeta[] | null = null;

export function listPlayersSeasons(currentCode: string): PlayersSeasonMeta[] {
  if (SEASONS_CACHE) return SEASONS_CACHE;
  const root = path.join(process.cwd(), "data", "season");
  let names: string[] = [];
  try {
    names = fs.readdirSync(root).filter((n) => /^\d+$/.test(n));
  } catch {
    names = [];
  }
  const metas: PlayersSeasonMeta[] = [];
  for (const name of names) {
    // 선수 데이터가 실제로 있는 시즌만 포함 (placeholder skip).
    const detail = path.join(root, name, "players-detail.json");
    try {
      const raw = fs.readFileSync(detail, "utf-8");
      const parsed = JSON.parse(raw) as DetailFile;
      if (!parsed.splits?.regularSeason?.length) continue;
    } catch {
      continue;
    }
    metas.push(makeMeta(name, currentCode));
  }
  metas.sort((a, b) => parseInt(b.code, 10) - parseInt(a.code, 10));
  SEASONS_CACHE = metas;
  return metas;
}
