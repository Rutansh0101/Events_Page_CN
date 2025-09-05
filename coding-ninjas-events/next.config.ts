import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Allow loading images from picsum.photos
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
    // Or, simpler:
    // domains: ["picsum.photos"],
  },
};

export default nextConfig;
