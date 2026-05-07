/**
 * 홈에 표시되는 제작자/사이트 소개 카드.
 *  - 좌측: 짧은 인사
 *  - 하단: 외부 링크 (블로그 등)
 */
export function CreatorCard() {
  return (
    <aside className="card overflow-hidden">
      <div className="relative bg-gradient-to-br from-flame-500/15 via-court-900 to-court-900 px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="chip border-flame-500/40 bg-flame-500/15 text-flame-400">
            ABOUT
          </span>
          <span className="text-[11px] uppercase tracking-[0.12em] text-ink-500">
            제작자
          </span>
        </div>
        <h3 className="mt-3 text-lg font-bold tracking-tight text-ink-50">
          KBL Hoops Lab
        </h3>
        <p className="mt-1.5 text-[12px] leading-relaxed text-ink-300">
          KBL 공식 API·박스스코어 데이터를 기반으로 한 KBL 분석 플랫폼.
          순위·플레이오프·경기 시점 stat·박스스코어·게임로그·선수 메타 정보를
          한 곳에서 정리합니다.
        </p>
      </div>

      <div className="border-t border-court-700/60 px-5 py-4">
        <div className="text-[10px] uppercase tracking-[0.12em] text-ink-500">
          연락처
        </div>
        <div className="mt-2 space-y-1.5">
          <ExternalLink
            label="네이버 블로그"
            href="https://blog.naver.com/bbmaniashin"
            sub="bbmaniashin"
            color="bg-[#03C75A]/15 text-[#03C75A] border-[#03C75A]/30"
          />
        </div>
      </div>

      <div className="border-t border-court-700/60 bg-court-900/40 px-5 py-3 text-[10px] text-ink-500">
        주요 기능: 순위·팀·선수·일정·플레이오프·박스스코어·게임로그
      </div>
    </aside>
  );
}

function ExternalLink({
  label,
  href,
  sub,
  color,
}: {
  label: string;
  href: string;
  sub: string;
  color: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-md border border-court-700/60 bg-court-800/40 px-3 py-2 transition hover:border-court-600 hover:bg-court-700/40"
    >
      <span
        className={[
          "inline-flex h-6 w-6 items-center justify-center rounded border text-[11px] font-bold",
          color,
        ].join(" ")}
        aria-hidden
      >
        N
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[12px] font-medium text-ink-100 group-hover:text-flame-400">
          {label}
        </span>
        <span className="block text-[10px] text-ink-500 truncate">{sub}</span>
      </span>
      <span className="text-ink-500 transition group-hover:text-ink-300">↗</span>
    </a>
  );
}
