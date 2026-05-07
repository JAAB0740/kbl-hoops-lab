/**
 * KBL 영역별 야투 (shot chart) endpoint 탐색
 *
 * 후보:
 *   - .../player/zone/...
 *   - .../player/shot/...
 *   - .../player/shooting/...
 *   - .../player/area/...
 *
 * 실행: npm run probe:kbl-shotchart
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

const BASE = "https://api-stats.kbl.or.kr/api/records/player";
const COMMON = "seasonCode=47&gameCode=01&perCn=1&lastCn=0&partIfList=0&draftNo=0";
const PLAYER_NO = "291248"; // 자밀 워니

const TESTS = [
  // 일반적 path 패턴
  `${BASE}/zone/traditional?${COMMON}&playerNo=${PLAYER_NO}`,
  `${BASE}/general/zone?${COMMON}&playerNo=${PLAYER_NO}`,
  `${BASE}/general/shot?${COMMON}&playerNo=${PLAYER_NO}`,
  `${BASE}/general/area?${COMMON}&playerNo=${PLAYER_NO}`,
  `${BASE}/shot/traditional?${COMMON}&playerNo=${PLAYER_NO}`,
  `${BASE}/shooting/zone?${COMMON}&playerNo=${PLAYER_NO}`,
  `${BASE}/general/shotChart?${COMMON}&playerNo=${PLAYER_NO}`,
  `${BASE}/shotchart/traditional?${COMMON}&playerNo=${PLAYER_NO}`,
  `${BASE}/general/court?${COMMON}&playerNo=${PLAYER_NO}`,
  `${BASE}/general/zonalShot?${COMMON}&playerNo=${PLAYER_NO}`,
  // 또 다른 path
  `https://api-stats.kbl.or.kr/api/records/zone/player/traditional?${COMMON}&playerNo=${PLAYER_NO}`,
  `https://api-stats.kbl.or.kr/api/records/shotChart/player?${COMMON}&playerNo=${PLAYER_NO}`,
];

mkdirSync("data/raw/api", { recursive: true });
const successes = [];

for (const url of TESTS) {
  console.log("━".repeat(72));
  console.log(`▶ ${url}`);
  try {
    const res = await fetch(url, { headers: HEADERS });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    const ok = res.ok && json?.resultCode !== "Fail" && (json?.resultcode ?? 0) < 400;
    console.log(`  ${ok ? "✓" : "✗"} HTTP ${res.status} · ${text.length}자`);
    if (json?.message) console.log(`  message: ${json.message}`);
    if (json?.detail) console.log(`  detail: ${json.detail.slice(0, 150)}`);

    if (ok && json?.data && (json.data.length > 0 || Object.keys(json.data).length > 0)) {
      const sample = Array.isArray(json.data) ? json.data[0] : json.data;
      const k = Object.keys(sample);
      console.log(`  배열/객체 키 (${k.length}): ${k.slice(0, 25).join(", ")}`);
      console.log(`  미리보기: ${JSON.stringify(sample).slice(0, 350)}`);
      successes.push({ url, json });
    }
  } catch (e) {
    console.log(`  ✗ ${e.message}`);
  }
  console.log();
}

console.log("━".repeat(72));
if (successes.length > 0) {
  console.log(`✓ 성공 ${successes.length}개`);
  for (const s of successes) {
    const fname = "shotchart-" + s.url.replace(/^https?:\/\//, "").replace(/[/?&=]/g, "_").slice(0, 80) + ".json";
    writeFileSync(`data/raw/api/${fname}`, JSON.stringify(s.json, null, 2));
    console.log(`  → ${fname}`);
  }
} else {
  console.log("✗ 모두 실패. 영역별 야투 endpoint를 못 찾았습니다.");
  console.log("  → 네이버 KBL 페이지의 차트는 KBL 자체가 아닌 별도 데이터일 가능성이 높음.");
  console.log("  → 우회: KBL 사이트에서 F12 → Network로 /shot 또는 /zone 호출 확인 필요.");
}
