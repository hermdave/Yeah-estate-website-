import type { NextConfig } from "next";

// Set by the GitHub Pages deploy workflow, since the site is served from
// https://<user>.github.io/<repo>/ rather than the domain root. Empty for
// local dev and for hosts that serve from the root (Vercel, Netlify, ...).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
