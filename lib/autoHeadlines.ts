/**
 * 자동 헤드라인 생성 — 우리가 가진 데이터(games.json, standings.json,
 * players-detail.json, players-advanced.json)에서 의미있는 이벤트를 추출해
 * 마치 뉴스 기사처럼 헤드라인 만들기.
 *
 * 생성 항목:
 *   - 챔결 진출 (4강 두 시리즈 클린치)
 *   - 챔결 카운트다운 / 진행 상황
 *   - 정규리그 우승 / 최하위
 *   - 시즌 PPG · PER · USG 1위
 *   - 시즌 베스트 게임 (가장 큰 점수차, 오버타임 등)
 */

import gamesJson from "../data/games.json";
import { ALL_PLAYERS, PLAYERS_PLAYOFF, STANDINGS } from "./data";
import { getSeasonStatus, summarizeSeries } from "./seasonStatus";

interface RawGame {
  gmkey?: string;
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
}

const ALL_GAMES: RawGame[] = (gamesJson as { games: RawGame[] }).games ?? [];

export interface NewsItem {
  id: string;
  badge: string;
  title: string;
  time: string;
  /** 정렬용 (오름차순/내림차순). 큰 게 최근 */
  ts: number;
  /** 내부 링크 (클릭 시 deep link) */
  link?: string;
  /** 외부 검색용 키워드 (네이버 뉴스 검색) */
  searchQuery?: string;
}

// 게임 → /games/[id] 링크 생성 (gameToId 와 동일 형식)
function gameLink(g: RawGame): string {
  const d = g.date.replace(/-/g, "");
  const t = (g.time || "0000").replace(":", "");
  return `/games/${d}-${t}-${encodeURIComponent(g.homeShort)}-${encodeURIComponent(g.awayShort)}`;
}

// 선수 이름 → playerNo 매핑 (ALL_PLAYERS 에서 검색)
function playerLink(name: string, team: string): string | undefined {
  const found = ALL_PLAYERS.find(
    (p) => p.name === name && p.team === team,
  );
  if (found?.playerNo) return `/players/${found.playerNo}`;
  return undefined;
}

