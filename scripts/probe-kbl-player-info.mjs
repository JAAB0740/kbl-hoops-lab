/**
 * KBL 선수 메타정보 (국적/생년월일/신장/학교/체중/등번호/선수구분) endpoint 탐색
 *
 * 단서 (find:kbl-api 결과):
 *   - /player/info
 *   - /player/player/{playerNo}
 *   - /player/playerRecord
 *   - /draft/player/info
 *
 * 일반 후보:
 *   - /player/list (전체)
 *   - /player/{pcode} (개별)
 *   - 쿼리 파라미터: playerNo, pcode, seasonCode
 *
 * 실행: npm run probe:kbl-player-info
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

const SAMPLE = "291248"; // 자밀 워니 (SK)
const SAMPLE2 = "290450"; // 오세근 (SK) — 한국 선수

const TARGETS = [
  // api.kbl.or.kr 도메인 (find 결과에 base 로 등장)
  `https://api.kbl.or.kr/player/info?playerNo=${SAMPLE}`,
  `https://api.kbl.or.kr/player/info/${SAMPLE}`,
  `https://api.kbl.or.kr/player/player/${SAMPLE}`,
  `https://api.kbl.or.kr/player/player?playerNo=${SAMPLE}`,
  `https://api.kbl.or.kr/player/playerRecord?playerNo=${SAMPLE}`,
  `https://api.kbl.or.kr/player/draft?playerNo=${SAMPLE}`,
  // 전체 리스트
  `https://api.kbl.or.kr/player/list`,
  `https://api.kbl.or.kr/player/list?seasonCode=47`,
  `https://api.kbl.or.kr/common/teamList`,
  // api-stats 도메인
  `https://api-stats.kbl.or.kr/api/records/player/info?playerNo=${SAMPLE}`,
  `https://api-stats.kbl.or.kr/api/records/player/${SAMPLE}/info`,
  `https://api-stats.kbl.or.kr/api/records/player/${SAMPLE}`,
  `https://api-stats.kbl.or.kr/api/players/${SAMPLE}`,
  `https://api-stats.kbl.or.kr/api/players?playerNo=${SAMPLE}`,
  // /pub/ 변형 (find 결과: /pub/match/record/...)
  `https://api.kbl.or.kr/pub/player/info?playerNo=${SAMPLE}`,
  `https://api.kbl.or.kr/pub/player/${SAMPLE}`,
  // Draft endpoint (find 결과: /draft/player/info, /draft/record/list)
  `https://api.kbl.or.kr/draft/player/info?playerNo=${SAMPLE}`,
  // 한국 선수 기준 추가 시도
  `https://api.kbl.or.kr/player/info?playerNo=${SAMPLE2}`,
];

mkdirSync("data/raw/api", { recursive: true });

const successes = [];

for (const url of TARGETS) {
  console.log("\n▶", url);
  try {
    const res = await fetch(url, { headers: HEADERS });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    const isHtml = text.startsWith("<!DOCTYPE") || text.startsWith("<html");
    if (res.ok && json && !isHtml) {
      const isArr = Array.isArray(json);
      const sz = isArr ? json.length : (json?.data ? "data" : "obj");
      console.log(`  HTTP ${res.status} · ${isArr ? "Array" : "Object"} · size=${sz} · ${text.length}자`);
      if (isArr && json.length > 0) {
        console.log(`  첫 원소 키:`, Object.keys(json[0]).slice(0, 25).join(", "));
        console.log(`  sample:`, JSON.stringify(json[0]).slice(0, 500));
      } else if (!isArr) {
        console.log(`  최상위 키:`, Object.keys(json).slice(0, 25).join(", "));
        console.log(`  sample:`, JSON.stringify(json).slice(0, 500));
      }
      successes.push(url);
      const fname = url.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 100);
      writeFileSync(`data/raw/api/probe-pinfo-${fname}.json`, text);
    } else if (json?.message || json?.detail) {
      console.log(`  HTTP ${res.status} ⚠ ${json.message ?? json.detail}`);
    } else {
      console.log(`  HTTP ${res.status} (${text.length}자, ${isHtml ? "HTML" : "empty"})`);
    }
  } catch (err) {
    console.log(`  ✗ ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 100));
}

console.log("\n" + "━".repeat(60));
console.log(`성공 ${successes.length}/${TARGETS.length} · raw 저장: data/raw/api/probe-pinfo-*.json`);
