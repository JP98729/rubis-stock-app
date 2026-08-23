import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  images: {
    // Photos/signatures are served either from Vercel Blob or the local-dev
    // /local-uploads route; both are used via plain <img>, so no loader config needed.
    unoptimized: true,
  },
};

export default nextConfig;
