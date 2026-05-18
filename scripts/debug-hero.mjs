// heroCards.ts 의 4 빌더를 mjs로 재현해서 결과 디버그.
import fs from "node:fs";

const games = JSON.parse(fs.readFileSync("data/games.json","utf8")).games ?? [];
const dt = JSON.parse(fs.readFileSync("data/players-detail.json","utf8")).splits;
const ad = JSON.parse(fs.readFileSync("data/players-advanced.json","utf8")).splits;
const ta = JSON.parse(fs.readFileSync("data/team-advanced.json","utf8")).filters?.all ?? [];
const bs = JSON.parse(fs.readFileSync("data/boxscores.json","utf8")).byGmkey;

const TEAM_TO_SHORT = {"창원 LG":"LG","원주 DB":"DB","서울 SK":"SK","부산 KCC":"KCC","수원 KT":"KT","고양 소노":"소노","안양 정관장":"정관장","울산 현대모비스":"현대모비스","대구 한국가스공사":"가스공사","서울 삼성":"삼성"};
const ts = f => TEAM_TO_SHORT[f] ?? f ?? "—";

// 1
const finals = games.filter(g=>g.status==="final"&&g.gmkey).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
const latest = finals[0].date;
console.log("Latest final date:", latest, ', games on that date:', finals.filter(g=>g.date===latest).length);
const cands=[];
for(const g of finals.filter(g=>g.date===latest)){
  const box=bs[g.gmkey]; if(!box) continue;
  for(const bp of box.players){
    const totalSec=(bp.records.playMin??0)*60+(bp.records.playSec??0);
    if(totalSec<120) continue;
    const r=bp.records;
    const gs=r.score+0.4*r.fgt-0.7*r.fgtA-0.4*(r.ftA-r.ft)+0.7*r.offr+0.3*r.defr+r.stl+0.7*r.ast+0.7*r.bs-0.4*r.foul-r.to;
    cands.push({pname:bp.player.pname,team:ts(bp.player.tname),pcode:bp.player.pcode,gs,r,g});
  }
}
cands.sort((a,b)=>b.gs-a.gs);
console.log("\n[Card 1] Player of Night TOP 5:");
for(const c of cands.slice(0,5)) console.log(`  ${c.pname} (${c.team}) GS ${c.gs.toFixed(1)} · ${c.r.score}pts ${c.r.ast}a ${c.r.rb}r · vs ${c.g.homeShort===c.team?c.g.awayShort:c.g.homeShort}`);

// 2 — PO PER 1위 (생존팀 필터)
// 챔결 진출팀 추정: 챔결 단계 games에서 home/away 추출
const champGames = games.filter(g=>g.tag.includes("챔피언") && g.status==="final");
const champTeams = new Set();
for(const g of champGames) { champTeams.add(g.homeShort); champTeams.add(g.awayShort); }
console.log("\n[Card 2] Champion-series teams:", [...champTeams]);
const poPool = ad.playoff
  .filter(e => e.games>=1)
  .map(e => {
    const d = dt.playoff.find(x=>String(x.playerNo)===String(e.playerNo));
    return { e, d, ts: ts(d?.teamName1||e.teamName1) };
  })
  .filter(x => champTeams.size===0 || champTeams.has(x.ts));
poPool.sort((a,b)=>b.e.advanced.per - a.e.advanced.per);
console.log("PO MVP TOP 5 (생존팀만):");
for(const x of poPool.slice(0,5)) console.log(`  ${x.e.kname} (${x.ts}) PER ${x.e.advanced.per.toFixed(1)} · ${x.e.games}G`);

// 3 - team on fire
const streaks = ta.map(t=>{
  const short = t.shortName;
  const tgames = games.filter(g=>g.status==="final"&&(g.homeShort===short||g.awayShort===short)).sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time));
  let streak=0,kind=null;
  for(const g of tgames){
    if(g.homeScore==null||g.awayScore==null) continue;
    const isHome=g.homeShort===short;
    const my=isHome?g.homeScore:g.awayScore;
    const opp=isHome?g.awayScore:g.homeScore;
    const r=my>opp?"W":"L";
    if(kind===null){kind=r;streak=1;}else if(kind===r){streak++;}else break;
  }
  return {short,streak,kind:kind??"L"};
});
streaks.sort((a,b)=>b.streak-a.streak);
console.log("\n[Card 3] All streaks (sorted):");
for(const s of streaks) console.log(`  ${s.short.padEnd(8)} ${s.kind} ${s.streak}`);
const winStreaks = streaks.filter(s=>s.kind==="W"&&s.streak>=3);
console.log("→ winStreaks (≥3):", winStreaks.length);

// 3 fallback
const taTop = [...ta].sort((a,b)=>b.advanced.netRtg-a.advanced.netRtg)[0];
console.log("Net Rating top:", taTop.shortName, taTop.advanced.netRtg.toFixed(2));

// 4 - stat leader rotation
const cats=[{key:"points",label:"득점",unit:"PPG"},{key:"assists",label:"어시스트",unit:"APG"},{key:"rebounds",label:"리바운드",unit:"RPG"}];
const now=new Date();
const kst=new Date(now.getTime()+9*60*60*1000);
const yearStart=Date.UTC(kst.getUTCFullYear(),0,0);
const doy=Math.floor((kst.getTime()-yearStart)/86400000);
const idx=doy%3;
const c=cats[idx];
console.log("\n[Card 4] today doy=", doy, "→ cat:", c.label);
const sorted=dt.regularSeason.filter(p=>p.games>=20).sort((a,b)=>Number(b[c.key])-Number(a[c.key]));
console.log(c.label, "TOP 3:");
for(const p of sorted.slice(0,3)) console.log(`  ${p.kname} (${ts(p.teamName1)}) ${Number(p[c.key]).toFixed(1)} ${c.unit}`);
