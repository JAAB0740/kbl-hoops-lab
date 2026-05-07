/**
 * 플레이오프 브래킷 모듈
 *
 * data/games.json 의 PO 경기를 시리즈 단위로 그룹핑해서
 * 6강 PO / 4강 PO / 챔피언결정전 트리 구조로 변환한다.
 *
 * 시드 정보(top/bottom)는 정규리그 순위 기준으로 계산:
 *   - 1·2위는 4강 직행
 *   - 3 vs 6, 4 vs 5 가 6강 PO 매치업 (KBL 규정)
 *   - 4강 PO: 1 vs (4·5승자), 2 vs (3·6승자)
 *   - CF: 4강 두 승자
 */

import type {
  PlayoffBracket,
  PlayoffGame,
  PlayoffRoundKey,
  PlayoffSeries,
} from "./types";
import gamesJson from "../data/games.json";
import { STANDINGS as DATA_STANDINGS } from "./data";

type RawGame = {
  date: string;
  time: string;
  tag: string;
  homeTeam: string;
  homeShort: string;
  awayTeam: string;
  awayShort: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "scheduled" | "live" | "final";
};

const ALL_GAMES = (gamesJson as { games: RawGame[] }).games ?? [];
// STANDINGS 는 lib/data.ts 에서 team-filtered.json 으로 derive (자동 갱신).
// 옛날 standings.json (HTML 파싱, 4/28 stale) 의존 제거.
const STANDINGS = DATA_STANDINGS.map((s) => ({
  rank: s.rank,
  shortName: s.shortName,
  name: s.name,
}));

const PO_TAGS: Record<string, PlayoffRoundKey> = {
  "6강 PO": "first",
  "4강 PO": "semi",
  "챔피언결정전": "final",
  "챔결": "final",
  "CF": "final",
};

const ROUND_LABELS: Record<PlayoffRoundKey, string> = {
  first: "6강 플레이오프",
  semi: "4강 플레이오프",
  final: "챔피언결정전",
};

const ROUND_BEST_OF: Record<PlayoffRoundKey, number> = {
  first: 5, // 5전 3선승
  semi: 5,  // 5전 3선승
  final: 7, // 7전 4선승
};

function rankOf(short: string): number {
  return STANDINGS.find((s) => s.shortName === short)?.rank ?? 99;
}

function nameOf(short: string): string {
  return STANDINGS.find((s) => s.shortName === short)?.name ?? short;
}

/** 두 팀 short 이름을 정렬해 시리즈 키 생성 */
function pairKey(a: string, b: string): string {
  return [a, b].sort().join("__");
}

/** 한 시리즈를 PO 게임 배열로부터 빌드 */
function buildSeries(
  round: PlayoffRoundKey,
  slot: number,
  rawGames: RawGame[],
): PlayoffSeries {
  const sorted = [...rawGames].sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time),
  );

  // 시드 결정 (정규리그 순위 낮을수록 = 상위시드)
  const teams = Array.from(
    new Set(sorted.flatMap((g) => [g.homeShort, g.awayShort])),
  );
  // 두 팀 안 모이면 placeholder
  let [topShort, bottomShort] = teams;
  if (teams.length === 2) {
    if (rankOf(teams[0]) > rankOf(teams[1])) {
      [topShort, bottomShort] = [teams[1], teams[0]];
    }
  } else if (teams.length === 1) {
    topShort = teams[0];
    bottomShort = "TBD";
  } else {
    topShort = "TBD";
    bottomShort = "TBD";
  }

  const topName = nameOf(topShort);
  const bottomName = nameOf(bottomShort);

  const games: PlayoffGame[] = sorted.map((g, i) => {
    let winnerShort: string | undefined;
    let loserShort: string | undefined;
    if (
      g.status === "final" &&
      g.homeScore != null &&
      g.awayScore != null
    ) {
      if (g.homeScore > g.awayScore) {
        winnerShort = g.homeShort;
        loserShort = g.awayShort;
      } else if (g.awayScore > g.homeScore) {
        winnerShort = g.awayShort;
        loserShort = g.homeShort;
      }
    }
    return {
      no: i + 1,
      date: g.date,
      time: g.time,
      homeShort: g.homeShort,
      homeName: g.homeTeam,
      awayShort: g.awayShort,
      awayName: g.awayTeam,
      homeScore: g.homeScore,
      awayScore: g.awayScore,
      status: g.status,
      winnerShort,
      loserShort,
    };
  });

  const topWins = games.filter((g) => g.winnerShort === topShort).length;
  const bottomWins = games.filter((g) => g.winnerShort === bottomShort).length;
  const need = Math.ceil(ROUND_BEST_OF[round] / 2);

  let status: PlayoffSeries["status"] = "upcoming";
  let winnerShort: string | undefined;
  if (topWins >= need) {
    status = "final";
    winnerShort = topShort;
  } else if (bottomWins >= need) {
    status = "final";
    winnerShort = bottomShort;
  } else if (topWins > 0 || bottomWins > 0) {
    status = "in-progress";
  } else if (games.some((g) => g.status === "final")) {
    status = "in-progress";
  }

  return {
    round,
    roundLabel: ROUND_LABELS[round],
    slot,
    bestOf: ROUND_BEST_OF[round],
    topSeed: rankOf(topShort) <= 10 ? rankOf(topShort) : undefined,
    bottomSeed: rankOf(bottomShort) <= 10 ? rankOf(bottomShort) : undefined,
    topShort,
    topName,
    bottomShort,
    bottomName,
    games,
    topWins,
    bottomWins,
    winnerShort,
    status,
  };
}

