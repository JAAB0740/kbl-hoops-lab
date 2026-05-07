/**
 * KBL JS 번들에서 토큰 발급 / 인증 헤더 패턴 추출
 *
 * 목적:
 *   - getAccessToken / Authorization 호출 컨텍스트 확인
 *   - 어떤 URL로 토큰을 발급받는지 찾기
 *   - 어떤 헤더 이름이 필수인지 확인
 *
 * 실행: npm run find:kbl-auth
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { writeFileSync } from "node:fs";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
  Referer: "https://www.kbl.or.kr/",
};

console.log("[1/2] JS 번들 다운로드...");
const htmlRes = await fetch("https://www.kbl.or.kr/match/schedule", { headers: HEADERS });
const html = await htmlRes.text();
const jsPath = html.match(/src="(\/assets\/index-[^"]+\.js)"/)[1];
const jsUrl = "https://www.kbl.or.kr" + jsPath;
const js = await (await fetch(jsUrl, { headers: HEADERS })).text();
console.log(`  → ${js.length.toLocaleString()}자\n`);

// 분석할 키워드별로 컨텍스트(앞뒤 60자) 추출
const KEYWORDS = [
  "getAccessToken",
  "Authorization",
  "Bearer",
  "accessToken",
  "issueToken",
  "/auth/",
  "/token",
  "appKey",
  "X-Auth",
  "X-Api",
  "deviceCode",
  "channelCode",
  "channel:",
  "device:",
];

function findContexts(needle, max = 8, ctx = 80) {
  const out = [];
  let from = 0;
  while (out.length < max) {
    const i = js.indexOf(needle, from);
    if (i === -1) break;
    const start = Math.max(0, i - ctx);
    const end = Math.min(js.length, i + needle.length + ctx);
    out.push({
      pos: i,
      snippet: js
        .slice(start, end)
        .replace(/\s+/g, " ")
        .trim(),
    });
    from = i + needle.length;
  }
  return out;
}

console.log("[2/2] 키워드 컨텍스트 추출\n");

const allFindings = {};
for (const kw of KEYWORDS) {
  const ctxs = findContexts(kw);
  if (ctxs.length === 0) continue;
  console.log("━".repeat(72));
  console.log(`▶ "${kw}" — ${ctxs.length}건`);
  for (const c of ctxs) {
    console.log(`  · ${c.snippet}`);
  }
  console.log();
  allFindings[kw] = ctxs;
}

// 추가: 헤더 객체 패턴 (Authorization, channel, device 등이 같이 들어간 객체)
console.log("━".repeat(72));
console.log("▶ 헤더 객체 후보 (Authorization 키워드 주변 객체)");
const headerObjRe = /\{[^{}]*(?:Authorization|authorization)[^{}]*\}/g;
const matches = Array.from(js.matchAll(headerObjRe)).slice(0, 10);
for (const m of matches) {
  console.log(`  · ${m[0].slice(0, 200)}`);
}
console.log();

// 추가: HTTP 메서드 호출 (axios.get, instance.get 등)
console.log("━".repeat(72));
console.log("▶ axios/fetch 호출 (URL 인자 포함, 200건 한도)");
const callRe = /\.(get|post|put|delete)\s*\(\s*[`'"]([^`'"]{3,150})[`'"]/g;
const calls = Array.from(js.matchAll(callRe))
  .map((m) => ({ method: m[1], url: m[2] }))
  .filter((c) => /game|match|schedule|team|player|stat|record|round|playoff|auth|token/i.test(c.url));
const dedup = [];
const seen = new Set();
for (const c of calls) {
  const k = `${c.method} ${c.url}`;
  if (!seen.has(k)) {
    seen.add(k);
    dedup.push(c);
  }
}
for (const c of dedup.slice(0, 50)) {
  console.log(`  · ${c.method.toUpperCase()} ${c.url}`);
}

writeFileSync(
  "data/raw/api/auth-clues.json",
  JSON.stringify({ findings: allFindings, headerObjects: matches.map((m) => m[0]), calls: dedup }, null, 2),
);
console.log("\n→ 저장: data/raw/api/auth-clues.json");
