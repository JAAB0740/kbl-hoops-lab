/**
 * 팀 스탯 동적 fetch — 라운드 + 홈/원정 + 쿼터/전후반 임의 조합 지원
 *
 * GET /api/team-stats?rounds=1,2&venue=home&time=q1&gameCode=01
 *
 * 다중 라운드는 각각 KBL API에 호출 후 games 가중평균으로 결합.
 * traditional + advanced 모두 받아 FilteredTeam 형식으로 반환.
 *
 * 캐싱: Next.js fetch revalidate 1시간 (PO 진행 중 빠른 반영용 — 정규시즌 종료 후 다시 6시간으로 늘려도 됨)
 */

import { NextRequest, NextResponse } from "next/server";

const KBL_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.kbl.or.kr/",
  Origin: "https://www.kbl.or.kr",
  Channel: "WEB",
  TeamCode: "",
};

const TEAM_NAME4_TO_SHORT: Record<string, string> = {
  LG: "LG", DB: "DB", SK: "SK", KCC: "KCC", KT: "KT",
  정관장: "정관장", 소노: "소노", 현대모비스: "현대모비스",
  가스공사: "가스공사", 삼성: "삼성",
  "JUNG KWAN JANG": "정관장", JUNGKWANJANG: "정관장", KGC: "정관장",
  SONO: "소노",
  "HYUNDAI MOBIS": "현대모비스", HYUNDAIMOBIS: "현대모비스", HD: "현대모비스",
  KOGAS: "가스공사", PEGA: "가스공사", KG: "가스공사",
  SAMSUNG: "삼성", SS: "삼성",
};

function normShort(s: string | undefined): string | null {
  if (!s) return null;
  const t = String(s).trim();
  return TEAM_NAME4_TO_SHORT[t] ?? null;
}

interface RawTeamTrad {
  rankNo: number;
  teamCode: string;
  teamName1: string;
  teamName4: string;
  gameCount: number;
  win: number;
  lose: number;
  winA: number;
  score: number;
  aS: number;
  rb: number; oR: number; dR: number;
  sT: number; bS: number;
  fg: number; fgA: number; fgRt: number;
  threep: number; threepA: number; threepRt: number;
  ft: number; ftA: number; ftRt: number;
  tO: number;
  foulTot: number;
  margin: number;
}

interface RawTeamAdv {
  teamCode: string;
  teamName4: string;
  gameCount: number;
  win: number;
  lose: number;
  offrtg: number; defrtg: number; netrtg: number;
  efgRt: number; tsRt: number;
  astRt: number; astTo: number; astRatio: number;
  orebRt: number; drebRt: number; rebRt: number;
  tovRt: number; pace: number;
  pie: number; poss: number;
}

interface NormalizedTeam {
  rank: number;
  code: string;
  name: string;
  shortName: string;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  stats: {
    points: number; assists: number;
    rebounds: number; oReb: number; dReb: number;
    steals: number; blocks: number;
    fgMade: number; fgAtt: number; fgPct: number;
    threeMade: number; threeAtt: number; threePct: number;
    ftMade: number; ftAtt: number; ftPct: number;
    turnovers: number; fouls: number; margin: number;
  };
  advanced?: {
    offRtg: number; defRtg: number; netRtg: number;
    efgPct: number; tsPct: number;
    astPct: number; astTo: number; astRatio: number;
    orebPct: number; drebPct: number; rebPct: number;
    tovPct: number; pace: number;
    pie: number; poss: number;
  };
}

function normalizeTeam(t: RawTeamTrad, a?: RawTeamAdv): NormalizedTeam {
  const short = normShort(t.teamName4) ?? t.teamName4;
  const base: NormalizedTeam = {
    rank: t.rankNo ?? 0,
    code: t.teamCode,
    name: t.teamName1,
    shortName: short,
    games: t.gameCount ?? 0,
    wins: t.win ?? 0,
    losses: t.lose ?? 0,
    winPct: (t.winA ?? 0) / 100,
    stats: {
      points:    t.score ?? 0,
      assists:   t.aS ?? 0,
      rebounds:  t.rb ?? 0,
      oReb:      t.oR ?? 0,
      dReb:      t.dR ?? 0,
      steals:    t.sT ?? 0,
      blocks:    t.bS ?? 0,
      fgMade:    t.fg ?? 0,
      fgAtt:     t.fgA ?? 0,
      fgPct:     t.fgRt ?? 0,
      threeMade: t.threep ?? 0,
      threeAtt:  t.threepA ?? 0,
      threePct:  t.threepRt ?? 0,
      ftMade:    t.ft ?? 0,
      ftAtt:     t.ftA ?? 0,
      ftPct:     t.ftRt ?? 0,
      turnovers: t.tO ?? 0,
      fouls:     t.foulTot ?? 0,
      margin:    t.margin ?? 0,
    },
  };
  if (a) {
    base.advanced = {
      offRtg: a.offrtg, defRtg: a.defrtg, netRtg: a.netrtg,
      efgPct: a.efgRt, tsPct: a.tsRt,
      astPct: a.astRt, astTo: a.astTo, astRatio: a.astRatio,
      orebPct: a.orebRt, drebPct: a.drebRt, rebPct: a.rebRt,
      tovPct: a.tovRt, pace: a.pace,
      pie: a.pie, poss: a.poss,
    };
  }
  return base;
}

