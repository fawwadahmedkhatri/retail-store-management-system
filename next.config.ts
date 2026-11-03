import type { NextConfig } from "next";

// GitHub Pages serves static files from https://<user>.github.io/<repo>/, so the
// Pages workflow sets PAGES_BASE_PATH=/<repo> and we export a static site.
// Local dev and PM2 run without it, unchanged.
const basePath = process.env.PAGES_BASE_PATH;

const nextConfig: NextConfig = {
  ...(basePath !== undefined && {
    output: "export",
    basePath,
    trailingSlash: true,
    images: { unoptimized: true },
  }),
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
