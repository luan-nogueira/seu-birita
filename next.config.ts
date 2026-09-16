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
      // Firebase Storage do sistema antigo (Kyte) — alguns produtos ainda
      // não foram migrados pro Cloudinary. Sem isso, o next/image quebra a
      // página inteira (erro de host não configurado), não só a foto.
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
};

export default nextConfig;
