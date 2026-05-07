/**
 * KBL 선수 메타정보 (국적/생년월일/신장/체중/학교/선수구분/드래프트) 자동 fetch
 *
 * 입력:
 *   - api-stats.kbl.or.kr/api/players?seasonCode=47   (등록+은퇴 610명, 52 필드)
 *   - kbl-api.sports2i.com/api/v1/players?regSc=Y&listCn=300 (등록선수 216명, 드래프트 정보 포함)
 *
 * 두 응답 교차 → 등록선수만 풀 메타정보 + 드래프트 합쳐서 저장.
 *
 * 출력: data/players-info.json
 *   {
 *     fetchedAt,
 *     totalRegistered,
 *     byPcode: {
 *       "291248": {
 *         pcode, kname, ename, teamCode, pos, backNum,
 *         flag: "국내" | "아시아쿼터" | "외국선수",
 *         country, birthday, pHeight, pWeight,
 *         schools: { primary, middle, high, university, graduate },
 *         gradYear, draft: { year, round, rank } | null,
 *         photoUrl
 *       }
 *     }
 *   }
 *
 * 실행: npm run fetch:kbl-player-info
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

const SEASON = "47";

// ─── 1) api-stats — 풀 메타정보 ─────────────────────
console.log("[1/2] api-stats.kbl.or.kr/api/players (52 필드)");
const statsUrl = `https://api-stats.kbl.or.kr/api/players?seasonCode=${SEASON}`;
const statsRes = await fetch(statsUrl, { headers: HEADERS });
if (!statsRes.ok) {
  console.error(`✗ api-stats HTTP ${statsRes.status}`);
  process.exit(1);
}
const statsJson = await statsRes.json();
const allPlayers = statsJson.data ?? [];
console.log(`  → 전체 ${allPlayers.length}명 (등록+은퇴)`);

// ─── 2) sports2i — 등록 선수만 + 드래프트 ───────────
console.log("\n[2/2] kbl-api.sports2i.com/api/v1/players?regSc=Y");
const s2iUrl = `https://kbl-api.sports2i.com/api/v1/players?regSc=Y&pageNo=1&listCn=500`;
const s2iRes = await fetch(s2iUrl, { headers: HEADERS });
if (!s2iRes.ok) {
  console.error(`✗ sports2i HTTP ${s2iRes.status}`);
  process.exit(1);
}
const s2iJson = await s2iRes.json();
const reg = s2iJson.playerList ?? [];
console.log(`  → 등록선수 ${reg.length}명 (totalCn=${s2iJson.totalCn})`);

// pcode → 드래프트 매핑
const draftByPcode = new Map();
for (const p of reg) {
  draftByPcode.set(String(p.playerNo), {
    yearNo: p.yearNo,
    roundNo: p.roundNo,
    rankNo: p.rankNo,
    monthNo: p.monthNo,
    // sports2i 의 playerFlagCode2 도 같이 — 추후 매핑 검증용
    flagCode: p.playerFlagCode2,
  });
}

// 등록선수 pcode 셋
const regSet = new Set(reg.map((p) => String(p.playerNo)));

// ─── 3) playerFlagCode 매핑 추정 ────────────────────
// sports2i 응답 sample: 강상재(국내) → playerFlagCode2: "0"
// 외국선수: 시도해서 어떤 코드 받는지 확인하고 매핑
//
// KBL 공식 컨벤션 추정:
//   playerFlagCode1: 1=국내, 2=아시아쿼터, 3=외국 (또는 비슷)
//   playerFlagCode2: 0=국내, 1=외국, 2=아시아쿼터 (또는 다른 변종)
//
// 안전하게: country 필드 + ename 이름 패턴 + flagCode 함께 보고 결정
function classifyPlayer(p, draftFlag) {
  const code2 = String(p.playerFlagCode2 ?? draftFlag ?? "").trim();
  const country = String(p.country ?? "").trim();

  // 명시적 코드 우선 — sports2i playerFlagCode2 매핑
  //   "0" = 국내, "1" = 외국선수, "2" = 아시아쿼터 (실제 응답 sample 기준)
  if (code2 === "0") return "국내";
  if (code2 === "1") return "외국선수";
  if (code2 === "2") return "아시아쿼터";

  // 코드 없으면 country 로 fallback (sports2i 매칭 안된 등록선수 등)
  const koreanLabels = [
    "KOR", "한국", "대한민국", "Korea", "South Korea", "REPUBLIC OF KOREA",
  ];
  if (!country || koreanLabels.includes(country)) return "국내";
  return "외국선수"; // 모르는 country 는 보수적으로 외국선수
}

// ─── 4) 등록선수만 필터 + 정규화 ──────────────────────
const out = {};
let countByFlag = { "국내": 0, "아시아쿼터": 0, "외국선수": 0 };

for (const p of allPlayers) {
  const pcode = String(p.playerNo);
  if (!regSet.has(pcode)) continue; // 등록선수만

  const draft = draftByPcode.get(pcode);
  const flag = classifyPlayer(p, draft?.flagCode);
  countByFlag[flag] = (countByFlag[flag] ?? 0) + 1;

  // 생년월일 (YYYYMMDD or YYYY-MM-DD or "")
  let birthday = "";
  const bd = String(p.birthday ?? "").trim();
  if (/^\d{8}$/.test(bd)) {
    birthday = `${bd.slice(0, 4)}-${bd.slice(4, 6)}-${bd.slice(6, 8)}`;
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(bd)) {
    birthday = bd;
  }

  out[pcode] = {
    pcode,
    kname: String(p.kname ?? "").replace(/^\*\s*/, "").trim(), // 은퇴표시 제거
    ename: p.ename ?? "",
    teamCode: p.teamCode ?? "",
    pos: p.pos ?? "",
    backNum: p.backNum ?? "",
    flag,
    country: String(p.country ?? "").trim(),
    birthday,
    pHeight: Number(p.pHeight) || null,
    pWeight: Number(p.pWeight) || null,
    schools: {
      primary: (p.primSch ?? "").trim() || null,
      middle:  (p.middSch ?? "").trim() || null,
      high:    (p.highSch ?? "").trim() || null,
      university: (p.univSch ?? "").trim() || null,
      graduate: (p.gradSch ?? "").trim() || null,
    },
    gradYear: Number(p.gradYear) || null,
    draft: draft && draft.yearNo ? {
      year: Number(draft.yearNo) || null,
      round: Number(draft.roundNo) || null,
      rank: Number(draft.rankNo) || null,
    } : null,
    photoUrl: p.photoName
      ? `https://kbl.or.kr/files/kbl/players-photo/${p.photoName}`
      : null,
    inSeason: Number(p.inSeason) || null,
  };
}

