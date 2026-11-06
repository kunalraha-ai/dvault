import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared domain package is raw TypeScript — transpile it for Next.
  transpilePackages: [],
  // The mock demo pages (public/demo/*.html) are plain static files and must
  // not be processed by the app router.
  async headers() {
    return [
      {
        source: "/demo/:path*",
        headers: [
          { key: "X-D-Vault-Demo", value: "mock-site" },
        ],
      },
    ];
  },
};

export default nextConfig;
