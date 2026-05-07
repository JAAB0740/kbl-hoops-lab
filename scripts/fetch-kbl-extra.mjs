/**
 * KBL 추가 stat fetch — clutch / hustle / four-factors
 *
 * GET /api/records/player/clutch/traditional  (박빙 시 stats)
 * GET /api/records/player/hustle               (스크린어시·디플렉션)
 * GET /api/records/team/general/four-factors   (정식 4팩터)
 *
 * 출력:
 *   data/clutch.json
 *   data/hustle.json
 *   data/four-factors.json
 *
 * 실행: npm run fetch:kbl-extra
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { mkdirSync, writeFileSync } from "node:fs";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.kbl.or.kr/",
  Origin: "https://www.kbl.or.kr",
  Channel: "WEB",
  TeamCode: "",
};

const BASE = "https://api-stats.kbl.or.kr/api/records";
const COMMON = {
  seasonCode: "47",
  perCn: "1",
  lastCn: "0",
  partIfList: "0",
  draftNo: "0",
};

function buildUrl(path, extra) {
  const p = { ...COMMON, ...extra };
  return BASE + path + "?" + Object.entries(p).map(([k, v]) => `${k}=${v}`).join("&");
}

const TEAM_NAME4_TO_SHORT = {
  LG: "LG", DB: "DB", SK: "SK", KCC: "KCC", KT: "KT",
  정관장: "정관장", 소노: "소노", 현대모비스: "현대모비스",
  가스공사: "가스공사", 삼성: "삼성",
  "JUNG KWAN JANG": "정관장", JUNGKWANJANG: "정관장", KGC: "정관장",
  SONO: "소노",
  "HYUNDAI MOBIS": "현대모비스", HYUNDAIMOBIS: "현대모비스", HD: "현대모비스",
  KOGAS: "가스공사", PEGA: "가스공사", KG: "가스공사",
  SAMSUNG: "삼성", SS: "삼성",
};
function normShort(s) {
  if (!s) return s;
  return TEAM_NAME4_TO_SHORT[String(s).trim()] ?? String(s).trim();
}

async function fetchJSON(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return j?.data ?? [];
}

mkdirSync("data", { recursive: true });

// ─── 1) Clutch (박빙 시 선수 stats) ─────────────
console.log("[1/3] Clutch — 박빙 시 선수 stats");
const clutchRegular = await fetchJSON(
  buildUrl("/player/clutch/traditional", { gameCode: "01" }),
).catch(() => []);
const clutchPlayoff = await fetchJSON(
  buildUrl("/player/clutch/traditional", { gameCode: "03" }),
).catch(() => []);

function normClutchPlayer(r) {
  return {
    rank: r.rankNo,
    playerNo: String(r.playerNo),
    kname: r.kname,
    ename: r.ename,
    teamCode: r.teamCode,
    teamName1: r.teamName1,
    teamName4: normShort(r.teamName4),
    games: r.gameCount,
    wins: r.win,
    losses: r.lose,
    minutes: (r.playSec ?? 0) / 60,
    points: r.score ?? 0,
    fgMade: r.fg ?? 0, fgAtt: r.fgA ?? 0, fgPct: r.fgRt ?? 0,
    threeMade: r.threep ?? 0, threeAtt: r.threepA ?? 0, threePct: r.threepRt ?? 0,
    ftMade: r.ft ?? 0, ftAtt: r.ftA ?? 0, ftPct: r.ftRt ?? 0,
    rebounds: r.rb ?? 0,
    assists: r.aS ?? 0,
    steals: r.sT ?? 0,
    blocks: r.bS ?? 0,
    turnovers: r.tO ?? 0,
  };
}

writeFileSync(
  "data/clutch.json",
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      source: "api-stats.kbl.or.kr/api/records/player/clutch/traditional",
      players: {
        regular: clutchRegular.map(normClutchPlayer),
        playoff: clutchPlayoff.map(normClutchPlayer),
      },
    },
    null, 2,
  ),
);
console.log(`  ✓ data/clutch.json — 정규 ${clutchRegular.length}명, PO ${clutchPlayoff.length}명`);

// ─── 2) Hustle (선수 허슬 stats) ──────────────
console.log("\n[2/3] Hustle — 스크린어시·디플렉션");
const hustleRegular = await fetchJSON(
  buildUrl("/player/hustle", { gameCode: "01" }),
).catch(() => []);
const hustlePlayoff = await fetchJSON(
  buildUrl("/player/hustle", { gameCode: "03" }),
).catch(() => []);

function normHustlePlayer(r) {
  return {
    rank: r.rankNo,
    playerNo: String(r.playerNo),
    kname: r.kname,
    ename: r.ename,
    teamCode: r.teamCode,
    teamName1: r.teamName1,
    teamName4: normShort(r.teamName4),
    games: r.gameCount,
    minutes: (r.playSec ?? 0) / 60,
    screenAssists: r.sA ?? 0,        // 스크린어시 (스크린으로 만든 어시)
    screenAssistsPts: r.sAScoreCn ?? 0,
    deflections: r.df ?? 0,           // 디플렉션
  };
}

writeFileSync(
  "data/hustle.json",
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      source: "api-stats.kbl.or.kr/api/records/player/hustle",
      players: {
        regular: hustleRegular.map(normHustlePlayer),
        playoff: hustlePlayoff.map(normHustlePlayer),
      },
    },
    null, 2,
  ),
);
console.log(`  ✓ data/hustle.json — 정규 ${hustleRegular.length}명, PO ${hustlePlayoff.length}명`);

// ─── 3) Four Factors (팀) ─────────────────────
console.log("\n[3/3] Four Factors — 팀 정식 4팩터");
const ffRegular = await fetchJSON(
  buildUrl("/team/general/four-factors", { gameCode: "01" }),
).catch(() => []);
const ffPlayoff = await fetchJSON(
  buildUrl("/team/general/four-factors", { gameCode: "03" }),
).catch(() => []);

function normFFTeam(r) {
  return {
    rank: r.rankNo,
    code: r.teamCode,
    name: r.teamName1,
    shortName: normShort(r.teamName4),
    games: r.gameCount,
    wins: r.win,
    losses: r.lose,
    own: {
      efgPct: r.efgRt,    // eFG% (자기 팀)
      ftaRt: r.ftaRt,     // 자유투 시도율 (FT/FGA)
      tovPct: r.tovRt,    // 턴오버 비율
      orebPct: r.orebRt,  // 공격 리바 비율
    },
    opp: {
      efgPct: r.oppEfgRt,
      ftaRt: r.oppFtaRt,
      tovPct: r.oppTovRt,
      orebPct: r.oppOrebRt,
    },
  };
}

writeFileSync(
  "data/four-factors.json",
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      source: "api-stats.kbl.or.kr/api/records/team/general/four-factors",
      teams: {
        regular: ffRegular.map(normFFTeam),
        playoff: ffPlayoff.map(normFFTeam),
      },
    },
    null, 2,
  ),
);
console.log(`  ✓ data/four-factors.json — 정규 ${ffRegular.length}팀, PO ${ffPlayoff.length}팀`);

// 샘플
const wonny = clutchRegular.find((p) => p.kname === "자밀 워니");
if (wonny) {
  console.log(`\n샘플 — 자밀 워니 박빙 시 stats:`);
  console.log(`  ${wonny.gameCount}G · ${(wonny.score ?? 0).toFixed(1)}점 · FG ${(wonny.fgRt ?? 0).toFixed(1)}%`);
}
const lg = ffRegular.find((t) => normShort(t.teamName4) === "LG");
if (lg) {
  console.log(`\n샘플 — LG 4팩터:`);
  console.log(`  자기: eFG ${lg.efgRt.toFixed(1)}% · FTr ${lg.ftaRt.toFixed(1)}% · TOV ${lg.tovRt.toFixed(1)}% · ORB ${lg.orebRt.toFixed(1)}%`);
  console.log(`  상대: eFG ${lg.oppEfgRt.toFixed(1)}% · FTr ${lg.oppFtaRt.toFixed(1)}% · TOV ${lg.oppTovRt.toFixed(1)}% · ORB ${lg.oppOrebRt.toFixed(1)}%`);
}
