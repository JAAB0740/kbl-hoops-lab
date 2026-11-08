/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // lib/archiveData.ts, lib/shotChartsServer.ts 가 런타임에 fs.readFileSync 로
  // data/season/<code>/*.json 을 읽음. Vercel 의 output file tracing 은 동적
  // path (process.cwd() + 변수) 를 못 잡아내므로 명시적으로 포함.
  outputFileTracingIncludes: {
    "/archive/**/*": ["./data/season/**/*.json"],
    "/players/**/*": ["./data/season/**/*.json"],
  },
};

export default nextConfig;
