import type { NextConfig } from "next";

const backendOrigin = (process.env.BACKEND_ORIGIN || 'http://127.0.0.1:3001').replace(/\/+$/, '');

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: { proxyClientMaxBodySize: '64mb' },
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${backendOrigin}/api/v1/:path*` }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
