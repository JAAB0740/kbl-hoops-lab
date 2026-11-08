/**
 * 과거 시즌 아카이브 — 간소화된 읽기 전용 뷰.
 *
 * 현재 시즌(getCurrentSeason().code) 은 lib/data.ts 가 처리.
 * 과거 시즌은 이 모듈이 처리 — 핵심 통계만 (순위·리더·챔피언).
 *
 * 디렉토리 자동 스캔: data/season/<code>/ 안에 유효한 세 파일
 * (team-filtered / players-detail / games) 이 있으면 자동으로 아카이브에 등장.
 * 내년 시즌 추가시 fetch 만 돌리면 끝.
 */
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getCurrentSeason } from "./kblSeason";

const BASE_CODE = 47;
const BASE_YEAR = 2025;
const CODE_STEP = 2;

type TeamFilteredRow = {
  rank: number;
  code: string;
  name: string;
  shortName: string;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  stats: { points?: number; margin?: number };
};

type PlayerDetailRow = {
  rank: number;
  playerNo: string;
  kname: string;
  ename: string;
  teamCode: string;
  teamName1: string;
  teamName4: string;
  games: number;
  points: number;
  assists: number;
  rebounds: number;
  steals: number;
  blocks: number;
  threeMade: number;
  threeAtt: number;
  threePct: number;
  fgPct: number;
};

type GameRow = {
  date: string;
  tag: string;
  homeShort: string;
  awayShort: string;
  homeScore: number;
  awayScore: number;
  status: string;
};

type RawSet = {
  teamFiltered: { filters?: { all?: TeamFilteredRow[] } };
  playersDetail: { splits?: { regularSeason?: PlayerDetailRow[] } };
  games: { games?: GameRow[] };
};

export type ArchiveSeasonMeta = {
  code: string;
  label: string;
  startYear: number;
};

export type ArchiveStanding = {
  rank: number;
  shortName: string;
  name: string;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  ppg: number;
  oppPpg: number;
  margin: number;
};

export type ArchiveLeader = {
  rank: number;
  kname: string;
  teamShort: string;
  value: number;
  games: number;
};

export type ArchiveChampion = {
  team: string;
  wins: number;
  losses: number;
  seriesText: string;
};

export type ArchiveSeason = {
  meta: ArchiveSeasonMeta;
  standings: ArchiveStanding[];
  regularChampion: string;
  finalChampion: ArchiveChampion | null;
  scoringLeaders: ArchiveLeader[];
  assistLeaders: ArchiveLeader[];
  reboundLeaders: ArchiveLeader[];
  threePointLeaders: ArchiveLeader[];
};

// 과거 시즌 API 가 teamName4 에 영문을 섞어 반환 (예: "JUNG KWAN JANG", "HYUNDAI MOBIS").
// 사이트 톤 일관성 위해 한글 축약으로 정규화.
// 역사적 이름 (KGC → 정관장 리브랜딩 등) 은 그대로 둠 — 시즌 당시 호칭 보존.
const TEAM_SHORT_NORMALIZE: Record<string, string> = {
  "JUNG KWAN JANG": "정관장",
  JUNGKWANJANG: "정관장",
  "HYUNDAI MOBIS": "현대모비스",
  HYUNDAIMOBIS: "현대모비스",
  KOGAS: "가스공사",
  SAMSUNG: "삼성",
  SONO: "소노",
  ORION: "오리온",
  CARROT: "캐롯",
};

function normalizeTeamShort(short: string): string {
  if (!short) return short;
  return TEAM_SHORT_NORMALIZE[short] ?? short;
}

function codeToStartYear(code: number): number {
  return BASE_YEAR + (code - BASE_CODE) / CODE_STEP;
}

function makeMeta(code: string): ArchiveSeasonMeta {
  const n = parseInt(code, 10);
  const startYear = codeToStartYear(n);
  return {
    code,
    label: `${startYear}-${String(startYear + 1).slice(-2)}`,
    startYear,
  };
}

// ─── 디렉토리 스캔 & 캐시 ─────────────────────────────
const DATA_ROOT = path.join(process.cwd(), "data", "season");

let CACHE: { metas: ArchiveSeasonMeta[]; raw: Map<string, RawSet> } | null = null;

