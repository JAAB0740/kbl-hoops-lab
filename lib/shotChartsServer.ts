import "server-only";

/**
 * KBL 슛 차트 — server-only 데이터 로딩 / 시즌 집계.
 *
 * data/match-charts.json (scripts/fetch-kbl-match-chart.mjs 가 생성) 를
 * 모듈 캐시로 한 번만 읽어들이고, pcode 별 시즌 누적 집계를 미리 계산.
 *
 * 클라이언트 안전한 types/constants/pure functions 는 `./shotCharts` 참고.
 */
import fs from "node:fs";
import path from "node:path";

import {
  classifyZone,
  classifyZoneDetailed,
  computeHexBins,
  normalizeShot,
  ZONE_DETAILED_ORDER,
  type PlayerShotChart,
  type Shot,
  type ShotZone,
  type ShotZoneDetailed,
} from "./shotCharts";

interface RawShotLog {
  pcode: string;
  pname: string;
  ename?: string;
  tcode?: string;
  logs?: Array<{ q: string; x: number; y: number; o: string; d: string }>;
}

interface MatchChartFile {
  fetchedAt?: string;
  totalGames?: number;
  totalShots?: number;
  byGmkey: Record<
    string,
    {
      shootLog?: RawShotLog[];
      leadTrack?: unknown;
      scoreChart?: unknown;
      bestPlayer?: unknown;
    }
  >;
}

let CACHED: MatchChartFile | null = null;
function loadMatchCharts(): MatchChartFile {
  if (CACHED) return CACHED;
  try {
    const p = path.join(process.cwd(), "data", "match-charts.json");
    if (!fs.existsSync(p)) {
      CACHED = { byGmkey: {} };
      return CACHED;
    }
    const raw = fs.readFileSync(p, "utf-8");
    CACHED = JSON.parse(raw) as MatchChartFile;
  } catch {
    CACHED = { byGmkey: {} };
  }
  return CACHED;
}

/** 시즌 통계에 포함되는 게임 tag (KBL 공식 누적 통계 기준).
 *  올스타게임 / EASL 등 친선/이벤트 경기는 *제외* — KBL 1차 스탯에 카운트되지 않음. */
const KBL_STAT_TAGS = new Set([
  "정규리그",
  "6강 PO",
  "4강 PO",
  "챔피언결정전",
]);

let KBL_GMKEYS: Set<string> | null = null;
function loadKblGmkeys(): Set<string> {
  if (KBL_GMKEYS) return KBL_GMKEYS;
  try {
    const p = path.join(process.cwd(), "data", "games.json");
    const raw = fs.readFileSync(p, "utf-8");
    const games = (JSON.parse(raw) as { games: Array<{ gmkey: string; tag: string; status: string }> }).games;
    KBL_GMKEYS = new Set(
      games
        .filter((g) => g.status === "final" && KBL_STAT_TAGS.has(g.tag))
        .map((g) => g.gmkey),
    );
  } catch {
    KBL_GMKEYS = new Set();
  }
  return KBL_GMKEYS;
}

