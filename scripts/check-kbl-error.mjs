/**
 * KBL API 파라미터 식별 — fromDate/toDate 형식 + seasonCode 조합 테스트
 *
 * 발견된 필수 헤더: Channel: WEB, TeamCode: ""
 * 필수 파라미터: fromDate (형식 미상, String)
 *
 * 실행: npm run check:kbl-error
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.kbl.or.kr/",
  Origin: "https://www.kbl.or.kr",
  Channel: "WEB",
  TeamCode: "",
};

const TESTS = [
  // YYYYMMDD 형식
  "https://api.kbl.or.kr/match/list?seasonCode=47&fromDate=20260401&toDate=20260430",
  // YYYY-MM-DD 형식
  "https://api.kbl.or.kr/match/list?seasonCode=47&fromDate=2026-04-01&toDate=2026-04-30",
  // fromDate만
  "https://api.kbl.or.kr/match/list?seasonCode=47&fromDate=20260401",
  // 시즌 전체
  "https://api.kbl.or.kr/match/list?seasonCode=47&fromDate=20251001&toDate=20260601",
  // gameCode 추가 (정규+PO+CF)
  "https://api.kbl.or.kr/match/list?seasonCode=47&fromDate=20251001&toDate=20260601&gameCode=01,03,04",
  // /match/year도 시도
  "https://api.kbl.or.kr/match/year?seasonCode=47",
  // /match/list/today
  "https://api.kbl.or.kr/match/list/today",
];

let firstSuccess = null;

for (const url of TESTS) {
  console.log("━".repeat(72));
  console.log(`▶ ${url}`);
  try {
    const res = await fetch(url, { headers: HEADERS });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}

    const ok = res.ok && json?.resultCode !== "Fail";
    console.log(`  ${ok ? "✓" : "✗"} HTTP ${res.status} · ${text.length.toLocaleString()}자`);

    if (json) {
      if (json.message) console.log(`  message: ${json.message}`);
      const obj = json.object;
      if (Array.isArray(obj)) {
        console.log(`  object 배열 길이: ${obj.length}`);
        if (obj[0]) {
          const k = Object.keys(obj[0]);
          console.log(`  첫 요소 키 (${k.length}개): ${k.slice(0, 20).join(", ")}${k.length > 20 ? ", ..." : ""}`);
          console.log(`  첫 요소 미리보기:`);
          console.log(`    ${JSON.stringify(obj[0]).slice(0, 400)}`);
        }
      } else if (obj && typeof obj === "object") {
        const k = Object.keys(obj);
        console.log(`  object 키: ${k.slice(0, 12).join(", ")}`);
        // 안에 list/games/data 같은 배열 있는지
        for (const key of ["list", "games", "data", "matches"]) {
          if (Array.isArray(obj[key])) {
            console.log(`  → object.${key} 배열 길이: ${obj[key].length}`);
            if (obj[key][0]) {
              console.log(`     첫 요소: ${JSON.stringify(obj[key][0]).slice(0, 300)}`);
            }
          }
        }
      }
    } else {
      console.log(`  본문(파싱 실패): ${text.slice(0, 200)}`);
    }

    if (ok && !firstSuccess) {
      firstSuccess = url;
      // 응답 저장
      const fs = await import("node:fs");
      fs.mkdirSync("data/raw/api", { recursive: true });
      const fname = "match-list-success.json";
      fs.writeFileSync(`data/raw/api/${fname}`, JSON.stringify(json, null, 2));
      console.log(`  → 저장: data/raw/api/${fname}`);
    }
  } catch (e) {
    console.log(`  ✗ ${e.message}`);
  }
  console.log();
}

console.log("━".repeat(72));
if (firstSuccess) {
  console.log(`✓ 첫 성공: ${firstSuccess}`);
  console.log("  → 응답이 data/raw/api/match-list-success.json 에 저장됨.");
  console.log("  → 이 파일의 첫 부분(약 50줄)을 공유해주시면 fetch 스크립트 작성합니다.");
} else {
  console.log("✗ 모두 실패. 메시지 확인 필요.");
}
