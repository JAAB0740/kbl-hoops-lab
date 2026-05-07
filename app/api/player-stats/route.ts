/**
 * 선수 스탯 동적 fetch — 라운드 + 홈/원정 + 쿼터/전후반 임의 조합 지원
 *
 * GET /api/player-stats?rounds=1,2&venue=home&time=q1&gameCode=01
 *
 * 다중 라운드는 각각 KBL API에 호출 후 games 가중평균으로 결합.
 * traditional + advanced 모두 받아 RawPlayer 형식으로 반환.
 *
 * 캐싱: Next.js fetch unstable_cache 사용 + revalidate 1일
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

function normShort(s: string | undefined): string {
  if (!s) return "";
  const t = String(s).trim();
  return TEAM_NAME4_TO_SHORT[t] ?? t;
}

interface RawTrad {
  rankNo: number;
  playerNo: string | number;
  kname: string;
  ename: string;
  teamCode: string;
  teamName1: string;
  teamName4: string;
  gameCount: number;
  win: number;
  lose: number;
  playSec: number;
  score: number;
  fg: number; fgA: number; fgRt: number;
  threep: number; threepA: number; threepRt: number;
  fdg: number; fdgA: number; fdgRt: number;
  ft: number; ftA: number; ftRt: number;
  rb: number; oR: number; dR: number;
  aS: number; sT: number; bS: number;
  tO: number; foul: number;
}

interface RawAdv {
  playerNo: string | number;
  perRt: number;
  offrtg: number; defrtg: number; netrtg: number;
  efgRt: number; tsRt: number;
  astRt: number; astTo: number; astRatio: number;
  orebRt: number; drebRt: number; rebRt: number;
  usgRt: number; pace: number;
  tovRt: number; toRatio: number;
  pie: number; poss: number;
}

interface NormalizedPlayer {
  rank: number;
  name: string;
  team: string;
  playerNo: string;
  games: number;
  stats: {
    minutes: number; points: number;
    assists: number; rebounds: number; oReb: number; dReb: number;
    steals: number; blocks: number;
    fgMade: number; fgAtt: number; fgPct: number;
    threeMade: number; threePA: number; threePct: number;
    twoPM: number; twoPA: number; twoPct: number;
    ftMade: number; ftAtt: number; ftPct: number;
    turnovers: number; fouls: number;
  };
  advanced?: {
    per: number; offRtg: number; defRtg: number; netRtg: number;
    efgPct: number; tsPct: number;
    astPct: number; astTo: number; astRatio: number;
    orebPct: number; drebPct: number; rebPct: number;
    usgPct: number; pace: number;
    tovPct: number; toRatio: number; pie: number; poss: number;
  };
}

function normalizePlayer(t: RawTrad, a?: RawAdv): NormalizedPlayer {
  const base: NormalizedPlayer = {
    rank: t.rankNo,
    name: t.kname,
    team: normShort(t.teamName4),
    playerNo: String(t.playerNo),
    games: t.gameCount,
    stats: {
      minutes: (t.playSec ?? 0) / 60,
      points: t.score ?? 0,
      assists: t.aS ?? 0,
      rebounds: t.rb ?? 0,
      oReb: t.oR ?? 0,
      dReb: t.dR ?? 0,
      steals: t.sT ?? 0,
      blocks: t.bS ?? 0,
      fgMade: t.fg ?? 0,
      fgAtt: t.fgA ?? 0,
      fgPct: t.fgRt ?? 0,
      threeMade: t.threep ?? 0,
      threePA: t.threepA ?? 0,
      threePct: t.threepRt ?? 0,
      twoPM: t.fdg ?? 0,
      twoPA: t.fdgA ?? 0,
      twoPct: t.fdgRt ?? 0,
      ftMade: t.ft ?? 0,
      ftAtt: t.ftA ?? 0,
      ftPct: t.ftRt ?? 0,
      turnovers: t.tO ?? 0,
      fouls: t.foul ?? 0,
    },
  };
  if (a) {
    base.advanced = {
      per: a.perRt, offRtg: a.offrtg, defRtg: a.defrtg, netRtg: a.netrtg,
      efgPct: a.efgRt, tsPct: a.tsRt,
      astPct: a.astRt, astTo: a.astTo, astRatio: a.astRatio,
      orebPct: a.orebRt, drebPct: a.drebRt, rebPct: a.rebRt,
      usgPct: a.usgRt, pace: a.pace,
      tovPct: a.tovRt, toRatio: a.toRatio, pie: a.pie, poss: a.poss,
    };
  }
  return base;
}

function mergeTradAdv(tradList: RawTrad[], advList: RawAdv[]): NormalizedPlayer[] {
  const advMap = new Map<string, RawAdv>();
  for (const a of advList) advMap.set(String(a.playerNo), a);
  return tradList
    .filter((t) => t?.kname)
    .map((t) => normalizePlayer(t, advMap.get(String(t.playerNo))));
}

/** 다중 라운드 결과를 games 가중평균으로 합치기 */
function aggregateMulti(lists: NormalizedPlayer[][]): NormalizedPlayer[] {
  const byKey = new Map<string, NormalizedPlayer[]>();
  for (const list of lists) {
    for (const p of list) {
      if (!p.games || p.games <= 0) continue;
      const k = p.playerNo;
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(p);
    }
  }
  const out: NormalizedPlayer[] = [];
  for (const [, rows] of byKey) {
    if (rows.length === 0) continue;
    const head = rows[0];
    const totalG = rows.reduce((n, r) => n + r.games, 0);
    if (totalG === 0) continue;
    type StatsKey = keyof NormalizedPlayer["stats"];
    const wAvg = (k: StatsKey) =>
      rows.reduce((n, r) => n + (r.stats[k] ?? 0) * r.games, 0) / totalG;
    const wRatio = (mk: StatsKey, ak: StatsKey) => {
      const m = rows.reduce((n, r) => n + (r.stats[mk] ?? 0) * r.games, 0);
      const a = rows.reduce((n, r) => n + (r.stats[ak] ?? 0) * r.games, 0);
      return a > 0 ? (m / a) * 100 : 0;
    };
    type AdvKey = keyof NonNullable<NormalizedPlayer["advanced"]>;
    let advanced: NormalizedPlayer["advanced"];
    if (rows.every((r) => r.advanced != null)) {
      const wAdv = (k: AdvKey) =>
        rows.reduce((n, r) => n + (r.advanced![k] ?? 0) * r.games, 0) / totalG;
      advanced = {
        per: wAdv("per"), offRtg: wAdv("offRtg"), defRtg: wAdv("defRtg"),
        netRtg: wAdv("netRtg"), efgPct: wAdv("efgPct"), tsPct: wAdv("tsPct"),
        astPct: wAdv("astPct"), astTo: wAdv("astTo"), astRatio: wAdv("astRatio"),
        orebPct: wAdv("orebPct"), drebPct: wAdv("drebPct"), rebPct: wAdv("rebPct"),
        usgPct: wAdv("usgPct"), pace: wAdv("pace"),
        tovPct: wAdv("tovPct"), toRatio: wAdv("toRatio"),
        pie: wAdv("pie"),
        poss: rows.reduce((n, r) => n + (r.advanced!.poss ?? 0), 0),
      };
    }
    out.push({
      rank: 0,
      name: head.name,
      team: head.team,
      playerNo: head.playerNo,
      games: totalG,
      advanced,
      stats: {
        minutes: wAvg("minutes"),
        points: wAvg("points"),
        assists: wAvg("assists"),
        rebounds: wAvg("rebounds"),
        oReb: wAvg("oReb"),
        dReb: wAvg("dReb"),
        steals: wAvg("steals"),
        blocks: wAvg("blocks"),
        fgMade: wAvg("fgMade"),
        fgAtt: wAvg("fgAtt"),
        fgPct: wRatio("fgMade", "fgAtt"),
        threeMade: wAvg("threeMade"),
        threePA: wAvg("threePA"),
        threePct: wRatio("threeMade", "threePA"),
        twoPM: wAvg("twoPM"),
        twoPA: wAvg("twoPA"),
        twoPct: wRatio("twoPM", "twoPA"),
        ftMade: wAvg("ftMade"),
        ftAtt: wAvg("ftAtt"),
        ftPct: wRatio("ftMade", "ftAtt"),
        turnovers: wAvg("turnovers"),
        fouls: wAvg("fouls"),
      },
    });
  }
  out.sort((a, b) => b.stats.points - a.stats.points);
  out.forEach((p, i) => (p.rank = i + 1));
  return out;
}

