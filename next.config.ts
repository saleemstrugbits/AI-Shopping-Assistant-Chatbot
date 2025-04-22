import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL('http://localhost/saleem-wp/wp-content/uploads/**')],
  },
};

export default nextConfig;