function mergeTradAdv(tradList: RawTeamTrad[], advList: RawTeamAdv[]): NormalizedTeam[] {
  const advByCode = new Map<string, RawTeamAdv>();
  for (const a of advList) advByCode.set(String(a.teamCode), a);
  return tradList
    .filter((t) => normShort(t?.teamName4))
    .map((t) => normalizeTeam(t, advByCode.get(String(t.teamCode))));
}

/** 다중 라운드 결과를 games 가중평균으로 합치기 */
function aggregateMulti(lists: NormalizedTeam[][]): NormalizedTeam[] {
  const byCode = new Map<string, NormalizedTeam[]>();
  for (const list of lists) {
    for (const t of list) {
      if (!t.games || t.games <= 0) continue;
      if (!byCode.has(t.code)) byCode.set(t.code, []);
      byCode.get(t.code)!.push(t);
    }
  }
  const out: NormalizedTeam[] = [];
  for (const [, rows] of byCode) {
    if (rows.length === 0) continue;
    const head = rows[0];
    const totalG = rows.reduce((n, r) => n + r.games, 0);
    if (totalG === 0) continue;
    const totalW = rows.reduce((n, r) => n + r.wins, 0);
    const totalL = rows.reduce((n, r) => n + r.losses, 0);
    type StatsKey = keyof NormalizedTeam["stats"];
    const wAvg = (k: StatsKey) =>
      rows.reduce((n, r) => n + (r.stats[k] ?? 0) * r.games, 0) / totalG;
    const wRatio = (mk: StatsKey, ak: StatsKey) => {
      const m = rows.reduce((n, r) => n + (r.stats[mk] ?? 0) * r.games, 0);
      const a = rows.reduce((n, r) => n + (r.stats[ak] ?? 0) * r.games, 0);
      return a > 0 ? (m / a) * 100 : 0;
    };
    type AdvKey = keyof NonNullable<NormalizedTeam["advanced"]>;
    let advanced: NormalizedTeam["advanced"];
    if (rows.every((r) => r.advanced != null)) {
      const wAdv = (k: AdvKey) =>
        rows.reduce((n, r) => n + (r.advanced![k] ?? 0) * r.games, 0) / totalG;
      advanced = {
        offRtg: wAdv("offRtg"), defRtg: wAdv("defRtg"), netRtg: wAdv("netRtg"),
        efgPct: wAdv("efgPct"), tsPct: wAdv("tsPct"),
        astPct: wAdv("astPct"), astTo: wAdv("astTo"), astRatio: wAdv("astRatio"),
        orebPct: wAdv("orebPct"), drebPct: wAdv("drebPct"), rebPct: wAdv("rebPct"),
        tovPct: wAdv("tovPct"), pace: wAdv("pace"),
        pie: wAdv("pie"),
        poss: rows.reduce((n, r) => n + (r.advanced!.poss ?? 0), 0),
      };
    }
    out.push({
      rank: 0,
      code: head.code,
      name: head.name,
      shortName: head.shortName,
      games: totalG,
      wins: totalW,
      losses: totalL,
      winPct: totalG > 0 ? totalW / totalG : 0,
      stats: {
        points:    wAvg("points"),
        assists:   wAvg("assists"),
        rebounds:  wAvg("rebounds"),
        oReb:      wAvg("oReb"),
        dReb:      wAvg("dReb"),
        steals:    wAvg("steals"),
        blocks:    wAvg("blocks"),
        fgMade:    wAvg("fgMade"),
        fgAtt:     wAvg("fgAtt"),
        fgPct:     wRatio("fgMade", "fgAtt"),
        threeMade: wAvg("threeMade"),
        threeAtt:  wAvg("threeAtt"),
        threePct:  wRatio("threeMade", "threeAtt"),
        ftMade:    wAvg("ftMade"),
        ftAtt:     wAvg("ftAtt"),
        ftPct:     wRatio("ftMade", "ftAtt"),
        turnovers: wAvg("turnovers"),
        fouls:     wAvg("fouls"),
        margin:    wAvg("margin"),
      },
      advanced,
    });
  }
  // 승률 desc → 승수 desc (head-to-head 타이브레이커는 클라이언트가 별도 처리하지 않으면 단순 정렬)
  out.sort((a, b) => b.winPct - a.winPct || b.wins - a.wins);
  out.forEach((t, i) => (t.rank = i + 1));
  return out;
}

