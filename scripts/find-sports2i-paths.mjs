/**
 * KBL이 슛차트 데이터를 가져오는 sports2i.com main.js 분석
 *
 * 발견된 호스트: kbl-data.sports2i.com
 * 안의 main.js가 fetch하는 endpoint를 찾기
 *
 * 실행: npm run find:sports2i
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { writeFileSync } from "node:fs";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
  Referer: "https://www.kbl.or.kr/",
};

console.log("[1/2] sports2i main.js 다운로드...");
const url = "https://kbl-data.sports2i.com/kbl/main.js";
const res = await fetch(url, { headers: HEADERS });
const js = await res.text();
console.log(`  → ${js.length.toLocaleString()}자`);

console.log("\n[2/2] 단서 추출\n");

// 도메인
const domains = new Set();
for (const m of js.matchAll(/(?:https?:)?\/\/([a-z0-9.-]+\.[a-z]{2,})(?=[^a-z]|$)/gi)) {
  domains.add(m[1].toLowerCase());
}
console.log(`도메인: ${[...domains].join(", ")}`);
console.log();

// URL 패턴
const urlRe = /https?:\/\/[a-zA-Z0-9.\-]+\.[a-z]{2,}[\/a-zA-Z0-9._\-?=&{}%]*/g;
const urls = Array.from(new Set(js.match(urlRe) ?? []));
console.log(`전체 URL ${urls.length}개:`);
for (const u of urls) console.log(`  ${u}`);
console.log();

// path 패턴
const PATHS = [
  /\/data\/[a-zA-Z0-9/_\-{}.]{2,}/g,
  /\/api\/[a-zA-Z0-9/_\-{}.]{2,}/g,
  /\/json\/[a-zA-Z0-9/_\-{}.]{2,}/g,
  /\/get[A-Z][a-zA-Z]+/g,
  /\/g[0-9]{2}\/[a-zA-Z0-9/_\-{}.]{2,}/gi,
  /\/[A-Z][a-zA-Z0-9_\-]+\/[A-Z][a-zA-Z0-9_\-]+\.json/g,
];
const paths = new Set();
for (const re of PATHS) {
  for (const m of js.matchAll(re)) {
    paths.add(m[0]);
  }
}
console.log(`데이터 path ${paths.size}개:`);
for (const p of [...paths].sort()) console.log(`  ${p}`);
console.log();

// 슛차트 / 게임 관련 키워드 컨텍스트
const KEYWORDS = ["shot", "Shot", "shotChart", "ShotChart", "zone", "Zone", "court", "Court", "gmkey", "GMKEY", "playByPlay", "PlayByPlay"];
console.log("키워드 컨텍스트 (앞뒤 50자):");
for (const kw of KEYWORDS) {
  let from = 0, count = 0;
  while (count < 5) {
    const i = js.indexOf(kw, from);
    if (i === -1) break;
    const start = Math.max(0, i - 60);
    const end = Math.min(js.length, i + kw.length + 60);
    console.log(`  [${kw}] ${js.slice(start, end).replace(/\s+/g, " ")}`);
    from = i + kw.length;
    count++;
  }
}
console.log();

writeFileSync("data/raw/api/sports2i-clues.json", JSON.stringify({
  domains: [...domains],
  urls,
  paths: [...paths],
}, null, 2));
console.log("→ data/raw/api/sports2i-clues.json 저장");
