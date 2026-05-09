"use client";

import Link from "next/link";
import { useState } from "react";

interface Headline {
  id: string;
  badge: string;
  title: string;
  time: string;
  /** 내부 deep link (제목 클릭 시) */
  link?: string;
  /** 외부 검색 키워드 (네이버 뉴스) */
  searchQuery?: string;
}

const INITIAL_COUNT = 6;

function naverNewsUrl(query: string): string {
  return `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query)}`;
}

export function Headlines({ items }: { items: Headline[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, INITIAL_COUNT);
  const hasMore = items.length > INITIAL_COUNT;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-50">주요 뉴스</h3>
          <p className="mt-0.5 text-[12px] text-ink-500">
            전체 {items.length}건 · 데이터 기반 자동 생성 · 클릭 시 관련 페이지 이동
          </p>
        </div>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="chip border-court-700 bg-court-800/70 text-ink-300 transition hover:border-flame-500/50 hover:text-flame-400"
          >
            {expanded ? "접기 ↑" : `더보기 (${items.length - INITIAL_COUNT}) →`}
          </button>
        )}
      </div>

      <ul className="space-y-3">
        {visible.map((h) => {
          const inner = (
            <>
              <span className="chip h-fit shrink-0 border-neon-500/30 bg-neon-500/10 text-neon-400">
                {h.badge}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[14px] font-medium leading-snug text-ink-100 transition group-hover:text-flame-400">
                  {h.title}
                </p>
                <p className="mt-1 text-[12px] text-ink-500">{h.time}</p>
              </div>
            </>
          );

          return (
            <li
              key={h.id}
              className="flex items-start gap-2 border-b border-court-700/60 pb-3 last:border-0 last:pb-0"
            >
              {/* 제목·뱃지 영역 — 내부 링크 있으면 Link, 없으면 plain */}
              {h.link ? (
                <Link
                  href={h.link}
                  className="group flex flex-1 items-start gap-3 min-w-0"
                >
                  {inner}
                </Link>
              ) : (
                <div className="group flex flex-1 items-start gap-3 min-w-0">
                  {inner}
                </div>
              )}

              {/* 외부 네이버 뉴스 검색 버튼 */}
              {h.searchQuery && (
                <a
                  href={naverNewsUrl(h.searchQuery)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`"${h.searchQuery}" 네이버 뉴스 검색`}
                  className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-md border border-court-700 bg-court-800/70 text-[12px] text-ink-400 transition hover:border-[#03C75A]/50 hover:bg-[#03C75A]/10 hover:text-[#03C75A]"
                  onClick={(e) => e.stopPropagation()}
                >
                  🔍
                </a>
              )}
            </li>
          );
        })}
      </ul>

      {expanded && hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={() => setExpanded(false)}
            className="chip border-court-700 bg-court-800/70 text-ink-300 hover:border-flame-500/50 hover:text-flame-400"
          >
            접기 ↑
          </button>
        </div>
      )}
    </div>
  );
}