/** PO 경기들을 시리즈 단위로 그룹핑 */
function groupSeries(
  round: PlayoffRoundKey,
  rawGames: RawGame[],
): PlayoffSeries[] {
  const map = new Map<string, RawGame[]>();
  for (const g of rawGames) {
    const k = pairKey(g.homeShort, g.awayShort);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(g);
  }

  // 시드 우선순위 (top 시드가 낮은 시리즈가 위로 가도록)
  // 4강의 경우 1번 시드가 위쪽 슬롯 (slot 0)
  const series = Array.from(map.entries()).map(([, gs]) =>
    buildSeries(round, 0, gs),
  );
  series.sort((a, b) => (a.topSeed ?? 99) - (b.topSeed ?? 99));
  series.forEach((s, i) => (s.slot = i));
  return series;
}

/** 6강 슬롯 배치: 4vs5 → slot 0 (위, 1번 시드 LG 라인), 3vs6 → slot 1 (아래, 2번 시드 정관장 라인) */
function arrangeFirstRound(series: PlayoffSeries[]): PlayoffSeries[] {
  return [...series].sort((a, b) => {
    const order = (s: PlayoffSeries) => {
      if (s.topSeed === 4) return 0; // 4 vs 5 → 위 (LG 라인)
      if (s.topSeed === 3) return 1; // 3 vs 6 → 아래 (정관장 라인)
      return s.slot;
    };
    return order(a) - order(b);
  }).map((s, i) => ({ ...s, slot: i }));
}

/** 4강 시리즈가 비어있을 때 (아직 6강 결과 없음) placeholder 만들기 — LG slot 0, 정관장 slot 1 */
function placeholderSemi(): PlayoffSeries[] {
  const lg = STANDINGS.find((s) => s.rank === 1);
  const kgc = STANDINGS.find((s) => s.rank === 2);
  return [
    {
      round: "semi",
      roundLabel: ROUND_LABELS.semi,
      slot: 0,
      bestOf: 5,
      topSeed: 1,
      bottomSeed: undefined,
      topShort: lg?.shortName ?? "TBD",
      topName: lg?.name ?? "LG",
      bottomShort: "TBD",
      bottomName: "4·5위 승자",
      games: [],
      topWins: 0,
      bottomWins: 0,
      status: "upcoming",
    },
    {
      round: "semi",
      roundLabel: ROUND_LABELS.semi,
      slot: 1,
      bestOf: 5,
      topSeed: 2,
      bottomSeed: undefined,
      topShort: kgc?.shortName ?? "TBD",
      topName: kgc?.name ?? "정관장",
      bottomShort: "TBD",
      bottomName: "3·6위 승자",
      games: [],
      topWins: 0,
      bottomWins: 0,
      status: "upcoming",
    },
  ];
}

/** 4강 결과 없으면 챔피언결정전 placeholder */
function placeholderFinal(): PlayoffSeries {
  return {
    round: "final",
    roundLabel: ROUND_LABELS.final,
    slot: 0,
    bestOf: 7,
    topShort: "TBD",
    topName: "4강 승자",
    bottomShort: "TBD",
    bottomName: "4강 승자",
    games: [],
    topWins: 0,
    bottomWins: 0,
    status: "upcoming",
  };
}

