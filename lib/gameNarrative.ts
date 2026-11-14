/**
 * 경기 미리보기 "관전 포인트" 상단 서사 문장 (A) + streak 하이라이트 (D) 생성기.
 *
 * 룰 기반 — 데이터에서 우선순위 높은 훅을 2~3개 뽑아 자연어 문장으로 반환.
 * 외부 fetch 없음, 모두 이미 로드된 ALL_GAMES / STANDINGS / RAW_BOX 사용.
 */
import "server-only";
import { ALL_GAMES, teamRecentForm, headToHead } from "./gamesUtil";
import { STANDINGS } from "./data";
import { teamPlayersBefore, teamPlayersRecentBefore } from "./boxscores";

export type NarrativeTone = "flame" | "neon" | "hoop" | "buzzer" | "ink";

export interface Narrative {
  /** 1줄 문장 */
  text: string;
  /** 시각 톤 (팀 streak 승연승 → flame, 패연패 → ink 등) */
  tone: NarrativeTone;
  /** 중요도 가중치 — 큰 값 우선 */
  weight: number;
}

/**
 * 이 경기 미리보기용 서사 훅 top 3 반환.
 * - 팀 연승·연패 (D)
 * - 주전 선수 득점 streak (D)
 * - H2H 시즌 서사 (A)
 * - 순위 극단 대결 (A)
 */
export function buildGameNarratives(
  homeShort: string,
  awayShort: string,
  date: string,
  time: string,
): Narrative[] {
  const out: Narrative[] = [];

  // ── 1) 팀 연승·연패 streak ──
  for (const short of [homeShort, awayShort]) {
    const form = teamRecentForm(short, 10, date, time);
    if (form.length === 0) continue;
    const first = form[0];
    let streak = 0;
    for (const r of form) {
      if (r === first) streak++;
      else break;
    }
    if (streak >= 3) {
      if (first === "W") {
        out.push({
          text: `${short} ${streak}연승 중 — 모멘텀 유지할 수 있을까.`,
          tone: "flame",
          weight: 50 + streak * 5,
        });
      } else {
        out.push({
          text: `${short} ${streak}연패 — 반등 포인트를 찾을 수 있을지.`,
          tone: "ink",
          weight: 40 + streak * 5,
        });
      }
    }
  }

  // ── 2) 주전 득점 streak (최근 3경기 모두 20+) ──
  for (const short of [homeShort, awayShort]) {
    const recent = teamPlayersRecentBefore(short, date, time, 3, 3);
    const season = teamPlayersBefore(short, date, time, 5);
    const seasonBy = new Map(season.map((e) => [e.player.pcode, e]));
    for (const r of recent) {
      const s = seasonBy.get(r.player.pcode);
      if (!s || s.avg.mpg < 20) continue;
      // 최근 3경기 평균이 20+ 이면 "폭발 중" 라벨
      if (r.avg.ppg >= 20 && r.avg.games >= 3) {
        out.push({
          text: `${r.player.pname} 최근 3경기 평균 ${r.avg.ppg.toFixed(1)}점 — 폭발 중.`,
          tone: "flame",
          weight: 30 + (r.avg.ppg - 20) * 2,
        });
      } else if (s.avg.ppg >= 15 && r.avg.ppg <= s.avg.ppg - 5) {
        // 시즌 평균 15+ 이던 선수가 최근 5점 이상 떨어짐
        out.push({
          text: `${r.player.pname} 최근 ${r.avg.ppg.toFixed(1)}점 (시즌 ${s.avg.ppg.toFixed(1)}) — 슬럼프 탈출 필요.`,
          tone: "ink",
          weight: 25 + (s.avg.ppg - r.avg.ppg),
        });
      }
    }
  }

  // ── 3) H2H 시즌 서사 ──
  const h2h = headToHead(homeShort, awayShort, date, time);
  if (h2h.games.length >= 2) {
    const diff = Math.abs(h2h.aWins - h2h.bWins);
    const leader = h2h.aWins > h2h.bWins ? homeShort : awayShort;
    const trailer = leader === homeShort ? awayShort : homeShort;
    if (diff === h2h.games.length && h2h.games.length >= 2) {
      out.push({
        text: `${leader}, ${trailer} 상대 시즌 ${h2h.games.length}-0 완봉 중.`,
        tone: "neon",
        weight: 45 + h2h.games.length * 3,
      });
    } else if (diff >= 2) {
      out.push({
        text: `시즌 H2H ${leader} ${Math.max(h2h.aWins, h2h.bWins)}-${Math.min(h2h.aWins, h2h.bWins)} 우세.`,
        tone: "neon",
        weight: 30,
      });
    } else {
      out.push({
        text: `시즌 H2H ${h2h.aWins}-${h2h.bWins} 접전 — 이번 경기가 분수령.`,
        tone: "hoop",
        weight: 28,
      });
    }
  }

  // ── 4) 순위 극단 대결 ──
  const home = STANDINGS.find((s) => s.shortName === homeShort);
  const away = STANDINGS.find((s) => s.shortName === awayShort);
  if (home?.rank && away?.rank) {
    const diff = Math.abs(home.rank - away.rank);
    const top = home.rank < away.rank ? home : away;
    const bottom = home.rank < away.rank ? away : home;
    if (top.rank <= 3 && bottom.rank >= 8 && diff >= 5) {
      out.push({
        text: `${top.shortName}(${top.rank}위, ${top.wins}승) vs ${bottom.shortName}(${bottom.rank}위) — 업셋의 조건이 보일까.`,
        tone: "buzzer",
        weight: 38,
      });
    } else if (top.rank === 1 && bottom.rank === 2) {
      out.push({
        text: `1위 ${top.shortName} vs 2위 ${bottom.shortName} — 선두권 직접 맞대결.`,
        tone: "flame",
        weight: 48,
      });
    }
  }

  // ── 우선순위 top 3 반환 ──
  out.sort((a, b) => b.weight - a.weight);
  return out.slice(0, 3);
}

// ALL_GAMES 참조 (dead-code 억제용) — teamRecentForm/headToHead 가 내부적으로 사용함
export const _ALL_GAMES_REF = ALL_GAMES;
