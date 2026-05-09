"use client";

import { useState } from "react";
import Link from "next/link";
import { TEAM_COLORS } from "@/lib/data";
import { QuarterScoreBox } from "@/components/QuarterScoreBox";
import {
  countdownTo,
  fmtDate,
  gameToId,
  headToHead,
  teamRecentForm,
  type RawGame,
} from "@/lib/gamesUtil";

const TAG_TONES: Record<string, string> = {
  "정규리그": "border-court-700 bg-court-800/70 text-ink-300",
  "6강 PO":   "border-hoop-500/40 bg-hoop-500/10 text-hoop-300",
  "4강 PO":   "border-neon-500/40 bg-neon-500/10 text-neon-300",
  "챔피언결정전": "border-flame-500/50 bg-flame-500/15 text-flame-300",
};

function statusChip(g: RawGame) {
  if (g.status === "final") {
    return (
      <span className="chip border-court-700 bg-court-800/60 text-ink-400">
        종료
      </span>
    );
  }
  if (g.status === "live") {
    return (
      <span className="chip border-buzzer-500/40 bg-buzzer-500/10 text-buzzer-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-buzzer-500" />
        진행 중
      </span>
    );
  }
  return (
    <span className="chip border-court-700 bg-court-800/60 text-ink-400">
      {g.time || "예정"}
    </span>
  );
}