const TRAD_BASE = "https://api-stats.kbl.or.kr/api/records/team/general/traditional";
const ADV_BASE = "https://api-stats.kbl.or.kr/api/records/team/general/advanced";

async function callKBL(extra: Record<string, string>) {
  const params = new URLSearchParams({
    seasonCode: "47",
    perCn: "1",
    lastCn: "0",
    partIfList: "0",
    draftNo: "0",
    sortDataSc: "WIN_A",
    sortOrderSc: "desc",
    ...extra,
  });
  const tradURL = `${TRAD_BASE}?${params}`;
  const advURL = `${ADV_BASE}?${params}`;
  console.log(`[team-stats] 호출:`, params.toString());
  const [tradRes, advRes] = await Promise.all([
    fetch(tradURL, {
      headers: KBL_HEADERS,
      cache: "no-store", // PO 진행 중 — 캐시 없이 매번 fresh (PO 종료 후 revalidate: 60*60 으로 복귀 권장)
    }),
    fetch(advURL, {
      headers: KBL_HEADERS,
      cache: "no-store", // PO 진행 중 — 캐시 없이 매번 fresh (PO 종료 후 revalidate: 60*60 으로 복귀 권장)
    }),
  ]);
  if (!tradRes.ok) throw new Error(`KBL traditional ${tradRes.status}`);
  const tradJson = await tradRes.json();
  // advanced 호출 실패는 치명적이지 않음 — traditional 만으로도 표시 가능
  let advData: RawTeamAdv[] = [];
  if (advRes.ok) {
    const advJson = await advRes.json();
    advData = (advJson?.data ?? []) as RawTeamAdv[];
  }
  console.log(`[team-stats]   → trad ${(tradJson?.data ?? []).length}팀, adv ${advData.length}팀`);
  return {
    trad: (tradJson?.data ?? []) as RawTeamTrad[],
    adv: advData,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const rounds = (sp.get("rounds") ?? "")
    .split(",")
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => n >= 1 && n <= 6);
  const venue = sp.get("venue") ?? ""; // home | away | ""
  const time = sp.get("time") ?? "";   // q1~q4 | h1 | h2 | ""
  const gameCode = sp.get("gameCode") ?? "01";

  const venueParam: Record<string, string> =
    venue === "home" ? { homeAwaySc: "1" } :
    venue === "away" ? { homeAwaySc: "2" } : {};
  const timeParam: Record<string, string> =
    time === "q1" ? { quarterSc: "Q1" } :
    time === "q2" ? { quarterSc: "Q2" } :
    time === "q3" ? { quarterSc: "Q3" } :
    time === "q4" ? { quarterSc: "Q4" } :
    time === "h1" ? { quarterSc: "Q1,Q2" } :
    time === "h2" ? { quarterSc: "Q3,Q4" } : {};

  try {
    if (rounds.length === 0) {
      const { trad, adv } = await callKBL({ gameCode, ...venueParam, ...timeParam });
      const teams = mergeTradAdv(trad, adv);
      // 단일 호출: 승률 desc 정렬
      teams.sort((a, b) => b.winPct - a.winPct || b.wins - a.wins);
      teams.forEach((t, i) => (t.rank = i + 1));
      return NextResponse.json({ teams });
    }
    // 다중 라운드 → 라운드별로 호출 후 가중평균
    const lists = await Promise.all(
      rounds.map(async (r) => {
        const { trad, adv } = await callKBL({
          gameCode,
          ...venueParam,
          ...timeParam,
          partSc: "ROUND",
          partIfList: String(r),
        });
        return mergeTradAdv(trad, adv);
      }),
    );
    const teams = aggregateMulti(lists);
    return NextResponse.json({ teams });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: msg, teams: [] },
      { status: 500 },
    );
  }
}
