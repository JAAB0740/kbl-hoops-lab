/**
 * KBL 일정 API probe v2 — 실제 도메인 api.kbl.or.kr 기반
 *
 * 발견:
 *   - JS 번들에서 baseURL = "https://api.kbl.or.kr" 확인
 *   - 경로: /match/list, /match/list/today, /match/year, /match/schedule
 *
 * 실행: npm run probe:kbl-schedule
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import { mkdirSync, writeFileSync } from "node:fs";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9",
  Referer: "https://www.kbl.or.kr/",
  Origin: "https://www.kbl.or.kr",
};

const BASE = "https://api.kbl.or.kr";
const SEASON = "47";
const today = new Date();
const YYYY = today.getFullYear();
const MM = String(today.getMonth() + 1).padStart(2, "0");
const DD = String(today.getDate()).padStart(2, "0");
const YYYYMMDD = `${YYYY}${MM}${DD}`;
const YYYYMM = `${YYYY}${MM}`;

const CANDIDATES = [
  // /match/list 계열
  `${BASE}/match/list`,
  `${BASE}/match/list?seasonCode=${SEASON}`,
  `${BASE}/match/list?seasonCode=${SEASON}&gameYmd=${YYYYMMDD}`,
  `${BASE}/match/list?seasonCode=${SEASON}&yearMonth=${YYYYMM}`,
  `${BASE}/match/list?seasonCode=${SEASON}&monthCd=${YYYYMM}`,
  `${BASE}/match/list?seasonCode=${SEASON}&fromDate=20260401&toDate=20260430`,
  `${BASE}/match/list?seasonCode=${SEASON}&gameCode=01,03,04`,
  // /match/list/today
  `${BASE}/match/list/today`,
  `${BASE}/match/list/today?seasonCode=${SEASON}`,
  // /match/year (시즌 전체)
  `${BASE}/match/year`,
  `${BASE}/match/year?seasonCode=${SEASON}`,
  `${BASE}/match/year?seasonCode=${SEASON}&year=${YYYY}`,
  // /match/schedule
  `${BASE}/match/schedule`,
  `${BASE}/match/schedule?seasonCode=${SEASON}`,
  `${BASE}/match/schedule?seasonCode=${SEASON}&yearMonth=${YYYYMM}`,
  // /match/team-ranking (참고용)
  `${BASE}/match/team-ranking?seasonCode=${SEASON}`,
];

mkdirSync("data/raw/api", { recursive: true });
const summary = [];

for (const url of CANDIDATES) {
  console.log("\n" + "━".repeat(70));
  console.log(`▶ ${url}`);
  try {
    const t0 = Date.now();
    const res = await fetch(url, { headers: HEADERS });
    const elapsed = Date.now() - t0;
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}

    console.log(`  ${res.ok ? "✓" : "✗"} HTTP ${res.status} · ${elapsed}ms · ${text.length.toLocaleString()}자`);

    if (json && typeof json === "object") {
      const keys = Object.keys(json);
      console.log(`  최상위 키: ${keys.join(", ")}`);

      function findArray(o, path = "") {
        if (!o || typeof o !== "object") return null;
        for (const [k, v] of Object.entries(o)) {
          const p = path ? `${path}.${k}` : k;
          if (Array.isArray(v) && v.length > 0) return { arr: v, path: p };
          if (typeof v === "object" && v !== null && !Array.isArray(v)) {
            const sub = findArray(v, p);
            if (sub) return sub;
          }
        }
        return null;
      }
      const found = findArray(json);
      if (found) {
        console.log(`  배열 경로: ${found.path} (길이 ${found.arr.length})`);
        const sample = found.arr[0];
        const sampleKeys = Object.keys(sample).slice(0, 12);
        console.log(`  첫 요소 키: ${sampleKeys.join(", ")}`);
        // game 관련 필드가 있는지 미리보기
        const gKeys = sampleKeys.filter((k) =>
          /game|home|away|score|date|time|team/i.test(k)
        );
        if (gKeys.length > 0) {
          const preview = Object.fromEntries(gKeys.map((k) => [k, sample[k]]));
          console.log(`  샘플(게임 관련): ${JSON.stringify(preview).slice(0, 200)}`);
        }
      }
    } else if (text.length < 400) {
      console.log(`  응답: ${text.slice(0, 400)}`);
    }

    summary.push({
      url,
      status: res.status,
      ok: res.ok,
      length: text.length,
      elapsed,
      topKeys: json && typeof json === "object" ? Object.keys(json) : null,
      bodySample: !json ? text.slice(0, 300) : null,
    });

    if (res.ok && json) {
      const fname =
        "schedule-" +
        url.replace(/^https?:\/\//, "").replace(/[/?&=]/g, "_").slice(0, 80) +
        ".json";
      writeFileSync(`data/raw/api/${fname}`, JSON.stringify(json, null, 2));
      console.log(`  → 저장: data/raw/api/${fname}`);
    }
  } catch (err) {
    console.log(`  ✗ ${err.message}`);
    summary.push({ url, error: err.message });
  }
  await new Promise((r) => setTimeout(r, 200));
}

writeFileSync(
  "data/raw/api/probe-schedule.json",
  JSON.stringify({ probedAt: new Date().toISOString(), summary }, null, 2),
);

console.log("\n" + "━".repeat(70));
console.log("✓ 완료. 성공한 후보:");
for (const s of summary) {
  if (s.ok) console.log(`  • ${s.url}`);
}
console.log("\n→ 출력 전체 또는 ✓ 표시된 것의 '최상위 키 / 배열 경로 / 첫 요소 키' 부분을 공유해주세요.");
