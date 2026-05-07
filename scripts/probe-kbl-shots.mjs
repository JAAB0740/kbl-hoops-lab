/**
 * KBL 경기별 슛차트 endpoint 탐색
 *
 * URL 패턴: https://www.kbl.or.kr/match/record/S47G01N256/20260401
 *   - gmkey: S47G01N256 (S47=시즌, G01=정규, N256=게임번호)
 *   - gameDate: 20260401
 *
 * 추측 endpoint:
 *   - api-stats.kbl.or.kr/api/games/{gmkey}/shots
 *   - api-stats.kbl.or.kr/api/games/{gmkey}/shotchart
 *   - api-stats.kbl.or.kr/api/match/{gmkey}/shotchart
 *   - api.kbl.or.kr/match/record/shot/{gmkey}
 *
 * 실행: npm run probe:kbl-shots
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

const GMKEY = "S47G01N256";
const GAME_YMD = "20260401";

const TESTS = [
  // api-stats.kbl.or.kr 계열
  `https://api-stats.kbl.or.kr/api/games/${GMKEY}/shots`,
  `https://api-stats.kbl.or.kr/api/games/${GMKEY}/shotchart`,
  `https://api-stats.kbl.or.kr/api/match/${GMKEY}/shots`,
  `https://api-stats.kbl.or.kr/api/match/${GMKEY}/shotchart`,
  `https://api-stats.kbl.or.kr/api/match/${GMKEY}/chart`,
  `https://api-stats.kbl.or.kr/api/records/game/${GMKEY}/shots`,
  `https://api-stats.kbl.or.kr/api/records/match/shotchart?gmkey=${GMKEY}`,
  `https://api-stats.kbl.or.kr/api/records/match/shot?gmkey=${GMKEY}`,
  `https://api-stats.kbl.or.kr/api/records/shotChart/match?gmkey=${GMKEY}`,
  // api.kbl.or.kr 계열 (JS 번들에서 발견된 도메인)
  `https://api.kbl.or.kr/match/record/shot/${GMKEY}`,
  `https://api.kbl.or.kr/match/record/shotchart/${GMKEY}`,
  `https://api.kbl.or.kr/match/shot/${GMKEY}`,
  `https://api.kbl.or.kr/match/shotchart/${GMKEY}`,
  `https://api.kbl.or.kr/match/chart/${GMKEY}/${GAME_YMD}`,
  `https://api.kbl.or.kr/match/record/01/${GAME_YMD}/${GMKEY}/shotchart`,
  // gameCode + gameDate 형태
  `https://api.kbl.or.kr/match/record/01/${GAME_YMD}?gmkey=${GMKEY}&type=shot`,
  `https://api.kbl.or.kr/pub/match/shotchart/${GMKEY}`,
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

    if (ok && json) {
      console.log(`  최상위 키: ${Object.keys(json).slice(0, 10).join(", ")}`);
      function findArr(o, path = "") {
        if (Array.isArray(o) && o.length > 0) return { arr: o, path: path || "(root)" };
        if (o && typeof o === "object") {
          for (const [k, v] of Object.entries(o)) {
            const p = path ? `${path}.${k}` : k;
            if (Array.isArray(v) && v.length > 0) return { arr: v, path: p };
            if (typeof v === "object" && v !== null) {
              const sub = findArr(v, p);
              if (sub) return sub;
            }
          }
        }
        return null;
      }
      const found = findArr(json);
      if (found) {
        console.log(`  배열 위치: ${found.path} (길이 ${found.arr.length})`);
        const sample = found.arr[0];
        const k = Object.keys(sample);
        console.log(`  키: ${k.slice(0, 18).join(", ")}${k.length > 18 ? ", ..." : ""}`);
        // 좌표 관련 키 강조
        const coordKeys = k.filter((x) => /x|y|coord|pos|location|sx|sy|ex|ey/i.test(x));
        if (coordKeys.length > 0) {
          console.log(`  ★ 좌표 키: ${coordKeys.join(", ")}`);
        }
        console.log(`  미리보기: ${JSON.stringify(sample).slice(0, 350)}`);
        successes.push({ url, json });
      }
    } else if (text.length < 250) {
      console.log(`  본문: ${text.slice(0, 250)}`);
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
    const fname = "shots-" + s.url.replace(/^https?:\/\//, "").replace(/[/?&=]/g, "_").slice(0, 80) + ".json";
    writeFileSync(`data/raw/api/${fname}`, JSON.stringify(s.json, null, 2));
    console.log(`  → ${fname}`);
  }
} else {
  console.log("✗ 모두 실패. F12로 직접 확인 필요.");
}
