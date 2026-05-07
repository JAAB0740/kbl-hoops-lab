/**
 * KBL shot-dashboard endpoint probe
 *
 * sports2i main.js 분석에서 발견:
 *   - GET /api/records/player/shot-dashboard
 *   - GET /api/records/team/shot-dashboard
 *
 * Base URL 후보:
 *   - https://kbl-api.sports2i.com/api/v1
 *   - https://api-stats.kbl.or.kr
 *
 * 실행: npm run probe:kbl-shot-dashboard
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

const COMMON = "seasonCode=47&gameCode=01&perCn=1&lastCn=0&partIfList=0&draftNo=0";
const PLAYER_NO = "291248"; // 자밀 워니

const TESTS = [
  // Base URL 1: sports2i 직접
  `https://kbl-api.sports2i.com/api/v1/api/records/player/shot-dashboard?${COMMON}&playerNo=${PLAYER_NO}`,
  `https://kbl-api.sports2i.com/api/v1/records/player/shot-dashboard?${COMMON}&playerNo=${PLAYER_NO}`,
  `https://kbl-api.sports2i.com/api/records/player/shot-dashboard?${COMMON}&playerNo=${PLAYER_NO}`,
  // Base URL 2: api-stats.kbl.or.kr (우리가 쓰던 것)
  `https://api-stats.kbl.or.kr/api/records/player/shot-dashboard?${COMMON}&playerNo=${PLAYER_NO}`,
  // Team 버전
  `https://kbl-api.sports2i.com/api/v1/api/records/team/shot-dashboard?${COMMON}`,
  `https://api-stats.kbl.or.kr/api/records/team/shot-dashboard?${COMMON}`,
  // 다른 흥미로운 endpoint도 같이
  `https://api-stats.kbl.or.kr/api/records/player/clutch/traditional?${COMMON}`,
  `https://api-stats.kbl.or.kr/api/records/player/hustle?${COMMON}`,
  `https://api-stats.kbl.or.kr/api/records/team/general/four-factors?${COMMON}`,
  `https://api-stats.kbl.or.kr/api/records/player/shooting?${COMMON}`,
  `https://api-stats.kbl.or.kr/api/records/team/shooting?${COMMON}`,
];

mkdirSync("data/raw/api", { recursive: true });
const successes = [];

for (const url of TESTS) {
  console.log("━".repeat(72));
  console.log(`▶ ${url.replace(COMMON, "{common}")}`);
  try {
    const res = await fetch(url, { headers: HEADERS });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    const ok = res.ok && json?.resultCode !== "Fail" && (json?.resultcode ?? 0) < 400;
    console.log(`  ${ok ? "✓" : "✗"} HTTP ${res.status} · ${text.length.toLocaleString()}자`);
    if (json?.message) console.log(`  message: ${json.message}`);
    if (json?.detail) console.log(`  detail: ${json.detail.slice(0, 150)}`);

    if (ok && json?.data) {
      const arr = Array.isArray(json.data) ? json.data : [json.data];
      console.log(`  배열 길이: ${arr.length}`);
      if (arr[0]) {
        const k = Object.keys(arr[0]);
        console.log(`  키 (${k.length}): ${k.slice(0, 25).join(", ")}${k.length > 25 ? ", ..." : ""}`);
        const coordKeys = k.filter((x) => /x|y|coord|pos|sx|sy|ex|ey|loc|zone|area/i.test(x));
        if (coordKeys.length > 0) {
          console.log(`  ★ 좌표/zone 키: ${coordKeys.join(", ")}`);
        }
        console.log(`  미리보기: ${JSON.stringify(arr[0]).slice(0, 400)}`);
      }
      successes.push({ url, json });
    }
  } catch (e) {
    console.log(`  ✗ ${e.message}`);
  }
  console.log();
}

console.log("━".repeat(72));
console.log(`✓ 성공 ${successes.length}개`);
for (const s of successes) {
  console.log(`  • ${s.url.replace(COMMON, "{common}")}`);
  const fname =
    "ext-" + s.url.replace(/^https?:\/\//, "").replace(/[/?&=]/g, "_").slice(0, 80) + ".json";
  writeFileSync(`data/raw/api/${fname}`, JSON.stringify(s.json, null, 2));
}