let PLAYER_CACHE: Map<string, PlayerShotChart> | null = null;
function buildPlayerCache(): Map<string, PlayerShotChart> {
  if (PLAYER_CACHE) return PLAYER_CACHE;
  const file = loadMatchCharts();
  const kblGmkeys = loadKblGmkeys();
  const byPcode = new Map<
    string,
    {
      pcode: string;
      shots: Shot[];
      gameSet: Set<string>;
    }
  >();
  // 동시에 리그 zone 별 누적 — 헥스빈 효율 비교의 baseline
  const leagueZoneCounts: Record<ShotZone, { att: number; made: number }> = {
    at_rim:   { att: 0, made: 0 },
    paint:    { att: 0, made: 0 },
    midrange: { att: 0, made: 0 },
    corner_3: { att: 0, made: 0 },
    wing_3:   { att: 0, made: 0 },
    top_3:    { att: 0, made: 0 },
  };
  // NBA-classic 14존 리그 baseline
  const leagueDetailedCounts = Object.fromEntries(
    ZONE_DETAILED_ORDER.map((z) => [z, { att: 0, made: 0 }]),
  ) as Record<ShotZoneDetailed, { att: number; made: number }>;

  for (const gmkey of Object.keys(file.byGmkey)) {
    // KBL 공식 시즌 통계 게임만 포함 — 올스타/EASL 제외.
    // (만약 games.json 로딩 실패해서 kblGmkeys 가 비어있으면 fallback 으로 전부 포함)
    if (kblGmkeys.size > 0 && !kblGmkeys.has(gmkey)) continue;
    const sl = file.byGmkey[gmkey].shootLog ?? [];
    for (const p of sl) {
      if (!p.pcode || !p.logs) continue;
      let bucket = byPcode.get(p.pcode);
      if (!bucket) {
        bucket = { pcode: p.pcode, shots: [], gameSet: new Set() };
        byPcode.set(p.pcode, bucket);
      }
      bucket.gameSet.add(gmkey);
      for (const raw of p.logs) {
        const norm = normalizeShot(raw);
        const zone = classifyZone(norm.x, norm.y);
        const zoneDetailed = classifyZoneDetailed(norm.x, norm.y);
        bucket.shots.push({
          x: norm.x,
          y: norm.y,
          made: norm.made,
          quarter: norm.quarter,
          zone,
          pcode: p.pcode,
          gmkey,
        });
        leagueZoneCounts[zone].att++;
        if (norm.made) leagueZoneCounts[zone].made++;
        leagueDetailedCounts[zoneDetailed].att++;
        if (norm.made) leagueDetailedCounts[zoneDetailed].made++;
      }
    }
  }

  // 리그 zone 별 FG% (헥스빈 효율 비교 baseline)
  const leagueZoneAvg: Record<ShotZone, number> = {
    at_rim:   0,
    paint:    0,
    midrange: 0,
    corner_3: 0,
    wing_3:   0,
    top_3:    0,
  };
  for (const z of Object.keys(leagueZoneCounts) as ShotZone[]) {
    const c = leagueZoneCounts[z];
    leagueZoneAvg[z] = c.att > 0 ? (c.made / c.att) * 100 : 0;
  }
  // 14존 리그 평균
  const leagueZoneDetailedAvg = Object.fromEntries(
    ZONE_DETAILED_ORDER.map((z) => {
      const c = leagueDetailedCounts[z];
      return [z, c.att > 0 ? (c.made / c.att) * 100 : 0];
    }),
  ) as Record<ShotZoneDetailed, number>;

  const out = new Map<string, PlayerShotChart>();
  for (const [pcode, b] of byPcode) {
    const byZone: Record<ShotZone, { zone: ShotZone; made: number; att: number; pct: number }> = {
      at_rim:   { zone: "at_rim",   made: 0, att: 0, pct: 0 },
      paint:    { zone: "paint",    made: 0, att: 0, pct: 0 },
      midrange: { zone: "midrange", made: 0, att: 0, pct: 0 },
      corner_3: { zone: "corner_3", made: 0, att: 0, pct: 0 },
      wing_3:   { zone: "wing_3",   made: 0, att: 0, pct: 0 },
      top_3:    { zone: "top_3",    made: 0, att: 0, pct: 0 },
    };
    let totalMade = 0;
    // 14존 buckets
    const byZoneDetailed = Object.fromEntries(
      ZONE_DETAILED_ORDER.map((z) => [z, { zone: z, made: 0, att: 0, pct: 0 }]),
    ) as Record<ShotZoneDetailed, { zone: ShotZoneDetailed; made: number; att: number; pct: number }>;
    for (const s of b.shots) {
      byZone[s.zone].att++;
      const zd = classifyZoneDetailed(s.x, s.y);
      byZoneDetailed[zd].att++;
      if (s.made) {
        byZone[s.zone].made++;
        byZoneDetailed[zd].made++;
        totalMade++;
      }
    }
    for (const z of Object.keys(byZone) as ShotZone[]) {
      const zs = byZone[z];
      zs.pct = zs.att > 0 ? (zs.made / zs.att) * 100 : 0;
    }
    for (const z of Object.keys(byZoneDetailed) as ShotZoneDetailed[]) {
      const zs = byZoneDetailed[z];
      zs.pct = zs.att > 0 ? (zs.made / zs.att) * 100 : 0;
    }
    // 헥스빈 — 리그 zone 평균 대비 차이로 색상 인코딩
    const hexBins = computeHexBins(b.shots, leagueZoneAvg);
    out.set(pcode, {
      pcode,
      totalShots: b.shots.length,
      totalMade,
      fgPct: b.shots.length > 0 ? (totalMade / b.shots.length) * 100 : 0,
      byZone,
      byZoneDetailed,
      gamesWithShots: b.gameSet.size,
      shots: b.shots,
      hexBins,
      leagueZoneAvg,
      leagueZoneDetailedAvg,
    });
  }
  PLAYER_CACHE = out;
  return PLAYER_CACHE;
}

/** pcode → 시즌 누적 슛 차트. 없으면 null. */
export function getPlayerShotChart(pcode: string): PlayerShotChart | null {
  if (!pcode) return null;
  return buildPlayerCache().get(pcode) ?? null;
}
