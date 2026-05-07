/**
 * KBL 선수/팀 영역별 야투 (shooting) fetch
 *
 * GET /api/records/player/shooting
 * GET /api/records/team/shooting
 *
 * 응답: 6개 Range 별 성공/시도/성공률 (fdgRange1~6, fdgARange1~6, fdgRtRange1~6)
 *
 * 출력: data/shooting.json
 *
 * 실행: npm run fetch:kbl-shooting
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

const PLAYER_BASE = "https://api-stats.kbl.or.kr/api/records/player/shooting";
const TEAM_BASE = "https://api-stats.kbl.or.kr/api/records/team/shooting";
const COMMON = {
  seasonCode: "47",
  perCn: "1",
  lastCn: "0",
  partIfList: "0",
  draftNo: "0",
};

function buildUrl(base, extra) {
  const p = { ...COMMON, ...extra };
  return base + "?" + Object.entries(p).map(([k, v]) => `${k}=${v}`).join("&");
}

const TEAM_NAME4_TO_SHORT = {
  LG: "LG", DB: "DB", SK: "SK", KCC: "KCC", KT: "KT",
  정관장: "정관장", 소노: "소노", 현대모비스: "현대모비스",
  가스공사: "가스공사", 삼성: "삼성",
  "JUNG KWAN JANG": "정관장", JUNGKWANJANG: "정관장", KGC: "정관장",
  SONO: "소노",
  "HYUNDAI MOBIS": "현대모비스", HYUNDAIMOBIS: "현대모비스", HD: "현대모비스",
  KOGAS: "가스공사", PEGA: "가스공사", KG: "가스공사",
  SAMSUNG: "삼성", SS: "삼성",
};
function normShort(s) {
  if (!s) return s;
  return TEAM_NAME4_TO_SHORT[String(s).trim()] ?? String(s).trim();
}

function normPlayer(r) {
  const ranges = [];
  for (let i = 1; i <= 6; i++) {
    ranges.push({
      range: i,
      made: r[`fdgRange${i}`] ?? 0,
      att: r[`fdgARange${i}`] ?? 0,
      pct: r[`fdgRtRange${i}`] ?? 0,
    });
  }
  return {
    rank: r.rankNo,
    playerNo: String(r.playerNo),
    kname: r.kname,
    ename: r.ename,
    teamCode: r.teamCode,
    teamName1: r.teamName1,
    teamName4: normShort(r.teamName4),
    ranges,
  };
}

function normTeam(r) {
  const ranges = [];
  for (let i = 1; i <= 6; i++) {
    ranges.push({
      range: i,
      made: r[`fdgRange${i}`] ?? 0,
      att: r[`fdgARange${i}`] ?? 0,
      pct: r[`fdgRtRange${i}`] ?? 0,
    });
  }
  return {
    rank: r.rankNo,
    code: r.teamCode,
    name: r.teamName1,
    shortName: normShort(r.teamName4),
    ranges,
  };
}

async function fetchOne(label, base, params, normalize) {
  const url = buildUrl(base, params);
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) {
      console.log(`  ${label.padEnd(10)} ✗ HTTP ${res.status}`);
      return [];
    }
    const json = await res.json();
    const arr = (json?.data ?? []).map(normalize);
    console.log(`  ${label.padEnd(10)} ✓ ${arr.length}개`);
    return arr;
  } catch (e) {
    console.log(`  ${label.padEnd(10)} ✗ ${e.message}`);
    return [];
  }
}

console.log(`[1/2] 선수/팀 영역별 야투 수집`);

// 정규시즌
console.log(`\n선수:`);
const playerRegular = await fetchOne("정규 평균", PLAYER_BASE, { gameCode: "01" }, normPlayer);
const playerPlayoff = await fetchOne("PO 평균", PLAYER_BASE, { gameCode: "03,04" }, normPlayer); // 03 PO + 04 챔결 합산

console.log(`\n팀:`);
const teamRegular = await fetchOne("정규 평균", TEAM_BASE, { gameCode: "01" }, normTeam);
const teamPlayoff = await fetchOne("PO 평균", TEAM_BASE, { gameCode: "03,04" }, normTeam); // 03 PO + 04 챔결 합산

mkdirSync("data", { recursive: true });
writeFileSync(
  "data/shooting.json",
  JSON.stringify(
    {
      fetchedAt: new Date().toISOString(),
      source: "api-stats.kbl.or.kr/api/records/{player,team}/shooting",
      seasonCode: "47",
      // 6 Range 의미 (KBL 공식 정의 추정):
      //   Range 1: 림 부근 (페인트 안)
      //   Range 2: 페인트 외곽 (미드 근거리)
      //   Range 3: 미드레인지
      //   Range 4: 코너 3점
      //   Range 5: 윙 3점
      //   Range 6: 탑 3점 / 롱 3점
      rangeLabels: {
        "1": "림 부근",
        "2": "페인트",
        "3": "미드레인지",
        "4": "코너 3점",
        "5": "윙 3점",
        "6": "탑 3점",
      },
      players: {
        regular: playerRegular,
        playoff: playerPlayoff,
      },
      teams: {
        regular: teamRegular,
        playoff: teamPlayoff,
      },
    },
    null,
    2,
  ),
);
console.log(`\n✓ data/shooting.json 저장`);

// 샘플
const wonny = playerRegular.find((p) => p.kname === "자밀 워니");
if (wonny) {
  console.log(`\n샘플 — 자밀 워니 정규시즌 영역별 야투:`);
  for (const r of wonny.ranges) {
    console.log(`  Range ${r.range}: ${r.made.toFixed(1)} / ${r.att.toFixed(1)} (${r.pct.toFixed(1)}%)`);
  }
}
