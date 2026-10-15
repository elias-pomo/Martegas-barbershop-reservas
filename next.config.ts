import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Mientras haya un solo negocio, la raíz lleva directo a su página.
  async redirects() {
    return [
      {
        source: "/",
        destination: `/${process.env.DEFAULT_BUSINESS_SLUG ?? "martegas"}`,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