function loadAll() {
  if (CACHE) return CACHE;
  const currentCode = getCurrentSeason().code;
  const metas: ArchiveSeasonMeta[] = [];
  const raw = new Map<string, RawSet>();

  let names: string[] = [];
  try {
    names = fs
      .readdirSync(DATA_ROOT)
      .filter((n) => /^\d+$/.test(n) && n !== currentCode);
  } catch {
    names = [];
  }

  for (const name of names) {
    const base = path.join(DATA_ROOT, name);
    try {
      const teamFiltered = JSON.parse(
        fs.readFileSync(path.join(base, "team-filtered.json"), "utf-8"),
      );
      // 플레이스홀더 (필터 없는 빈 파일) 은 skip — 아직 fetch 안 된 시즌.
      if (!teamFiltered?.filters?.all?.length) continue;
      const playersDetail = JSON.parse(
        fs.readFileSync(path.join(base, "players-detail.json"), "utf-8"),
      );
      const games = JSON.parse(
        fs.readFileSync(path.join(base, "games.json"), "utf-8"),
      );
      raw.set(name, { teamFiltered, playersDetail, games });
      metas.push(makeMeta(name));
    } catch {
      // 파일 누락 / JSON 깨짐 → 해당 시즌 skip
    }
  }

  // 최신 시즌 먼저
  metas.sort((a, b) => parseInt(b.code, 10) - parseInt(a.code, 10));
  CACHE = { metas, raw };
  return CACHE;
}

export const ARCHIVE_SEASONS: ArchiveSeasonMeta[] = loadAll().metas;

// ─── 변환 ─────────────────────────────────────────────

function buildStandings(filteredAll: TeamFilteredRow[]): ArchiveStanding[] {
  return filteredAll.map((t) => {
    const ppg = t.stats?.points ?? 0;
    const margin = t.stats?.margin ?? 0;
    return {
      rank: t.rank,
      shortName: t.shortName,
      name: t.name,
      games: t.games ?? t.wins + t.losses,
      wins: t.wins,
      losses: t.losses,
      winPct: t.winPct,
      ppg,
      oppPpg: Math.max(0, ppg - margin),
      margin,
    };
  });
}

function extractFinalChampion(games: GameRow[]): ArchiveChampion | null {
  const finals = games.filter(
    (g) => g.tag === "챔피언결정전" && g.status === "final",
  );
  if (finals.length === 0) return null;
  const winCount: Record<string, number> = {};
  for (const g of finals) {
    const winner = g.homeScore > g.awayScore ? g.homeShort : g.awayShort;
    winCount[winner] = (winCount[winner] ?? 0) + 1;
  }
  const entries = Object.entries(winCount).sort((a, b) => b[1] - a[1]);
  const [champTeam, champWins] = entries[0];
  const loserWins = entries[1]?.[1] ?? 0;
  return {
    team: champTeam,
    wins: champWins,
    losses: loserWins,
    seriesText: `${champWins}-${loserWins}`,
  };
}

// 최소 경기수 — 리그 평균의 40%
const LEADER_MIN_GAMES_RATIO = 0.4;

function buildLeader(
  players: PlayerDetailRow[],
  field: keyof PlayerDetailRow,
  topN: number,
): ArchiveLeader[] {
  if (!players || players.length === 0) return [];
  const avgGames =
    players.reduce((s, p) => s + p.games, 0) / players.length;
  const minGames = Math.max(10, Math.ceil(avgGames * LEADER_MIN_GAMES_RATIO));
  const filtered = players.filter((p) => p.games >= minGames);
  filtered.sort((a, b) => (Number(b[field]) || 0) - (Number(a[field]) || 0));
  return filtered.slice(0, topN).map((p, i) => ({
    rank: i + 1,
    kname: p.kname,
    teamShort: normalizeTeamShort(p.teamName4 || p.teamName1),
    value: Number(p[field]) || 0,
    games: p.games,
  }));
}

export function getArchiveSeason(code: string): ArchiveSeason | null {
  const { metas, raw } = loadAll();
  const meta = metas.find((s) => s.code === code);
  const r = raw.get(code);
  if (!meta || !r) return null;

  const filteredAll = r.teamFiltered.filters?.all ?? [];
  const standings = buildStandings(filteredAll);
  const regularChampion = standings[0]?.name ?? "";

  const games = r.games.games ?? [];
  const finalChampion = extractFinalChampion(games);

  const players = r.playersDetail.splits?.regularSeason ?? [];
  const scoringLeaders = buildLeader(players, "points", 10);
  const assistLeaders = buildLeader(players, "assists", 10);
  const reboundLeaders = buildLeader(players, "rebounds", 10);
  const threePointLeaders = buildLeader(players, "threeMade", 10);

  return {
    meta,
    standings,
    regularChampion,
    finalChampion,
    scoringLeaders,
    assistLeaders,
    reboundLeaders,
    threePointLeaders,
  };
}
