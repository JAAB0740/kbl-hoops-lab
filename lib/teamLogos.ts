/**
 * 팀 로고 파일 자동 스캔 — `public/teams/{short}.svg|png|webp` 존재 여부를
 * 빌드 시 한 번 스캔해 메모리에 캐싱. server-only.
 *
 * 사용처:
 *  - HeroCards 워터마크 (Hero 카드 우상단)
 *  - PlayerProfileView 배경 워터마크 (선수 상세 페이지)
 *
 * 한글 파일명 / 대소문자 무관 매칭 지원. 지원 확장자: svg / png / webp.
 */

import fs from "node:fs";
import path from "node:path";

let CACHED: Map<string, string> | null = null;

function getAvailableLogos(): Map<string, string> {
  if (CACHED) return CACHED;
  const out = new Map<string, string>();
  try {
    const dir = path.join(process.cwd(), "public", "teams");
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (!/\.(svg|png|webp)$/i.test(f)) continue;
        const short = f.replace(/\.(svg|png|webp)$/i, "");
        if (!short || short.startsWith(".")) continue;
        const key = short.toLowerCase();
        if (!out.has(key)) out.set(key, `/teams/${f}`);
      }
    }
  } catch {
    // 스캔 실패해도 graceful — null 리턴.
  }
  CACHED = out;
  return out;
}

/** 팀 short → 로고 파일 경로 (없으면 null). case-insensitive. */
export function teamLogoSrc(
  short: string | undefined | null,
): string | null {
  if (!short || short === "—") return null;
  return getAvailableLogos().get(short.toLowerCase()) ?? null;
}
