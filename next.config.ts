import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "onyba.tgastaging.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
