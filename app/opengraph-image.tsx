import { ImageResponse } from "next/og";

/**
 * Open Graph 이미지 — 1200×630.
 * Next.js 13+ convention: app/opengraph-image.tsx 가 자동으로 metadata 의 og:image 로 설정됨.
 *
 * Satori 엔진 제약: 자식이 있는 모든 element 에 display 속성 명시 필수 (생략 시 빌드 실패).
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
          background: "#07080a",
          color: "#fafafa",
        }}
      >
        {/* 상단: 로고 */}
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              background: "#f59e0b",
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: "32px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "#f59e0b",
            }}
          >
            KBL HOOPS LAB
          </div>
        </div>

        {/* 가운데: 메인 타이틀 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              fontSize: "24px",
              color: "#a1a1aa",
            }}
          >
            2025-26 시즌 · 챔피언결정전 진행 중
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "76px",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              color: "#fafafa",
            }}
          >
            한국프로농구 스탯 · 분석
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "76px",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              color: "#f59e0b",
            }}
          >
            한 화면에서 모두
          </div>
        </div>

        {/* 하단: 도메인 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "12px",
              fontSize: "22px",
              color: "#71717a",
            }}
          >
            순위 · 팀 · 선수 · 박스스코어 · 플레이오프
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "22px",
              color: "#fbbf24",
              fontWeight: 600,
            }}
          >
            kbl-hoops-lab.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
