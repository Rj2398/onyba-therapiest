/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: "https://onyba.tgastaging.com/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
