export type TeamCode =
  | "LG"
  | "KGC"
  | "DB"
  | "SK"
  | "SONO"
  | "KCC"
  | "KT"
  | "HDMOBIS"
  | "KOGAS"
  | "SAMSUNG";

export interface TeamStanding {
  rank: number;
  code: TeamCode;
  name: string; // 예: 창원 LG
  shortName: string; // 예: LG
  wins: number;
  losses: number;
  winPct: number; // 0.692
  gb: string; // 게임차, 예: "0" | "2.5"
  games: number; // 경기 수 = wins + losses
  streak: string; // 예: "W3", "L2"
  last10: string; // 예: "8-2"
  ppg: number; // 경기당 득점
  oppPpg: number; // 경기당 실점
  status: "regular-champ" | "bye" | "po" | "out" | "bottom";
  note?: string;
  accent: string; // Tailwind color class, e.g. "text-flame-500"
}

export interface PlayerLeader {
  rank: number;
  name: string;
  team: string;
  value: number;
  unit: string; // "PPG" | "RPG" | "APG" | "SPG" | "BPG"
}

export interface GameEvent {
  id: string;
  when: string; // ISO or display string
  home: { name: string; short: string; score?: number };
  away: { name: string; short: string; score?: number };
  tag: string; // 예: "6강 PO G2"
  status: "scheduled" | "live" | "final";
}

export interface TeamCompareRow {
  label: string;
  leftValue: string;
  rightValue: string;
  /** true → 왼쪽이 우위, false → 오른쪽이 우위, null → 동률 */
  leftBetter: boolean | null;
}

// ─── 플레이오프 ─────────────────────────────────────

export type PlayoffRoundKey = "first" | "semi" | "final";

export interface PlayoffGame {
  /** 시리즈 내 경기 번호 (1부터) */
  no: number;
  date: string;        // "2026-04-12"
  time: string;        // "19:00"
  homeShort: string;   // "SK"
  homeName: string;    // "서울 SK"
  awayShort: string;
  awayName: string;
  /** scheduled 인 경우 null */
  homeScore: number | null;
  awayScore: number | null;
  status: "scheduled" | "live" | "final";
  /** 결과가 확정된 경기에서만 채워짐 */
  winnerShort?: string;
  loserShort?: string;
}

export interface PlayoffSeries {
  /** 라운드 식별자 ('6강 PO' / '4강 PO' / '챔피언결정전') */
  round: PlayoffRoundKey;
  roundLabel: string;
  /** 매치 식별자 (해당 라운드 내에서 위에서부터 0,1,...) */
  slot: number;
  /** 5전 3선승 / 7전 4선승 */
  bestOf: number;
  /** 시드 정보 (1~6) — 예: 1위, 2위 직행팀, 또는 6강 승자 */
  topSeed?: number;
  bottomSeed?: number;
  /** 양 팀 약어 (한 팀이 미정이면 placeholder 처리됨) */
  topShort: string;
  topName: string;
  bottomShort: string;
  bottomName: string;
  /** 기록된 게임들 (날짜 오름차순) */
  games: PlayoffGame[];
  /** 현재까지 승수 */
  topWins: number;
  bottomWins: number;
  /** 시리즈 종결자 short (없으면 진행 중) */
  winnerShort?: string;
  /** 진행 상태 */
  status: "upcoming" | "in-progress" | "final";
}

export interface PlayoffBracket {
  fetchedAt: string | null;
  /** 6강 PO 시리즈들 (위→아래) */
  firstRound: PlayoffSeries[];
  /** 4강 PO 시리즈들 */
  semiRound: PlayoffSeries[];
  /** 챔피언결정전 (있으면 1개) */
  final: PlayoffSeries | null;
  /** 우승팀 (CF 종료 시) */
  champion?: string;
}

// ─── 2차 스탯 (Advanced) ────────────────────────────

export interface TeamAdvancedStats {
  offRtg: number;
  defRtg: number;
  netRtg: number;
  efgPct: number;   // Effective FG%
  tsPct: number;    // True Shooting%
  astPct: number;   // 어시스트 비율
  astTo: number;    // AST/TO
  astRatio: number;
  orebPct: number;
  drebPct: number;
  rebPct: number;
  tovPct: number;
  pace: number;
  pie: number;      // Player Impact Estimate (팀 단위)
  poss: number;     // 시즌 누적 포제션
}

