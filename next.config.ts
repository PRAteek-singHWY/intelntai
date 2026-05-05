import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained build for container deployment (Cloud Run, Docker, etc).
  output: "standalone",
};

export default nextConfig;