const TRAD_BASE = "https://api-stats.kbl.or.kr/api/records/player/general/traditional";
const ADV_BASE = "https://api-stats.kbl.or.kr/api/records/player/general/advanced";

async function callKBL(extra: Record<string, string>) {
  const params = new URLSearchParams({
    seasonCode: "47",
    perCn: "1",
    lastCn: "0",
    partIfList: "0",
    draftNo: "0",
    ...extra,
  });
  const tradURL = `${TRAD_BASE}?${params}`;
  const advURL = `${ADV_BASE}?${params}`;
  console.log(`[player-stats] 호출:`, params.toString());
  const [tradRes, advRes] = await Promise.all([
    fetch(tradURL, {
      headers: KBL_HEADERS,
      next: { revalidate: 60 * 60 }, // 1시간 캐싱 (PO 진행 중 빠른 반영용)
    }),
    fetch(advURL, {
      headers: KBL_HEADERS,
      next: { revalidate: 60 * 60 },
    }),
  ]);
  if (!tradRes.ok) throw new Error(`KBL traditional ${tradRes.status}`);
  if (!advRes.ok) throw new Error(`KBL advanced ${advRes.status}`);
  const tradJson = await tradRes.json();
  const advJson = await advRes.json();
  const tradLen = (tradJson?.data ?? []).length;
  const advLen = (advJson?.data ?? []).length;
  console.log(`[player-stats]   → trad ${tradLen}명, adv ${advLen}명`);
  return {
    trad: (tradJson?.data ?? []) as RawTrad[],
    adv: (advJson?.data ?? []) as RawAdv[],
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
      const players = mergeTradAdv(trad, adv);
      return NextResponse.json({ players });
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
    const players = aggregateMulti(lists);
    return NextResponse.json({ players });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: msg, players: [] },
      { status: 500 },
    );
  }
}
