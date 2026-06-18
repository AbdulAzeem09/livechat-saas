import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  devIndicators: false,
  outputFileTracingRoot: path.join(process.cwd(), "../..")
};

export default nextConfig;