export function buildPlayoffBracket(): PlayoffBracket {
  const firstGames: RawGame[] = [];
  const semiGames: RawGame[] = [];
  const finalGames: RawGame[] = [];

  for (const g of ALL_GAMES) {
    const round = PO_TAGS[g.tag];
    if (round === "first") firstGames.push(g);
    else if (round === "semi") semiGames.push(g);
    else if (round === "final") finalGames.push(g);
  }

  const firstRoundRaw = groupSeries("first", firstGames);
  const firstRound = arrangeFirstRound(firstRoundRaw);

  let semiRound = groupSeries("semi", semiGames);
  if (semiRound.length === 0) {
    semiRound = placeholderSemi();
  } else if (semiRound.length === 1) {
    // 한 매치업만 있는 경우 다른 슬롯 placeholder 추가
    const existing = semiRound[0];
    const lg = STANDINGS.find((s) => s.rank === 1);
    const kgc = STANDINGS.find((s) => s.rank === 2);
    const has1 = existing.topShort === "LG" || existing.bottomShort === "LG";
    const has2 = existing.topShort === "정관장" || existing.bottomShort === "정관장";
    const placeholder: PlayoffSeries = {
      round: "semi",
      roundLabel: ROUND_LABELS.semi,
      slot: 0,
      bestOf: 5,
      topSeed: has1 ? 2 : 1,
      bottomSeed: undefined,
      topShort: has1 ? kgc?.shortName ?? "TBD" : lg?.shortName ?? "TBD",
      topName: has1 ? kgc?.name ?? "정관장" : lg?.name ?? "LG",
      bottomShort: "TBD",
      bottomName: has1 ? "3·6위 승자" : "4·5위 승자",
      games: [],
      topWins: 0,
      bottomWins: 0,
      status: "upcoming",
    };
    // LG(1번 시드)가 위 슬롯, 정관장(2번)이 아래 슬롯
    if (has1) {
      semiRound = [{ ...existing, slot: 0 }, { ...placeholder, slot: 1 }];
    } else if (has2) {
      semiRound = [{ ...placeholder, slot: 0 }, { ...existing, slot: 1 }];
    } else {
      semiRound = [{ ...existing, slot: 0 }, { ...placeholder, slot: 1 }];
    }
  } else {
    // LG(1번 시드) 슬롯 0 (위), 정관장(2번) 슬롯 1 (아래)
    semiRound = semiRound
      .sort((a, b) => (a.topSeed ?? 99) - (b.topSeed ?? 99)) // 1번이 먼저
      .map((s, i) => ({ ...s, slot: i }));
  }

  const finalSeries =
    finalGames.length > 0 ? groupSeries("final", finalGames)[0] ?? null : null;

  // KBL 일정의 챔결이 "미정 vs 미정"으로 와있는 경우도 있으므로 매치업 유효성 검증
  function hasValidTeam(s: string | undefined | null): boolean {
    return !!s && s !== "" && s !== "TBD" && s !== "미정";
  }
  const finalHasValidTeams =
    finalSeries &&
    hasValidTeam(finalSeries.topShort) &&
    hasValidTeam(finalSeries.bottomShort);

  // 챔피언결정전 매치업 결정:
  //  1) KBL 일정에 매치업이 명확히 들어있으면 그대로
  //  2) 매치업이 비어있으면 4강 승자 두 팀으로 자동 채움 (일정은 finalSeries 유지)
  //  3) 4강도 미완료면 placeholder
  const semiSlot0Winner = semiRound[0]?.winnerShort;
  const semiSlot1Winner = semiRound[1]?.winnerShort;
  let final: PlayoffSeries;
  if (finalHasValidTeams) {
    final = finalSeries!;
  } else if (semiSlot0Winner && semiSlot1Winner) {
    final = {
      round: "final",
      roundLabel: ROUND_LABELS.final,
      slot: 0,
      bestOf: 7,
      topSeed: rankOf(semiSlot0Winner) <= 10 ? rankOf(semiSlot0Winner) : undefined,
      bottomSeed: rankOf(semiSlot1Winner) <= 10 ? rankOf(semiSlot1Winner) : undefined,
      topShort: semiSlot0Winner,
      topName: nameOf(semiSlot0Winner),
      bottomShort: semiSlot1Winner,
      bottomName: nameOf(semiSlot1Winner),
      // KBL이 일정만 등록한 상태면 그 게임 리스트 보존 (날짜·시간만 표시)
      games: finalSeries?.games ?? [],
      topWins: 0,
      bottomWins: 0,
      status: "upcoming",
    };
  } else {
    final = placeholderFinal();
  }

  let champion: string | undefined;
  if (final.status === "final" && final.winnerShort) {
    champion = final.winnerShort;
  }

  return {
    fetchedAt: (gamesJson as { fetchedAt?: string }).fetchedAt ?? null,
    firstRound,
    semiRound,
    final,
    champion,
  };
}