function todayKstISO(): string {
  const d = new Date();
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function daysAgo(date: string): number {
  const a = new Date(date + "T00:00:00Z").getTime();
  const b = new Date(todayKstISO() + "T00:00:00Z").getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function fmtTimeAgo(date: string): string {
  const days = daysAgo(date);
  if (days === 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 0) return `${-days}일 후`;
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

function dateToTs(date: string): number {
  return new Date(date + "T00:00:00Z").getTime();
}

export function generateHeadlines(): NewsItem[] {
  const items: NewsItem[] = [];
  const status = getSeasonStatus();
  const today = todayKstISO();

  // ─── 챔결 카운트다운 / 진행 ───────────────────────
  if (status.stage === "final-await" && status.finalSeries) {
    const m = status.finalSeries;
    const dCount = status.daysToNext;
    const dayText =
      dCount == null ? "곧" :
      dCount === 0 ? "오늘" :
      dCount > 0 ? `D-${dCount}` :
      "진행 중";
    items.push({
      id: "final-await",
      badge: "챔피언결정전",
      title: `${m.topShort} vs ${m.bottomShort}, 챔피언결정전 ${dayText} — 7전 4선승`,
      time: dCount === 0 ? "오늘" : dCount != null ? `${dCount}일 뒤` : "곧",
      ts: dateToTs(today) + 1e10,
      link: "/playoffs",
      searchQuery: `KBL 챔피언결정전 ${m.topShort} ${m.bottomShort}`,
    });
  }
  if (status.stage === "final-running" && status.finalSeries) {
    const m = status.finalSeries;
    const lead =
      m.topWins > m.bottomWins ? m.topShort :
      m.bottomWins > m.topWins ? m.bottomShort : null;
    const lastGame = m.games.filter((g) => g.status === "final").pop();
    const titleParts = [
      `${m.topShort} ${m.topWins}-${m.bottomWins} ${m.bottomShort}`,
      lead ? `${lead} 우위` : "동률",
    ];
    items.push({
      id: "final-running",
      badge: "챔피언결정전",
      title: `챔결 ${titleParts.join(" · ")}`,
      time: lastGame ? fmtTimeAgo(lastGame.date) : "진행 중",
      ts: lastGame ? dateToTs(lastGame.date) + 1e9 : Date.now(),
      link: "/playoffs",
      searchQuery: `KBL 챔피언결정전 ${m.topShort} ${m.bottomShort}`,
    });
  }
  if (status.stage === "final-done" && status.champion) {
    items.push({
      id: "final-done",
      badge: "챔피언",
      title: `${status.champion}, 챔피언결정전 우승!`,
      time: "이번 시즌 최종",
      ts: Date.now(),
      link: "/playoffs",
      searchQuery: `KBL ${status.champion} 챔피언결정전 우승`,
    });
  }

  // ─── 4강 PO 결과 ───────────────────────────────
  for (const semi of status.semiSeries) {
    if (semi.status !== "final" || !semi.winnerShort) continue;
    const sum = summarizeSeries(semi);
    const lastDate = semi.games[semi.games.length - 1]?.date ?? today;
    items.push({
      id: `semi-${semi.slot}`,
      badge: "4강 PO",
      title: `${semi.winnerShort}, ${sum.loser} 꺾고 ${sum.scoreLine}로 챔피언결정전 진출`,
      time: fmtTimeAgo(lastDate),
      ts: dateToTs(lastDate),
      link: "/playoffs",
      searchQuery: `KBL ${semi.winnerShort} ${sum.loser} 4강 플레이오프`,
    });
  }

  // ─── 6강 PO 각 시리즈 결과 ──────────────────────
  for (const first of status.firstSeries) {
    if (first.status !== "final" || !first.winnerShort) continue;
    const sum = summarizeSeries(first);
    const lastDate = first.games[first.games.length - 1]?.date ?? today;
    items.push({
      id: `first-${first.slot}`,
      badge: "6강 PO",
      title: `${first.winnerShort}, ${sum.loser} 상대로 ${sum.scoreLine} 시리즈 승리하며 4강 진출`,
      time: fmtTimeAgo(lastDate),
      ts: dateToTs(lastDate) - 5000,
      link: "/playoffs",
      searchQuery: `KBL ${first.winnerShort} ${sum.loser} 6강 플레이오프`,
    });
  }

  // ─── 정규리그 우승 ───────────────────────────────
  const regChamp = STANDINGS.find((s) => s.status === "regular-champ");
  if (regChamp) {
    items.push({
      id: "regular-champ",
      badge: "정규리그",
      title: `${regChamp.name}, 정규리그 우승 (${regChamp.wins}승 ${regChamp.losses}패, 승률 ${regChamp.winPct.toFixed(3).replace(/^0/, "")})`,
      time: regChamp.note || "정규시즌 마감",
      ts: dateToTs("2026-04-01") - 1e8,
      link: "/standings",
      searchQuery: `KBL ${regChamp.name} 정규리그 우승`,
    });
  }

  // ─── 정규리그 최하위 ─────────────────────────────
  const bottom = STANDINGS.find((s) => s.status === "bottom");
  if (bottom) {
    items.push({
      id: "regular-bottom",
      badge: "정규리그",
      title: `${bottom.name}, 정규리그 ${bottom.rank}위로 시즌 마감 (${bottom.wins}승 ${bottom.losses}패)`,
      time: "시즌 마감",
      ts: dateToTs("2026-04-01") - 2e8,
      link: "/standings",
      searchQuery: `KBL ${bottom.name} 시즌 마감`,
    });
  }

  // ─── 정규 PPG 1위 ───────────────────────────────
  const topScorer = [...ALL_PLAYERS]
    .filter((p) => (p.games ?? 0) >= 30)
    .sort((a, b) => b.stats.points - a.stats.points)[0];
  if (topScorer) {
    items.push({
      id: "season-scoring",
      badge: "득점",
      title: `${topScorer.name} (${topScorer.team}), 정규시즌 PPG 1위 — ${topScorer.stats.points.toFixed(1)}점`,
      time: "정규시즌 종료",
      ts: dateToTs("2026-04-01") - 3e8,
      link: playerLink(topScorer.name, topScorer.team),
      searchQuery: `KBL ${topScorer.name} 득점왕`,
    });
  }

  // ─── 정규 PER 1위 (advanced 있을 때) ──────────────
  const topPer = [...ALL_PLAYERS]
    .filter((p) => (p.games ?? 0) >= 30 && p.advanced?.per != null)
    .sort((a, b) => (b.advanced!.per ?? 0) - (a.advanced!.per ?? 0))[0];
  if (topPer && topPer.advanced) {
    items.push({
      id: "season-per",
      badge: "효율",
      title: `${topPer.name} (${topPer.team}), 시즌 PER ${topPer.advanced.per.toFixed(1)}로 효율성 1위`,
      time: "정규시즌 종료",
      ts: dateToTs("2026-04-01") - 4e8,
      link: playerLink(topPer.name, topPer.team),
      searchQuery: `KBL ${topPer.name}`,
    });
  }

  // ─── 정규 어시스트 1위 ──────────────────────────
  const topAst = [...ALL_PLAYERS]
    .filter((p) => (p.games ?? 0) >= 30)
    .sort((a, b) => b.stats.assists - a.stats.assists)[0];
  if (topAst) {
    items.push({
      id: "season-ast",
      badge: "어시스트",
      title: `${topAst.name} (${topAst.team}), 정규시즌 APG ${topAst.stats.assists.toFixed(1)}로 어시스트 1위`,
      time: "정규시즌 종료",
      ts: dateToTs("2026-04-01") - 5e8,
      link: playerLink(topAst.name, topAst.team),
      searchQuery: `KBL ${topAst.name} 어시스트`,
    });
  }

  // ─── 정규 리바운드 1위 ──────────────────────────
  const topReb = [...ALL_PLAYERS]
    .filter((p) => (p.games ?? 0) >= 30)
    .sort((a, b) => b.stats.rebounds - a.stats.rebounds)[0];
  if (topReb) {
    items.push({
      id: "season-reb",
      badge: "리바운드",
      title: `${topReb.name} (${topReb.team}), 정규시즌 RPG ${topReb.stats.rebounds.toFixed(1)}로 리바운드 1위`,
      time: "정규시즌 종료",
      ts: dateToTs("2026-04-01") - 6e8,
      link: playerLink(topReb.name, topReb.team),
      searchQuery: `KBL ${topReb.name} 리바운드`,
    });
  }

  // ─── 정규 USG% 1위 (해결사) ──────────────────────
  const topUsg = [...ALL_PLAYERS]
    .filter((p) => (p.games ?? 0) >= 30 && p.advanced?.usgPct != null)
    .sort((a, b) => (b.advanced!.usgPct ?? 0) - (a.advanced!.usgPct ?? 0))[0];
  if (topUsg && topUsg.advanced) {
    items.push({
      id: "season-usg",
      badge: "공격 점유",
      title: `${topUsg.name} (${topUsg.team}), USG% ${topUsg.advanced.usgPct.toFixed(1)}로 팀 최다 공격 점유율`,
      time: "정규시즌 종료",
      ts: dateToTs("2026-04-01") - 7e8,
      link: playerLink(topUsg.name, topUsg.team),
      searchQuery: `KBL ${topUsg.name}`,
    });
  }

  // ─── PO 영웅 (PO 평균 PPG 1위) ──────────────────
  const poTop = [...PLAYERS_PLAYOFF]
    .filter((p) => (p.games ?? 0) >= 1)
    .sort((a, b) => b.stats.points - a.stats.points)[0];
  if (poTop && (status.stage === "semi-round" || status.stage.startsWith("final"))) {
    items.push({
      id: "po-top",
      badge: "플레이오프",
      title: `${poTop.name} (${poTop.team}), 이번 PO ${poTop.games}경기 평균 ${poTop.stats.points.toFixed(1)}점`,
      time: "이번 PO",
      ts: dateToTs(today) - 1e7,
      link: playerLink(poTop.name, poTop.team),
      searchQuery: `KBL ${poTop.name} 플레이오프`,
    });
  }

  // ─── PO 빅게임 (점수차 큰 TOP 3) ─────────────────
  const poGames = ALL_GAMES.filter(
    (g) =>
      /PO|챔피언/.test(g.tag) &&
      g.status === "final" &&
      g.homeScore != null &&
      g.awayScore != null,
  );
  const blowouts = [...poGames]
    .map((g) => ({
      g,
      margin: Math.abs((g.homeScore ?? 0) - (g.awayScore ?? 0)),
    }))
    .sort((a, b) => b.margin - a.margin)
    .slice(0, 3);
  for (let i = 0; i < blowouts.length; i++) {
    const { g, margin } = blowouts[i];
    const hs = g.homeScore!;
    const as = g.awayScore!;
    const winner = hs > as ? g.homeShort : g.awayShort;
    const loser = hs > as ? g.awayShort : g.homeShort;
    items.push({
      id: `blowout-${i}`,
      badge: g.tag,
      title: `${winner}, ${loser} 상대로 ${margin}점 차 대승 (${Math.max(hs, as)}-${Math.min(hs, as)})`,
      time: fmtTimeAgo(g.date),
      ts: dateToTs(g.date) - i * 10,
      link: gameLink(g),
      searchQuery: `KBL ${winner} ${loser} ${g.tag}`,
    });
  }

  // ─── PO 박빙 경기 (5점 차 이하 TOP 3) ─────────────
  const closeGames = [...poGames]
    .map((g) => ({
      g,
      margin: Math.abs((g.homeScore ?? 0) - (g.awayScore ?? 0)),
    }))
    .filter((x) => x.margin <= 5)
    .sort((a, b) => a.margin - b.margin || b.g.date.localeCompare(a.g.date))
    .slice(0, 3);
  for (let i = 0; i < closeGames.length; i++) {
    const { g, margin } = closeGames[i];
    const hs = g.homeScore!;
    const as = g.awayScore!;
    const winner = hs > as ? g.homeShort : g.awayShort;
    items.push({
      id: `close-${i}`,
      badge: g.tag,
      title: `${winner}, ${margin}점 차 접전 끝에 ${g.homeShort} ${hs}-${as} ${g.awayShort} 승리`,
      time: fmtTimeAgo(g.date),
      ts: dateToTs(g.date) - i * 10 - 100,
      link: gameLink(g),
      searchQuery: `KBL ${g.homeShort} ${g.awayShort} ${g.tag}`,
    });
  }

  // ─── PO 최다 득점 경기 (한 팀 기준) ──────────────
  const highScoring = [...poGames]
    .map((g) => ({
      g,
      max: Math.max(g.homeScore ?? 0, g.awayScore ?? 0),
    }))
    .sort((a, b) => b.max - a.max)[0];
  if (highScoring && highScoring.max >= 100) {
    const { g, max } = highScoring;
    const hs = g.homeScore!;
    const as = g.awayScore!;
    const winner = hs > as ? g.homeShort : g.awayShort;
    items.push({
      id: "high-scoring",
      badge: g.tag,
      title: `${winner}, PO 최다 득점 ${max}점 폭발 (${g.homeShort} ${hs}-${as} ${g.awayShort})`,
      time: fmtTimeAgo(g.date),
      ts: dateToTs(g.date) - 200,
      link: gameLink(g),
      searchQuery: `KBL ${winner} ${max}점`,
    });
  }

  // 정렬 (최신 순) + 중복 제거 + 상위 N개
  const seen = new Set<string>();
  const uniq = items.filter((it) => {
    if (seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });
  uniq.sort((a, b) => b.ts - a.ts);
  return uniq;
}
