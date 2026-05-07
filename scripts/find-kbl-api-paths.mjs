/**
 * KBL JS 번들에서 호출하는 모든 API/URL 단서 추출 (광범위 버전)
 *
 * 실행: npm run find:kbl-api
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { mkdirSync, writeFileSync } from "node:fs";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "*/*",
  Referer: "https://www.kbl.or.kr/",
};

console.log("[1/3] HTML에서 JS 번들 URL 찾기...");
const htmlRes = await fetch("https://www.kbl.or.kr/match/schedule", { headers: HEADERS });
const html = await htmlRes.text();
const jsMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
if (!jsMatch) {
  console.error("✗ JS 번들 URL을 못 찾았습니다.");
  process.exit(1);
}
const jsUrl = "https://www.kbl.or.kr" + jsMatch[1];
console.log(`  → ${jsUrl}`);

console.log("\n[2/3] JS 번들 다운로드...");
const jsRes = await fetch(jsUrl, { headers: HEADERS });
const js = await jsRes.text();
console.log(`  → ${js.length.toLocaleString()}자`);

console.log("\n[3/3] 다양한 패턴으로 단서 추출...\n");

// 도메인 추출
const domains = new Set();
for (const m of js.matchAll(/(?:https?:)?\/\/([a-z0-9.-]+\.[a-z]{2,})(?=[^a-z]|$)/gi)) {
  domains.add(m[1].toLowerCase());
}

// 전체 URL 추출
const urls = new Set();
for (const m of js.matchAll(/https?:\/\/[a-zA-Z0-9.\-]+\.(?:com|kr|net|org)(?:\/[^\s'"`,)\]]*)?/g)) {
  urls.add(m[0]);
}

// 가능성 있는 path 패턴 (api 외에도)
const PATH_PATTERNS = [
  /\/api\/[a-zA-Z0-9/_\-{}.]{2,}/g,
  /\/v\d+\/[a-zA-Z0-9/_\-{}.]{2,}/g,
  /\/data\/[a-zA-Z0-9/_\-{}.]{2,}/g,
  /\/records\/[a-zA-Z0-9/_\-{}.]{2,}/g,
  /\/games\/[a-zA-Z0-9/_\-{}.]{2,}/g,
  /\/match\/[a-zA-Z0-9/_\-{}.]{2,}/g,
  /\/schedule\/[a-zA-Z0-9/_\-{}.]{2,}/g,
  /\/team\/[a-zA-Z0-9/_\-{}.]{2,}/g,
  /\/players?\/[a-zA-Z0-9/_\-{}.]{2,}/g,
];
const paths = new Set();
for (const re of PATH_PATTERNS) {
  for (const m of js.matchAll(re)) {
    const p = m[0];
    // 너무 짧거나 .css/.js 같은 자원이면 제외
    if (p.length > 6 && !p.endsWith(".js") && !p.endsWith(".css") && !p.endsWith(".png")) {
      paths.add(p);
    }
  }
}

// axios/fetch 호출 패턴 (full string literal containing /api or known path)
const calls = new Set();
const callRe = /["'`]([\/a-zA-Z][a-zA-Z0-9\/_\-?=&{}.:%]*(?:games?|match|schedule|team|player|stats?|record|calendar|round|playoff)[a-zA-Z0-9\/_\-?=&{}.:%]*)["'`]/gi;
for (const m of js.matchAll(callRe)) {
  const c = m[1];
  if (c.length > 4 && c.length < 200 && c.startsWith("/")) calls.add(c);
}

// JS 변수에 박힌 base URL 후보 (예: const API = "https://...")
const baseUrls = new Set();
for (const m of js.matchAll(/baseURL\s*[:=]\s*["'`]([^"'`]+)["'`]/g)) {
  baseUrls.add(m[1]);
}
for (const m of js.matchAll(/VITE_[A-Z_]*URL[A-Z_]*\s*[:=]\s*["'`]([^"'`]+)["'`]/g)) {
  baseUrls.add(m[1]);
}

const KEYWORDS = /game|match|schedule|calendar|fixture|event|round|playoff/i;

function printList(title, items, highlight = false) {
  console.log("═".repeat(70));
  console.log(`  ${title} (${items.length}개)`);
  console.log("═".repeat(70));
  if (items.length === 0) {
    console.log("  (없음)");
  } else {
    for (const x of items) {
      const star = highlight && KEYWORDS.test(x) ? "★ " : "  ";
      console.log(`  ${star}${x}`);
    }
  }
  console.log();
}

printList("도메인", [...domains].sort());
printList("전체 URL (.com / .kr / .net / .org)", [...urls].sort().slice(0, 40));
printList("path 후보", [...paths].sort(), true);
printList("API 호출 후보 (string literal)", [...calls].sort(), true);
printList("base URL 변수", [...baseUrls].sort());

mkdirSync("data/raw/api", { recursive: true });
writeFileSync(
  "data/raw/api/discovered-paths.json",
  JSON.stringify(
    {
      foundAt: new Date().toISOString(),
      jsUrl,
      domains: [...domains].sort(),
      urls: [...urls].sort(),
      paths: [...paths].sort(),
      calls: [...calls].sort(),
      baseUrls: [...baseUrls].sort(),
    },
    null,
    2,
  ),
);
console.log("→ 저장: data/raw/api/discovered-paths.json");
console.log("\n★ 표시(일정·경기 관련) 줄과 도메인 목록을 Claude에게 공유해주세요.");
