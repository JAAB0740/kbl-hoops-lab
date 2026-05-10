import { ImageResponse } from "next/og";

/**
 * Apple touch icon — 180×180. iOS 홈 화면 추가 시 사용.
 * Satori 제약: 자식 있는 element 모두 display 명시.
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
          background: "#07080a",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            background: "#f59e0b",
            marginBottom: "12px",
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: "28px",
            fontWeight: 800,
            color: "#fafafa",
          }}
        >
          KBL
        </div>
        <div
          style={{
            display: "flex",
            fontSize: "14px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            color: "#f59e0b",
          }}
        >
          HOOPS LAB
        </div>
      </div>
    ),
    { ...size },
  );
}
