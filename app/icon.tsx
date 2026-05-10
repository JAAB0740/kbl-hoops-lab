import { ImageResponse } from "next/og";

/**
 * 파비콘 — 32×32. Next.js 13+ convention: app/icon.tsx 자동 인식.
 * 검정 배경에 주황 농구공 점.
 */
export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#07080a",
          borderRadius: "6px",
        }}
      >
        <div
          style={{
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: "#f59e0b",
            boxShadow: "0 0 8px 2px rgba(245, 158, 11, 0.6)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
