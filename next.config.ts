import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
  images: {
    // Photos/signatures are served either from Vercel Blob or the local-dev
    // /local-uploads route; both are used via plain <img>, so no loader config needed.
    unoptimized: true,
  },
  // pdfkit (used by @react-pdf/renderer for the emailed PDFs) loads its built-in
  // font data files with a dynamic require() that Next's file tracing doesn't
  // follow, so the serverless bundle silently omits them — force-include here.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/pdfkit/js/standard-fonts/*.cjs", "./node_modules/pdfkit/js/standard-fonts/*.afm"],
  },
};

export default nextConfig;