function FormPill({ form }: { form: ("W" | "L")[] }) {
  if (form.length === 0) {
    return <span className="text-[11px] text-ink-500">최근 폼 없음</span>;
  }
  return (
    <span className="inline-flex gap-0.5">
      {form.map((r, i) => (
        <span
          key={i}
          className={[
            "inline-flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold",
            r === "W"
              ? "bg-hoop-500/30 text-hoop-300"
              : "bg-buzzer-500/30 text-buzzer-300",
          ].join(" ")}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

export function GameCard({ game }: { game: RawGame }) {
  const [open, setOpen] = useState(false);

  const homeColor = TEAM_COLORS[game.homeShort] ?? "#94a3b8";
  const awayColor = TEAM_COLORS[game.awayShort] ?? "#94a3b8";

  const isFinal = game.status === "final";
  const homeScore = game.homeScore ?? 0;
  const awayScore = game.awayScore ?? 0;
  const homeWon = isFinal && homeScore > awayScore;
  const awayWon = isFinal && awayScore > homeScore;

  const tagToneClass = TAG_TONES[game.tag] ?? TAG_TONES["정규리그"];

  // expanded 정보 — 이 경기 시점 이전의 폼/H2H 만 집계 (시즌 개막 경기 등에서 미래 경기 끌어오지 않게)
  const homeForm = teamRecentForm(game.homeShort, 5, game.date, game.time);
  const awayForm = teamRecentForm(game.awayShort, 5, game.date, game.time);
  const h2h = headToHead(game.homeShort, game.awayShort, game.date, game.time);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full p-4 text-left transition hover:bg-court-700/20"
      >
        <div className="flex items-center gap-3">
          {/* 좌측: tag + status */}
          <div className="flex w-32 flex-col items-start gap-1.5 shrink-0">
            <span className={["chip", tagToneClass].join(" ")}>{game.tag}</span>
            {statusChip(game)}
            {!isFinal && game.status !== "live" && (
              <span className="text-[11px] text-ink-500">
                {countdownTo(game.date, game.time)}
              </span>
            )}
          </div>

          {/* 가운데: 양 팀 매치업 */}
          <div className="min-w-0 flex-1 space-y-1">
            <TeamRow
              short={game.homeShort}
              full={game.homeTeam}
              score={isFinal ? homeScore : null}
              isWinner={homeWon}
              isHome
              color={homeColor}
            />
            <TeamRow
              short={game.awayShort}
              full={game.awayTeam}
              score={isFinal ? awayScore : null}
              isWinner={awayWon}
              isHome={false}
              color={awayColor}
            />
          </div>

          {/* 우측: chevron */}
          <span
            className={[
              "shrink-0 text-ink-500 transition",
              open ? "rotate-180" : "",
            ].join(" ")}
          >
            ▾
          </span>
        </div>
      </button>

      {/* 펼침 영역 */}
      {open && (
        <div className="border-t border-court-700/60 bg-court-900/40 p-4">
          {/* 쿼터별 스코어 박스 (final 게임만, 데이터 있을 때만) */}
          {isFinal && (
            <div className="mb-4 rounded-md border border-court-700/40 bg-court-800/30 p-2">
              <QuarterScoreBox
                gmkey={game.gmkey}
                homeShort={game.homeShort}
                awayShort={game.awayShort}
                size="sm"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* 홈팀 정보 */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-ink-500">
                홈
              </div>
              <div
                className="mt-1 text-sm font-semibold"
                style={{ color: homeColor }}
              >
                {game.homeTeam}
              </div>
              <div className="mt-2 flex items-center gap-2 text-[12px] text-ink-400">
                <span>최근 5경기</span>
                <FormPill form={homeForm} />
              </div>
            </div>

            {/* 가운데: H2H */}
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-wider text-ink-500">
                이전 상대전적
              </div>
              <div className="mt-1 stat-num text-sm font-semibold text-ink-50">
                <span style={{ color: homeColor }}>{h2h.aWins}</span>
                <span className="mx-2 text-ink-500">vs</span>
                <span style={{ color: awayColor }}>{h2h.bWins}</span>
              </div>
              <div className="mt-1 text-[12px] text-ink-500">
                {h2h.games.length === 0
                  ? "이전 맞대결 없음"
                  : `이전 ${h2h.games.length}회 만남`}
              </div>
              {h2h.games.length > 0 && (
                <div className="mt-2 flex justify-center gap-0.5">
                  {h2h.games.slice(-6).map((g, i) => {
                    const homeWon =
                      g.homeScore != null &&
                      g.awayScore != null &&
                      g.homeScore > g.awayScore;
                    const winner = homeWon ? g.homeShort : g.awayShort;
                    const winColor =
                      winner === game.homeShort ? homeColor : awayColor;
                    return (
                      <span
                        key={i}
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: winColor }}
                        title={`${g.date} · ${g.homeShort} ${g.homeScore}-${g.awayScore} ${g.awayShort}`}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* 원정팀 정보 */}
            <div className="md:text-right">
              <div className="text-[11px] uppercase tracking-wider text-ink-500">
                원정
              </div>
              <div
                className="mt-1 text-sm font-semibold"
                style={{ color: awayColor }}
              >
                {game.awayTeam}
              </div>
              <div className="mt-2 flex items-center gap-2 text-[12px] text-ink-400 md:justify-end">
                <FormPill form={awayForm} />
                <span>최근 5경기</span>
              </div>
            </div>
          </div>

          {/* 상세 페이지 링크 */}
          <div className="mt-4 flex justify-end">
            <Link
              href={`/games/${gameToId(game)}`}
              className="rounded-md border border-flame-500/40 bg-flame-500/10 px-3 py-1.5 text-[13px] font-medium text-flame-400 hover:bg-flame-500/20"
            >
              경기 상세 →
            </Link>
          </div>

          {/* 이전 맞대결 결과 */}
          {h2h.games.length > 0 && (
            <div className="mt-4 border-t border-court-700/40 pt-3">
              <div className="text-[11px] uppercase tracking-wider text-ink-500">
                이전 맞대결
              </div>
              <div className="mt-1.5 space-y-1">
                {h2h.games.slice(-3).reverse().map((g, i) => {
                  const homeWon =
                    g.homeScore != null &&
                    g.awayScore != null &&
                    g.homeScore > g.awayScore;
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between text-[12px]"
                    >
                      <span className="text-ink-500">
                        {fmtDate(g.date)} · {g.tag}
                      </span>
                      <span className="stat-num text-ink-300">
                        <span
                          className={
                            homeWon ? "font-bold text-ink-100" : "text-ink-400"
                          }
                          style={{
                            color: homeWon
                              ? TEAM_COLORS[g.homeShort]
                              : undefined,
                          }}
                        >
                          {g.homeShort} {g.homeScore}
                        </span>
                        <span className="mx-1.5 text-ink-600">-</span>
                        <span
                          className={
                            !homeWon ? "font-bold text-ink-100" : "text-ink-400"
                          }
                          style={{
                            color: !homeWon
                              ? TEAM_COLORS[g.awayShort]
                              : undefined,
                          }}
                        >
                          {g.awayScore} {g.awayShort}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TeamRow({
  short,
  full,
  score,
  isWinner,
  isHome,
  color,
}: {
  short: string;
  full: string;
  score: number | null;
  isWinner: boolean;
  isHome: boolean;
  color: string;
}) {
  return (
    <div
      className={[
        "flex items-center justify-between gap-3",
        isWinner ? "" : score != null ? "opacity-60" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-500 w-7 shrink-0">
          {isHome ? "홈" : "원정"}
        </span>
        <span
          className="truncate text-[14px] font-semibold"
          style={{ color: isWinner ? color : undefined }}
        >
          {full}
        </span>
      </div>
      <div className="shrink-0">
        {score != null ? (
          <span
            className={[
              "stat-num text-[18px] font-bold",
              isWinner ? "" : "text-ink-400",
            ].join(" ")}
            style={{ color: isWinner ? color : undefined }}
          >
            {score}
          </span>
        ) : (
          <span className="text-[13px] text-ink-500">—</span>
        )}
      </div>
    </div>
  );
}
