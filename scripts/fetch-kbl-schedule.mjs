/**
 * KBL 일정 API 자동 fetch
 *
 * GET https://api.kbl.or.kr/match/list?seasonCode=47&fromDate=YYYYMMDD&toDate=YYYYMMDD
 *
 * 필수 헤더:
 *   Channel: WEB
 *   TeamCode: ""        (빈 문자열도 통과)
 *   Origin/Referer:     www.kbl.or.kr
 *
 * 출력: data/games.json (기존 parse:kbl-schedule 호환 포맷)
 *
 * 실행: npm run fetch:kbl-schedule
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { mkdirSync, writeFileSync } from "node:fs";

const SEASON = "47"; // KBL 본선 (D리그는 48)
const SEASON_FROM = "20251001";
const SEASON_TO = "20260630";
const URL = `https://api.kbl.or.kr/match/list?seasonCode=${SEASON}&fromDate=${SEASON_FROM}&toDate=${SEASON_TO}`;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9",
  Referer: "https://www.kbl.or.kr/",
  Origin: "https://www.kbl.or.kr",
  Channel: "WEB",
  TeamCode: "",
};

// 짧은 이름 → 풀네임 매핑 (혹시 API의 tnameFH가 비는 경우 대비)
const FULL_NAME = {
  LG: "창원 LG",
  정관장: "안양 정관장",
  DB: "원주 DB",
  SK: "서울 SK",
  소노: "고양 소노",
  KCC: "부산 KCC",
  KT: "수원 KT",
  현대모비스: "울산 현대모비스",
  가스공사: "대구 한국가스공사",
  삼성: "서울 삼성",
};

// KBL API tnameH가 풀네임("창원 LG") 또는 약어("LG")로 오는 경우 모두 단축명으로 정규화
// (standings.shortName과 동일하게 맞춰서 PlayoffBracket 등에서 매칭 가능)
const FULL_TO_SHORT = {
  // 약어는 그대로
  LG: "LG", DB: "DB", SK: "SK", KCC: "KCC", KT: "KT",
  소노: "소노", 정관장: "정관장", 현대모비스: "현대모비스",
  가스공사: "가스공사", 삼성: "삼성",
  // 풀네임 → 약어
  "창원 LG": "LG",
  "안양 정관장": "정관장",
  "원주 DB": "DB",
  "서울 SK": "SK",
  "고양 소노": "소노",
  "부산 KCC": "KCC",
  "수원 KT": "KT",
  "울산 현대모비스": "현대모비스",
  "대구 한국가스공사": "가스공사",
  "서울 삼성": "삼성",
};
function toShort(s) {
  if (!s) return "";
  return FULL_TO_SHORT[String(s).trim()] ?? String(s).trim();
}

function fmtDate(yyyymmdd) {
  if (!/^\d{8}$/.test(yyyymmdd)) return null;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function fmtTime(hhmm) {
  if (!/^\d{3,4}$/.test(hhmm)) return null;
  const padded = hhmm.padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

function tagFor(seasonCategory, seasonCategoryName, dateStr) {
  // seasonCategoryName: 정규시즌 | 플레이오프 | 챔피언결정전 (추정)
  if (seasonCategoryName === "정규시즌" || seasonCategory === "R") {
    return "정규리그";
  }
  if (seasonCategoryName === "챔피언결정전" || seasonCategory === "CF") {
    return "챔피언결정전";
  }
  if (seasonCategoryName === "플레이오프" || seasonCategory === "PO") {
    // 라운드 분기는 날짜 기반 (KBL 2025-26 일정 기준)
    if (!dateStr) return "플레이오프";
    const md = dateStr.slice(5);
    if (md <= "04-17") return "6강 PO";
    if (md <= "04-30") return "4강 PO";
    return "챔피언결정전";
  }
  return seasonCategoryName ?? "";
}

console.log(`[1/3] 호출: ${URL}`);
const res = await fetch(URL, { headers: HEADERS });
if (!res.ok) {
  console.error(`✗ HTTP ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}
const json = await res.json();
if (!Array.isArray(json)) {
  console.error("✗ 예상한 배열 형태가 아닙니다.");
  console.error(JSON.stringify(json).slice(0, 300));
  process.exit(1);
}
console.log(`  → ${json.length}개 응답`);

console.log(`\n[2/3] 변환 + 본선만 필터 (seasonCode=${SEASON})`);
const games = [];
let skipped = 0;
for (const g of json) {
  if (Number(g.seasonCode) !== Number(SEASON)) {
    skipped++;
    continue;
  }
  const date = fmtDate(g.gameDate);
  const time = fmtTime(g.gameStart);
  const tag = tagFor(g.seasonCategory, g.seasonCategoryName, date);
  const isFinal = g.isEnded === 1;
  const homeShort = toShort(g.tnameH);
  const awayShort = toShort(g.tnameA);
  games.push({
    gmkey: g.gmkey,            // 박스스코어 fetch 식별자 (예: "S47G01N184")
    date,
    time,
    tag,
    homeTeam: g.tnameFH || FULL_NAME[homeShort] || g.tnameH,
    homeShort,
    awayTeam: g.tnameFA || FULL_NAME[awayShort] || g.tnameA,
    awayShort,
    homeScore: isFinal ? g.scoreH : null,
    awayScore: isFinal ? g.scoreA : null,
    status: isFinal ? "final" : "scheduled",
    stadium: g.stadiumnameF || g.stadiumname || "",  // 경기장 (보너스 데이터)
  });
}
console.log(`  → 본선 ${games.length}개 / 제외(D리그 등) ${skipped}개`);

// 정렬
games.sort((a, b) => {
  const k = (x) => (x.date ?? "9999-99-99") + " " + (x.time ?? "99:99");
  return k(a).localeCompare(k(b));
});

// 진단 출력 — 오늘 이후 경기와 PO 경기
const today = new Date().toISOString().slice(0, 10);
const upcoming = games.filter((g) => g.date >= today).slice(0, 10);
console.log(`\n[3/3] 오늘(${today}) 이후 경기 (최대 10개)`);
for (const g of upcoming) {
  const sc = g.homeScore != null ? ` ${g.homeScore}:${g.awayScore}` : "";
  console.log(
    `  ${g.date} ${g.time ?? "??:??"} · ${(g.tag || "?").padEnd(8)} · ${g.homeShort.padEnd(6)} vs ${g.awayShort.padEnd(6)}${sc} · ${g.status}`,
  );
}

const poGames = games.filter((g) => /PO|챔피언/.test(g.tag));
console.log(`\n  플레이오프/CF 경기 (${poGames.length}개):`);
for (const g of poGames) {
  const sc = g.homeScore != null ? ` ${g.homeScore}:${g.awayScore}` : "";
  console.log(
    `  ${g.date} ${g.time ?? "??:??"} · ${(g.tag || "?").padEnd(8)} · ${g.homeShort.padEnd(6)} vs ${g.awayShort.padEnd(6)}${sc} · ${g.status}`,
  );
}

mkdirSync("data", { recursive: true });
writeFileSync(
  "data/games.json",
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      sourceFile: URL,
      totalGames: games.length,
      games,
    },
    null,
    2,
  ),
);
console.log(`\n✓ data/games.json 저장 (${games.length}개)`);

// raw도 저장
mkdirSync("data/raw/api", { recursive: true });
writeFileSync(
  "data/raw/api/match-list-full.json",
  JSON.stringify(json, null, 2),
);
console.log(`✓ data/raw/api/match-list-full.json 저장 (전체 응답)`);
