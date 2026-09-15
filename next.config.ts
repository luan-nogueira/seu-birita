import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Cloudinary: novo host das fotos de produto.
      { protocol: "https", hostname: "res.cloudinary.com" },
      // ibb.co: mantido pra não quebrar fotos antigas já cadastradas.
      { protocol: "https", hostname: "i.ibb.co" },
      { protocol: "https", hostname: "ibb.co" },
    ],
  },
};

export default nextConfig;
