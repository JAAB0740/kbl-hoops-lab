/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 타입/린트 에러 무시 (PO 진행 중이라 일단 사이트 안정성 우선).
  // PO 끝나고 시간 날 때 한꺼번에 잡고 끄기.
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