export interface PlayerAdvancedStats {
  per: number;
  offRtg: number;
  defRtg: number;
  netRtg: number;
  efgPct: number;
  tsPct: number;
  astPct: number;
  astTo: number;
  astRatio: number;
  orebPct: number;
  drebPct: number;
  rebPct: number;
  usgPct: number;   // Usage Rate
  pace: number;
  tovPct: number;
  toRatio: number;
  pie: number;
  poss: number;
}

// ─── 선수 프로필 ───────────────────────────────────

/** 한 split(시즌 평균/라운드/PO 등)에서의 한 선수 row */
export interface PlayerDetailRow {
  rank: number;
  playerNo: string;
  kname: string;
  ename: string;
  teamCode: string;
  teamName1: string; // 풀네임 e.g. "서울 SK"
  teamName4: string; // 약어 e.g. "SK"
  games: number;
  wins: number;
  losses: number;
  /** 합산 시 초 단위, 평균 시 분 단위 가능 (raw) */
  minutes: number;
  points: number;
  fgMade: number; fgAtt: number; fgPct: number;
  threeMade: number; threeAtt: number; threePct: number;
  twoMade: number; twoAtt: number; twoPct: number;
  ftMade: number; ftAtt: number; ftPct: number;
  rebounds: number; oReb: number; dReb: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
}

export interface PlayerDetailSplits {
  regularSeason: PlayerDetailRow[];
  regularTotal: PlayerDetailRow[];
  playoff: PlayerDetailRow[];
  playoffTotal: PlayerDetailRow[];
  championship: PlayerDetailRow[];
  /** r1~r6 */
  round: Record<string, PlayerDetailRow[]>;
}

/** 한 선수 프로필 — 모든 split에서 그 선수 row를 모은 것 */
export interface PlayerProfile {
  playerNo: string;
  kname: string;
  ename: string;
  team: { code: string; name: string; short: string };
  /** 시즌 평균 (정규) */
  season: PlayerDetailRow | null;
  /** 시즌 합산 (정규) */
  seasonTotal: PlayerDetailRow | null;
  /** PO 평균 */
  playoff: PlayerDetailRow | null;
  /** PO 합산 */
  playoffTotal: PlayerDetailRow | null;
  /** CF 평균 */
  championship: PlayerDetailRow | null;
  /** 라운드별: { r1: row | null, ..., r6: row | null } */
  rounds: Record<string, PlayerDetailRow | null>;
  /** 쿼터별: { q1: row | null, ..., q4: row | null } */
  quarters: Record<string, PlayerDetailRow | null>;
  /** 전후반: { h1: row | null, h2: row | null } */
  halves: Record<string, PlayerDetailRow | null>;
  /** 홈/원정: { home: row | null, away: row | null } */
  venue: Record<string, PlayerDetailRow | null>;
  /** 2차 스탯 (있는 split만) */
  advanced?: {
    season?: PlayerAdvancedStats;
    playoff?: PlayerAdvancedStats;
    rounds?: Record<string, PlayerAdvancedStats | undefined>;
  };
  /** 영역별 야투 (있으면) */
  shooting?: {
    regular?: ShootingRange[];
    playoff?: ShootingRange[];
  };
  /** 박빙 시 stats */
  clutch?: {
    regular?: ClutchPlayerStats;
    playoff?: ClutchPlayerStats;
  };
  /** 허슬 stats */
  hustle?: {
    regular?: HustlePlayerStats;
    playoff?: HustlePlayerStats;
  };
}

export interface ShootingRange {
  range: number;     // 1~6
  made: number;
  att: number;
  pct: number;
}

/** 박빙 시 (clutch) 선수 stats — 4Q 마지막 5분 + 5점차 이내 */
export interface ClutchPlayerStats {
  games: number;
  wins: number;
  losses: number;
  minutes: number;
  points: number;
  fgMade: number; fgAtt: number; fgPct: number;
  threeMade: number; threeAtt: number; threePct: number;
  ftMade: number; ftAtt: number; ftPct: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
}

/** 허슬 stats — 스크린어시·디플렉션 */
export interface HustlePlayerStats {
  games: number;
  minutes: number;
  screenAssists: number;
  screenAssistsPts: number;
  deflections: number;
}

/** 4팩터 (Dean Oliver) — 팀 */
export interface FourFactorsTeam {
  efgPct: number;   // Effective FG%
  ftaRt: number;    // FTA/FGA (자유투 의존도)
  tovPct: number;   // 턴오버 비율
  orebPct: number;  // 공격 리바 비율
}
