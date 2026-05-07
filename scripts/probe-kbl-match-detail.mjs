/**
 * 박스스코어 endpoint 응답 구조 확인 + 매치 리스트의 gameCode 필드 추출
 *
 * 발견된 endpoint (DevTools 분석):
 *   - https://api.kbl.or.kr/match/{gameCode}/team-record
 *   - https://api.kbl.or.kr/match/{gameCode}/player-stat
 *
 * 이 스크립트가 하는 일:
 *   1) data/raw/api/match-list-full.json 에서 sample 게임의 모든 필드 로그
 *      → gameCode/gmKey/matchCode 같은 식별자 찾기
 *   2) 박스스코어 두 endpoint 를 sample 게임으로 호출
 *      → 응답 구조 (선수 boxscore 의 PTS/REB/AST 필드명) 파악
 *   3) /match/{code} 자체 (root) + 다른 sub-paths 도 같이 시도
 *
 * 실행: npm run probe:kbl-match-detail
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";

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

const SAMPLE_CODE = "S47G01N184"; // 2/2 SK vs KCC (사용자 제공)
const SAMPLE_DATE = "20260202";

mkdirSync("data/raw/api", { recursive: true });

// ─── 1) match-list-full.json 의 game 레코드 필드 로그 ───
console.log("━".repeat(72));
console.log("1) 매치 리스트의 game 레코드 필드 확인");
console.log("━".repeat(72));

const matchListPath = "data/raw/api/match-list-full.json";
if (existsSync(matchListPath)) {
  const list = JSON.parse(readFileSync(matchListPath, "utf-8"));
  if (Array.isArray(list) && list.length > 0) {
    console.log(`총 ${list.length}개 게임`);
    // 첫 번째 + 챔결 G1 추정 (5/5) sample 출력
    const samples = [
      list[0],
      list.find((g) => g.gameDate === SAMPLE_DATE) ?? null,
      list.find((g) => g.gameDate === "20260505") ?? null,
    ].filter(Boolean);
    for (const s of samples) {
      console.log(`\n--- ${s.gameDate} ${s.tnameH ?? ""} vs ${s.tnameA ?? ""} ---`);
      console.log(`필드 (${Object.keys(s).length}개):`);
      for (const k of Object.keys(s).sort()) {
        const v = s[k];
        const disp = typeof v === "string" && v.length > 60 ? v.slice(0, 60) + "…" : v;
        console.log(`  ${k.padEnd(22)} = ${JSON.stringify(disp)}`);
      }
    }
  } else {
    console.log("✗ match-list-full.json 비어있거나 형식 이상");
  }
} else {
  console.log("⚠ data/raw/api/match-list-full.json 없음 — npm run fetch:kbl-schedule 먼저");
}

// ─── 2) 박스스코어 endpoint 직접 호출 ───
const TARGETS = [
  // 사용자 제공
  `https://api.kbl.or.kr/match/${SAMPLE_CODE}/team-record`,
  `https://api.kbl.or.kr/match/${SAMPLE_CODE}/player-stat`,
  // 추가 시도
  `https://api.kbl.or.kr/match/${SAMPLE_CODE}`,
  `https://api.kbl.or.kr/match/${SAMPLE_CODE}/preview`,
  `https://api.kbl.or.kr/match/${SAMPLE_CODE}/quarter-score`,
  `https://api.kbl.or.kr/match/${SAMPLE_CODE}/highlight`,
  `https://api.kbl.or.kr/match/${SAMPLE_CODE}/lineup`,
  `https://api.kbl.or.kr/match/${SAMPLE_CODE}/play-by-play`,
  // /pub/ 변형
  `https://api.kbl.or.kr/pub/match/${SAMPLE_CODE}/team-record`,
  `https://api.kbl.or.kr/pub/match/${SAMPLE_CODE}/player-stat`,
  // record/summary 변형 (find:kbl-api 결과)
  `https://api.kbl.or.kr/match/record/${SAMPLE_CODE}`,
  `https://api.kbl.or.kr/match/record/${SAMPLE_CODE}/${SAMPLE_DATE}`,
  `https://api.kbl.or.kr/match/record/summary/${SAMPLE_CODE}/${SAMPLE_DATE}`,
  `https://api.kbl.or.kr/match/record/record/${SAMPLE_CODE}/${SAMPLE_DATE}`,
];

console.log("\n");
console.log("━".repeat(72));
console.log("2) 박스스코어 + 관련 endpoint 호출");
console.log("━".repeat(72));

const successes = [];
for (const url of TARGETS) {
  console.log("\n▶", url);
  try {
    const res = await fetch(url, { headers: HEADERS });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    const ok = res.ok && !text.startsWith("<!DOCTYPE");
    console.log(`  HTTP ${res.status} · ${text.length}자`);
    if (ok && json) {
      const isArr = Array.isArray(json);
      const sz = isArr ? json.length : (json?.data ? (Array.isArray(json.data) ? json.data.length : "obj") : "obj");
      console.log(`  → ${isArr ? "Array" : "Object"} · size=${sz}`);
      // 최상위 키 또는 첫 원소 키 출력
      if (isArr && json.length > 0) {
        console.log(`  첫 원소 키 (${Object.keys(json[0]).length}개):`, Object.keys(json[0]).slice(0, 30).join(", "));
        console.log(`  첫 원소 sample:`, JSON.stringify(json[0]).slice(0, 400));
      } else if (!isArr) {
        console.log(`  최상위 키 (${Object.keys(json).length}개):`, Object.keys(json).slice(0, 30).join(", "));
        if (json?.data) {
          if (Array.isArray(json.data) && json.data[0]) {
            console.log(`  data[0] 키:`, Object.keys(json.data[0]).slice(0, 30).join(", "));
            console.log(`  data[0] sample:`, JSON.stringify(json.data[0]).slice(0, 400));
          } else {
            console.log(`  data sample:`, JSON.stringify(json.data).slice(0, 400));
          }
        }
      }
      successes.push({ url, sample: json });
      // raw 저장
      const fname = url
        .replace(/^https?:\/\//, "")
        .replace(/[^a-zA-Z0-9]/g, "_")
        .slice(0, 100);
      writeFileSync(`data/raw/api/probe-md-${fname}.json`, text);
    } else if (json?.message || json?.detail) {
      console.log(`  ⚠ message: ${json.message ?? json.detail}`);
    } else {
      console.log(`  ✗ 빈 응답 또는 HTML`);
    }
  } catch (err) {
    console.log(`  ✗ ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 100));
}

writeFileSync(
  "data/raw/api/probe-match-detail-results.json",
  JSON.stringify({ successes: successes.map((s) => s.url) }, null, 2),
);

console.log("\n");
console.log("━".repeat(72));
console.log(`✓ 성공 endpoint ${successes.length}/${TARGETS.length}개`);
console.log("저장된 raw 응답: data/raw/api/probe-md-*.json");
console.log("━".repeat(72));
