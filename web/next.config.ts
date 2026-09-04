import type { NextConfig } from "next";

const isGitHubActions = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  basePath: isGitHubActions ? "/layout-lab" : "",
  assetPrefix: isGitHubActions ? "/layout-lab/" : undefined,
};

export default nextConfig;
