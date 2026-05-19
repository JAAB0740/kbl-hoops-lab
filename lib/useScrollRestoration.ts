"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Next.js App Router 의 자동 scroll restoration 이 RSC 컨텍스트에서 종종
 * 잘 작동하지 않는 문제를 보완.
 *
 * - 페이지 mount 시 sessionStorage 에 저장된 마지막 scrollY 로 복원
 * - 스크롤할 때마다 throttled 저장 (80ms)
 * - history.scrollRestoration = "manual" 로 브라우저 default 무효화
 *
 * 사용: 페이지 root client 컴포넌트에서 한 번 호출.
 *   - 기본 key: `scroll:{pathname}`
 *   - 같은 pathname 안에서 query 다른 view 가 있으면 key 명시
 */
export function useScrollRestoration(keyOverride?: string) {
  const pathname = usePathname();
  const key = keyOverride ?? `scroll:${pathname}`;

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 브라우저 자동 복원 끄기 (우리가 직접 제어)
    if ("scrollRestoration" in window.history) {
      try {
        window.history.scrollRestoration = "manual";
      } catch {
        // 일부 브라우저에선 read-only — 무시
      }
    }

    // 1) restore on mount (next frame 에서 — layout 완성 후)
    let restoreFrame: number | null = null;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) {
        const y = Number(raw);
        if (Number.isFinite(y) && y > 0) {
          restoreFrame = requestAnimationFrame(() => {
            window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
            restoreFrame = null;
          });
        }
      }
    } catch {
      // ignore
    }

    // 2) save on scroll (throttled)
    let saveTimer: number | null = null;
    const onScroll = () => {
      if (saveTimer != null) return;
      saveTimer = window.setTimeout(() => {
        try {
          sessionStorage.setItem(key, String(window.scrollY));
        } catch {
          // ignore
        }
        saveTimer = null;
      }, 80);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (restoreFrame != null) cancelAnimationFrame(restoreFrame);
      if (saveTimer != null) clearTimeout(saveTimer);
      window.removeEventListener("scroll", onScroll);
      // unmount 직전에 마지막 scrollY 저장 (throttle queue 미실행 보정)
      try {
        sessionStorage.setItem(key, String(window.scrollY));
      } catch {
        // ignore
      }
    };
  }, [key]);
}
