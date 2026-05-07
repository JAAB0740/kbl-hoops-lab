/**
 * KBL 박스스코어 (게임별 선수 boxscore + 팀 boxscore + 쿼터별 스코어) endpoint 탐색
 *
 * 힌트:
 *   - 웹 URL: https://www.kbl.or.kr/match/record/S47G01N256/20260401
 *   - gameCode 형식: S47G01N256 = Season 47 + Game type 01 (regular) + Number 256
 *
 * 시도할 패턴:
 *   - /api/match/* + /api/games/*
 *   - /api/records/match/* + /api/records/game/*
 *   - boxscore / box / record / detail / play / pbp
 *   - matchCode / gameCode / id 파라미터
 *   - 다른 base host: kbl-api.sports2i.com
 *
 * 실행: npm run probe:kbl-boxscore
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

// 알려진 게임 — 챔결 G1 (어제, 5/5)
// URL: https://www.kbl.or.kr/match/record/...
// 시즌 47 챔결이므로 gameCode 04 추정
const SAMPLE_GAMES = [
  { code: "S47G01N256", date: "20260401", desc: "정규 N256 (4월 1일)" },
  { code: "S47G04N001", date: "20260505", desc: "챔결 G1 추정 (5월 5일)" },
  { code: "S47G04N1",   date: "20260505", desc: "챔결 G1 N1 형식" },
  // 옛 시즌 (캐싱/완전성 차원)
  { code: "S46G04N007", date: "20250515", desc: "지난시즌 챔결 추정" },
];

const BASES = [
  "https://api-stats.kbl.or.kr/api",
  "https://api.kbl.or.kr",
  "https://kbl-api.sports2i.com/api",
];

// path 후보 — {code} 와 {date} placeholder
const PATHS = [
  // RESTful 스타일
  "/match/{code}",
  "/match/{code}/{date}",
  "/match/{code}/boxscore",
  "/match/record/{code}",
  "/match/record/{code}/{date}",
  "/match/box/{code}",
  "/match/detail/{code}",
  "/games/{code}",
  "/games/{code}/box",
  "/games/{code}/boxscore",
  // records/match 패턴
  "/records/match/{code}",
  "/records/match/box/{code}",
  "/records/match/general/traditional",
  "/records/match/player/traditional",
  "/records/match/team/traditional",
  "/records/game/{code}",
  "/records/game/{code}/box",
  // boxscore 명시
  "/boxscore/{code}",
  "/box/{code}",
  // 쿼리 파라미터 스타일 (gameCode, matchCode, id)
  "/match",
  "/match/box",
  "/match/record",
  "/match/detail",
  "/records/match/box",
  "/records/match/detail",
  "/games",
  "/box",
];

const QUERY_VARIANTS = [
  // 빈 문자열 = path 만 시도
  "",
  "?gameCode={code}",
  "?gameCode={code}&gameDate={date}",
  "?matchCode={code}",
  "?matchCode={code}&matchDate={date}",
  "?id={code}",
  "?gameId={code}",
  "?seasonCode=47&gameCode={code}",
  "?seasonCode=47&matchCode={code}&gameDate={date}",
];

mkdirSync("data/raw/api", { recursive: true });

const successes = [];
const interesting = [];

async function tryUrl(url, sample, attempt = 0) {
  try {
    const res = await fetch(url, { headers: HEADERS });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}

    const ok = res.ok && text.length > 50 && !text.startsWith("<!DOCTYPE");
    const isHtml = text.startsWith("<!DOCTYPE") || text.startsWith("<html");
    const dataLen =
      Array.isArray(json?.data) ? json.data.length : (json?.data ? "obj" : 0);

    if (ok && json && (dataLen === "obj" || dataLen > 0)) {
      console.log(`  ✓ HTTP ${res.status} · JSON · data=${dataLen} · ${text.length}자`);
      successes.push({ url, sample, status: res.status, dataLen });
      // 처음 200자만 미리보기
      const preview = JSON.stringify(json).slice(0, 300);
      console.log(`    preview: ${preview}…`);
      // raw 저장
      const fname = url
        .replace(/^https?:\/\//, "")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .slice(0, 100);
      writeFileSync(`data/raw/api/probe-box-${fname}.json`, text);
      return true;
    } else if (ok && json && !isHtml) {
      // JSON 응답이지만 data 비어있음 — endpoint 는 존재
      console.log(`  ⚠ HTTP ${res.status} · JSON 빈 응답 · ${text.length}자`);
      if (json.message) console.log(`    message: ${json.message}`);
      if (json.detail) console.log(`    detail: ${String(json.detail).slice(0, 150)}`);
      interesting.push({ url, sample, status: res.status, message: json.message });
    } else if (res.status >= 400 && res.status < 500 && res.status !== 404) {
      // 405, 401, 400 등은 endpoint 가 존재할 수도
      console.log(`  ⚠ HTTP ${res.status} (endpoint may exist)`);
      if (json?.message) console.log(`    message: ${json.message}`);
      interesting.push({ url, sample, status: res.status });
    } else {
      // 404 또는 HTML — 조용히
    }
    return false;
  } catch (err) {
    // network error
    return false;
  }
}

console.log("━".repeat(72));
console.log("KBL 박스스코어 endpoint probe");
console.log("━".repeat(72));
console.log(`Bases: ${BASES.length} · Paths: ${PATHS.length} · Queries: ${QUERY_VARIANTS.length} · Samples: ${SAMPLE_GAMES.length}`);
console.log(`Total combinations: ${BASES.length * PATHS.length * QUERY_VARIANTS.length * SAMPLE_GAMES.length}`);
console.log("");

let attempted = 0;

for (const sample of SAMPLE_GAMES) {
  console.log(`\n━━ Sample: ${sample.desc} (${sample.code}, ${sample.date}) ━━`);
  for (const base of BASES) {
    for (const path of PATHS) {
      for (const q of QUERY_VARIANTS) {
        const fullPath = path.replace("{code}", sample.code).replace("{date}", sample.date);
        const fullQ = q.replace("{code}", sample.code).replace("{date}", sample.date);
        const url = `${base}${fullPath}${fullQ}`;
        // 중복 호출 방지: path 에 placeholder 가 없는데 query 에도 없으면 의미 없음
        if (!path.includes("{") && !q.includes("{")) continue;
        attempted++;
        const found = await tryUrl(url, sample);
        if (found) {
          // 한 번 성공하면 다음 sample 로 (시간 절약)
          // break;
        }
        // rate limiting
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  }
}

console.log("");
console.log("━".repeat(72));
console.log(`총 시도: ${attempted}, 성공: ${successes.length}, 의심 endpoint: ${interesting.length}`);
console.log("━".repeat(72));

if (successes.length > 0) {
  console.log("\n✓ 발견된 endpoint:");
  for (const s of successes) {
    console.log(`  · ${s.url}`);
    console.log(`    sample=${s.sample.desc}, data=${s.dataLen}`);
  }
}

if (interesting.length > 0) {
  console.log("\n⚠ 추가 조사 필요 (4xx 응답):");
  for (const i of interesting.slice(0, 20)) {
    console.log(`  · ${i.url}`);
    console.log(`    status=${i.status}${i.message ? ", message=" + i.message : ""}`);
  }
}

writeFileSync(
  "data/raw/api/probe-boxscore-results.json",
  JSON.stringify({ successes, interesting, attempted }, null, 2),
);
console.log("\n✓ 결과 저장: data/raw/api/probe-boxscore-results.json");
