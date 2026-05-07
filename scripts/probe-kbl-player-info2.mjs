/**
 * KBL 선수 메타정보 endpoint 응답 구조 확인 (2차 probe)
 *
 * 발견된 endpoint (DevTools/probe 결과):
 *   - api-stats.kbl.or.kr/api/players?playerNo=...   (전체 선수, 1.7MB)
 *   - kbl-api.sports2i.com/api/v1/players?regSc=Y    (등록선수만, 페이지)
 *   - kbl-api.sports2i.com/api/v1/code/codes/1       (코드 테이블 1)
 *   - kbl-api.sports2i.com/api/v1/code/codes/2       (코드 테이블 2)
 *
 * 두 번째 probe 가 하는 일:
 *   1) sports2i v1/players 응답 구조 확인 (페이지 1, 큰 listCn)
 *   2) 코드 테이블 1, 2 어떤 매핑인지 확인 (포지션? 선수구분? 국적?)
 *   3) 우리가 필요한 필드 (국적/생년월일/신장/학교/선수구분) 가 다 있는지 확인
 *
 * 실행: npm run probe:kbl-player-info2
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

const TARGETS = [
  // sports2i 등록선수
  "https://kbl-api.sports2i.com/api/v1/players?regSc=Y&pageNo=1&listCn=20",
  "https://kbl-api.sports2i.com/api/v1/players?regSc=Y&pageNo=1&listCn=300",
  "https://kbl-api.sports2i.com/api/v1/players?pageNo=1&listCn=10",
  // 코드 테이블
  "https://kbl-api.sports2i.com/api/v1/code/codes/1",
  "https://kbl-api.sports2i.com/api/v1/code/codes/2",
  "https://kbl-api.sports2i.com/api/v1/code/codes/3",
  // 개별 선수 (등록 선수 자밀 워니)
  "https://kbl-api.sports2i.com/api/v1/players/291248",
  "https://kbl-api.sports2i.com/api/v1/player/291248",
  // api-stats 등록선수 필터
  "https://api-stats.kbl.or.kr/api/players?seasonCode=47&regSc=Y",
  "https://api-stats.kbl.or.kr/api/players?seasonCode=47",
];

mkdirSync("data/raw/api", { recursive: true });

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
      console.log(`  HTTP ${res.status} · ${isArr ? "Array" : "Object"} · ${text.length}자`);
      if (isArr) {
        console.log(`  배열 길이: ${json.length}`);
        if (json.length > 0) {
          console.log(`  첫 원소 키 (${Object.keys(json[0]).length}개):`,
            Object.keys(json[0]).slice(0, 30).join(", "));
          console.log(`  첫 원소 sample:`, JSON.stringify(json[0]).slice(0, 600));
        }
      } else {
        console.log(`  최상위 키:`, Object.keys(json).slice(0, 20).join(", "));
        if (Array.isArray(json.data) && json.data[0]) {
          console.log(`  data 길이: ${json.data.length}`);
          console.log(`  data[0] 키 (${Object.keys(json.data[0]).length}개):`,
            Object.keys(json.data[0]).slice(0, 30).join(", "));
          console.log(`  data[0] sample:`, JSON.stringify(json.data[0]).slice(0, 800));
        } else if (json.list && Array.isArray(json.list)) {
          console.log(`  list 길이: ${json.list.length}`);
          if (json.list[0]) {
            console.log(`  list[0] 키:`, Object.keys(json.list[0]).slice(0, 30).join(", "));
            console.log(`  list[0] sample:`, JSON.stringify(json.list[0]).slice(0, 800));
          }
        } else {
          console.log(`  sample:`, JSON.stringify(json).slice(0, 600));
        }
      }
      const fname = url.replace(/^https?:\/\//, "").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 100);
      writeFileSync(`data/raw/api/probe-pinfo2-${fname}.json`, text);
    } else {
      console.log(`  HTTP ${res.status} (${text.length}자, ${isHtml ? "HTML" : "empty/error"})`);
      if (json?.message) console.log(`  message: ${json.message}`);
    }
  } catch (err) {
    console.log(`  ✗ ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, 100));
}
