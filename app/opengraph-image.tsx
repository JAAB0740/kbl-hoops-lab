import { ImageResponse } from "next/og";

/**
 * Open Graph 이미지 — 1200×630.
 * Next.js 13+ convention: app/opengraph-image.tsx 가 자동으로 metadata 의 og:image 로 설정됨.
 *
 * 카톡/SNS 공유 시 미리보기 카드에 표시될 이미지.
 */
export const runtime = "edge";
export const alt = "KBL Hoops Lab — 2025-26 시즌 분석";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(245, 158, 11, 0.25), transparent 60%), radial-gradient(ellipse 40% 30% at 90% 100%, rgba(14, 165, 233, 0.15), transparent 60%), #07080a",
          color: "#fafafa",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* 상단 — 로고 + 시즌 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >
          {/* 농구공 아이콘 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "rgba(245, 158, 11, 0.15)",
              border: "2px solid rgba(245, 158, 11, 0.5)",
            }}
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: "#f59e0b",
                boxShadow: "0 0 20px 6px rgba(245, 158, 11, 0.5)",
              }}
            />
          </div>
          <span
            style={{
              fontSize: "32px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#f59e0b",
            }}
          >
            KBL HOOPS LAB
          </span>
        </div>

        {/* 가운데 — 메인 타이틀 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                padding: "8px 18px",
                background: "rgba(245, 158, 11, 0.15)",
                color: "#fbbf24",
                fontSize: "22px",
                fontWeight: 600,
                borderRadius: "999px",
                border: "1px solid rgba(245, 158, 11, 0.4)",
              }}
            >
              POST-SEASON
            </span>
            <span style={{ fontSize: "22px", color: "#a1a1aa" }}>
              2025-26 시즌
            </span>
          </div>
          <div
            style={{
              fontSize: "84px",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
              color: "#fafafa",
            }}
          >
            한국프로농구
            <br />
            <span style={{ color: "#f59e0b" }}>스탯 · 분석 · 시각화</span>
          </div>
        </div>

        {/* 하단 — 기능 + 도메인 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              maxWidth: "750px",
            }}
          >
            {[
              "순위", "팀 분석", "선수 프로필", "박스스코어",
              "플레이오프", "4팩터", "샷차트",
            ].map((label) => (
              <span
                key={label}
                style={{
                  padding: "8px 16px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "10px",
                  fontSize: "20px",
                  color: "#ececec",
                }}
              >
                {label}
              </span>
            ))}
          </div>
          <div
            style={{
              fontSize: "20px",
              color: "#71717a",
              fontWeight: 500,
            }}
          >
            kbl-hoops-lab.vercel.app
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
