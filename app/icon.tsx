import { ImageResponse } from "next/og";

/**
 * 파비콘 — 32×32.
 * Satori 제약: 자식 있는 element 모두 display 명시.
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
            display: "flex",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: "#f59e0b",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
