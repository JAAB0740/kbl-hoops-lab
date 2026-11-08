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

type TeamAdvancedRow = {
  rank: number;
  code: string;
  name: string;
  shortName: string;
  advanced: {
    offRtg?: number;
    defRtg?: number;
    netRtg?: number;
    efgPct?: number;
    tsPct?: number;
  };
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
  teamAdvanced: { filters?: { all?: TeamAdvancedRow[] } } | null;
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
  offRtg: number | null;
  defRtg: number | null;
  netRtg: number | null;
};

export type ArchivePlayoffGame = {
  date: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
};

export type ArchivePlayoffSeries = {
  winner: string;
  loser: string;
  winnerWins: number;
  loserWins: number;
  games: ArchivePlayoffGame[];
};

export type ArchivePlayoffRound = {
  tag: string;
  label: string;
  series: ArchivePlayoffSeries[];
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
  playoffRounds: ArchivePlayoffRound[];
  scoringLeaders: ArchiveLeader[];
  assistLeaders: ArchiveLeader[];
  reboundLeaders: ArchiveLeader[];
  threePointLeaders: ArchiveLeader[];
  stealLeaders: ArchiveLeader[];
  blockLeaders: ArchiveLeader[];
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
      // team-advanced 는 optional — 없어도 archive 는 동작, 레이팅 열만 비움.
      let teamAdvanced: RawSet["teamAdvanced"] = null;
      try {
        teamAdvanced = JSON.parse(
          fs.readFileSync(path.join(base, "team-advanced.json"), "utf-8"),
        );
      } catch {
        teamAdvanced = null;
      }
      raw.set(name, { teamFiltered, teamAdvanced, playersDetail, games });
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

function buildStandings(
  filteredAll: TeamFilteredRow[],
  advancedAll: TeamAdvancedRow[] | null,
): ArchiveStanding[] {
  // 팀 코드별 어드밴스드 매핑 (shortName 보다 code 가 안전)
  const advByCode = new Map<string, TeamAdvancedRow["advanced"]>();
  if (advancedAll) {
    for (const row of advancedAll) advByCode.set(row.code, row.advanced ?? {});
  }
  return filteredAll.map((t) => {
    const ppg = t.stats?.points ?? 0;
    const margin = t.stats?.margin ?? 0;
    const adv = advByCode.get(t.code);
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
      offRtg: adv?.offRtg ?? null,
      defRtg: adv?.defRtg ?? null,
      netRtg: adv?.netRtg ?? null,
    };
  });
}

// ─── 플레이오프 series 추출 ──────────────────────────────
const PLAYOFF_TAGS: { tag: string; label: string }[] = [
  { tag: "6강 PO", label: "6강 플레이오프" },
  { tag: "4강 PO", label: "4강 플레이오프" },
  { tag: "챔피언결정전", label: "챔피언결정전" },
];

function extractPlayoffRounds(games: GameRow[]): ArchivePlayoffRound[] {
  const rounds: ArchivePlayoffRound[] = [];
  for (const { tag, label } of PLAYOFF_TAGS) {
    const matches = games.filter(
      (g) => g.tag === tag && g.status === "final",
    );
    if (matches.length === 0) continue;

    // 같은 두 팀이 나오는 경기 묶음 = 하나의 series
    const seriesMap = new Map<string, GameRow[]>();
    for (const g of matches) {
      const pair = [g.homeShort, g.awayShort].sort().join("|");
      const list = seriesMap.get(pair) ?? [];
      list.push(g);
      seriesMap.set(pair, list);
    }

    const series: ArchivePlayoffSeries[] = [];
    for (const [pair, list] of seriesMap) {
      list.sort((a, b) => a.date.localeCompare(b.date));
      const [teamA, teamB] = pair.split("|");
      let aWins = 0;
      let bWins = 0;
      for (const g of list) {
        const winner = g.homeScore > g.awayScore ? g.homeShort : g.awayShort;
        if (winner === teamA) aWins++;
        else bWins++;
      }
      const winnerTeam = aWins >= bWins ? teamA : teamB;
      const loserTeam = winnerTeam === teamA ? teamB : teamA;
      const winnerWins = Math.max(aWins, bWins);
      const loserWins = Math.min(aWins, bWins);
      series.push({
        winner: winnerTeam,
        loser: loserTeam,
        winnerWins,
        loserWins,
        games: list.map((g) => ({
          date: g.date,
          home: g.homeShort,
          away: g.awayShort,
          homeScore: g.homeScore,
          awayScore: g.awayScore,
        })),
      });
    }
    // 끝 경기가 늦은 series 를 뒤로 — 챔프결은 보통 하나뿐이지만 4강/6강은 복수
    series.sort((a, b) => {
      const aLast = a.games[a.games.length - 1].date;
      const bLast = b.games[b.games.length - 1].date;
      return aLast.localeCompare(bLast);
    });
    rounds.push({ tag, label, series });
  }
  return rounds;
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
  const advancedAll = r.teamAdvanced?.filters?.all ?? null;
  const standings = buildStandings(filteredAll, advancedAll);
  const regularChampion = standings[0]?.name ?? "";

  const games = r.games.games ?? [];
  const finalChampion = extractFinalChampion(games);
  const playoffRounds = extractPlayoffRounds(games);

  const players = r.playersDetail.splits?.regularSeason ?? [];
  const scoringLeaders = buildLeader(players, "points", 10);
  const assistLeaders = buildLeader(players, "assists", 10);
  const reboundLeaders = buildLeader(players, "rebounds", 10);
  const threePointLeaders = buildLeader(players, "threeMade", 10);
  const stealLeaders = buildLeader(players, "steals", 10);
  const blockLeaders = buildLeader(players, "blocks", 10);

  return {
    meta,
    standings,
    regularChampion,
    finalChampion,
    playoffRounds,
    scoringLeaders,
    assistLeaders,
    reboundLeaders,
    threePointLeaders,
    stealLeaders,
    blockLeaders,
  };
}
