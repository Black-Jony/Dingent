import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  basePath: "/dingent-resource",
  assetPrefix: "/dingent-resource",
  experimental: {
    // Long-running scientific tools can exceed the default proxy timeout.
    proxyTimeout: 300000,
  },

  output: "standalone",
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";

    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
