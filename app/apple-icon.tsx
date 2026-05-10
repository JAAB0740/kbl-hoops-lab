import { ImageResponse } from "next/og";

/**
 * Apple touch icon — 180×180. iOS 홈 화면 추가 시 사용.
 * Next.js 13+ convention: app/apple-icon.tsx.
 */
export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(245, 158, 11, 0.3), transparent 60%), #07080a",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* 농구공 점 */}
        <div
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            background: "#f59e0b",
            boxShadow: "0 0 30px 8px rgba(245, 158, 11, 0.6)",
            marginBottom: "16px",
          }}
        />
        {/* 텍스트 */}
        <div
          style={{
            fontSize: "28px",
            fontWeight: 800,
            letterSpacing: "0.05em",
            color: "#fafafa",
          }}
        >
          KBL
        </div>
        <div
          style={{
            fontSize: "16px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            color: "#f59e0b",
            marginTop: "2px",
          }}
        >
          HOOPS LAB
        </div>
      </div>
    ),
    { ...size },
  );
}