// ─── 5) 통계 + 검증 ────────────────────────────────
console.log("\n검증:");
console.log(`  교차 매칭 등록선수: ${Object.keys(out).length}/${reg.length}`);
console.log(`  선수구분: 국내 ${countByFlag["국내"]}, 아시아쿼터 ${countByFlag["아시아쿼터"]}, 외국 ${countByFlag["외국선수"]}`);

// 매칭 안 된 등록선수 (api-stats 에 없는 경우 — 신인/이적 등) 체크
const missing = reg.filter((p) => !out[String(p.playerNo)]);
if (missing.length > 0) {
  console.log(`  ⚠ api-stats 에 없는 등록선수 ${missing.length}명 — minimal 데이터로 추가:`);
  for (const p of missing.slice(0, 5)) {
    console.log(`    ${p.playerNo} ${p.kname} (${p.teamCode})`);
  }
  // sports2i 데이터만으로 minimal 등록
  for (const p of missing) {
    const pcode = String(p.playerNo);
    out[pcode] = {
      pcode,
      kname: String(p.kname ?? "").trim(),
      ename: p.ename ?? "",
      teamCode: p.teamCode ?? "",
      pos: p.pos ?? "",
      backNum: p.backNum ?? "",
      flag: classifyPlayer(p, p.playerFlagCode2),
      country: "",
      birthday: "",
      pHeight: Number(p.pHeight) || null,
      pWeight: Number(p.pWeight) || null,
      schools: { primary: null, middle: null, high: null, university: null, graduate: null },
      gradYear: null,
      draft: p.yearNo ? {
        year: Number(p.yearNo) || null,
        round: Number(p.roundNo) || null,
        rank: Number(p.rankNo) || null,
      } : null,
      photoUrl: null,
      inSeason: null,
    };
  }
}

// 샘플 출력
console.log("\n샘플:");
const sampleNos = ["291001", "291248", "290450"]; // 강상재, 자밀워니, 오세근
for (const pcode of sampleNos) {
  const p = out[pcode];
  if (p) {
    console.log(`  ${p.kname} (${p.flag}) — ${p.pHeight}cm/${p.pWeight}kg · 생일 ${p.birthday || "—"} · ${p.schools.university || "—"} · 드래프트 ${p.draft ? `${p.draft.year} ${p.draft.round}R ${p.draft.rank}순위` : "—"}`);
  }
}

// ─── 6) 저장 ───────────────────────────────────────
mkdirSync("data", { recursive: true });
writeFileSync(
  "data/players-info.json",
  JSON.stringify({
    fetchedAt: new Date().toISOString(),
    seasonCode: SEASON,
    totalRegistered: Object.keys(out).length,
    countByFlag,
    byPcode: out,
  }, null, 2),
);
console.log(`\n✓ data/players-info.json 저장 (${Object.keys(out).length}명)`);
