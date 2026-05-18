import Link from "next/link";
import { TEAM_COLORS } from "@/lib/data";
import type { HeroCard, HeroTone } from "@/lib/heroCards";
import { HeroCarousel } from "./HeroCarousel";

/**
 * 메인 페이지 상단 4 카드 — "현재 리그의 맥박" 다이나믹 위젯.
 * 정적 stat 요약 대신 매일 갱신 가능한 라이브 카드 4종.
 */

const TONE_BAR: Record<HeroTone, string> = {
  flame: "bg-flame-500",
  neon: "bg-neon-500",
  hoop: "bg-hoop-500",
  buzzer: "bg-buzzer-500",
  gold: "bg-amber-400",
  ink: "bg-court-600",
};

const TONE_VALUE: Record<HeroTone, string> = {
  flame: "text-flame-400",
  neon: "text-neon-400",
  hoop: "text-hoop-400",
  buzzer: "text-buzzer-400",
  gold: "text-amber-300",
  ink: "text-ink-300",
};

const TONE_BADGE: Record<HeroTone, string> = {
  flame: "border-flame-500/30 bg-flame-500/10 text-flame-400",
  neon: "border-neon-500/30 bg-neon-500/10 text-neon-400",
  hoop: "border-hoop-500/30 bg-hoop-500/10 text-hoop-400",
  buzzer: "border-buzzer-500/30 bg-buzzer-500/10 text-buzzer-400",
  gold: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  ink: "border-court-700 bg-court-800/60 text-ink-400",
};

const DEFAULT_DOT_COLOR = "#f97316";

export function HeroCards({ cards }: { cards: HeroCard[] }) {
  const cardNodes = cards.map((c, i) => (
    <HeroCardView key={`${c.kind}-${i}`} card={c} />
  ));
  const dotColors = cards.map(
    (c) =>
      (c.teamShort && TEAM_COLORS[c.teamShort]) || DEFAULT_DOT_COLOR,
  );
  return <HeroCarousel cards={cardNodes} dotColors={dotColors} />;
}

function HeroCardView({ card: c }: { card: HeroCard }) {
  const accent = TONE_BAR[c.tone];
  const valueColor = TONE_VALUE[c.tone];
  const badgeCls = TONE_BADGE[c.tone];
  const teamColor = c.teamShort ? TEAM_COLORS[c.teamShort] : undefined;

  const body = (
    <div className="relative h-full min-h-[180px] overflow-hidden card p-4 transition active:scale-[0.98] md:hover:scale-[1.02] md:hover:border-court-500">
      {/* 좌측 accent bar */}
      <span className={`absolute left-0 top-0 h-full w-1 ${accent}`} />

      {/* 팀 컬러 워터마크 (우상단 원형 글로우) */}
      {teamColor && (
        <span
          className="pointer-events-none absolute -right-10 -top-8 h-32 w-32 rounded-full"
          style={{
            background: `radial-gradient(circle, ${teamColor}33 0%, transparent 70%)`,
          }}
        />
      )}

      {/* 팀 워터마크 — 로고 파일이 있으면 로고 우선, 없으면 큰 팀 약자 텍스트로 fallback */}
      {c.teamShort && c.teamShort !== "—" && (
        <TeamWatermark
          short={c.teamShort}
          color={teamColor}
          logoSrc={c.teamLogoSrc}
        />
      )}

      {/* 헤더: 아이콘 + title + 우상단 badge */}
      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-lg" aria-hidden>
            {c.icon}
          </span>
          <span className="text-[13px] font-medium uppercase tracking-[0.1em] text-ink-500">
            {c.title}
          </span>
        </div>
        {c.badge && (
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${badgeCls}`}
          >
            {c.badge}
          </span>
        )}
      </div>

      {/* 메인 — 선수/팀명 + 큰 수치 */}
      <div className="relative mt-3">
        <div className="text-[15px] font-bold tracking-tight text-ink-50">
          {c.main}
        </div>
        {(c.value || c.unit) && (
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className={`stat-num text-2xl font-bold ${valueColor}`}>
              {c.value ?? "—"}
            </span>
            {c.unit && (
              <span className="text-[12px] text-ink-500">{c.unit}</span>
            )}
          </div>
        )}
      </div>

      {/* 캡션 */}
      <p className="relative mt-2 text-[12px] leading-snug text-ink-300 line-clamp-2">
        {c.caption}
      </p>
    </div>
  );

  if (c.href) {
    return (
      <Link href={c.href} className="block h-full">
        {body}
      </Link>
    );
  }
  return <div className="h-full">{body}</div>;
}

/**
 * 카드 우하단 팀 워터마크.
 *  - logoSrc 가 있으면 (public/teams/{short}.svg 존재) 로고 이미지를 10% opacity 로 표시
 *  - 없으면 팀 약자(short)를 큰 텍스트 SVG 로 fallback
 *
 * 둘 다 carrier 역할만 — pointer-events: none, 카드 안쪽 우하단에 고정.
 */
function TeamWatermark({
  short,
  color,
  logoSrc,
}: {
  short: string;
  color: string | undefined;
  logoSrc: string | undefined;
}) {
  const tone = color ?? "#ffffff";
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute -bottom-2 -right-2 flex h-20 w-20 items-center justify-center"
    >
      {logoSrc ? (
        // 로고 파일이 있을 때 — 10% opacity 워터마크
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc}
          alt=""
          className="h-full w-full object-contain opacity-[0.12]"
          loading="lazy"
        />
      ) : (
        // 없을 때 — 팀 약자 큰 글자 SVG fallback
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={short.length <= 2 ? 56 : short.length === 3 ? 36 : 28}
            fontWeight="900"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Pretendard', sans-serif"
            fill={tone}
            fillOpacity="0.12"
            letterSpacing="-1"
          >
            {short}
          </text>
        </svg>
      )}
    </span>
  );
}
