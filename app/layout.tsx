import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rubis Enjoy — Stock & Reorder",
  description: "Stock counts, reorders and branch messaging for Rubis Enjoy. Supplied by Pure Nutrition.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Rubis Enjoy",
  },
  other: {
    // Next 15's appleWebApp.capable doesn't emit this tag on its own — it's what
    // makes an iPhone "Add to Home Screen" open full-screen instead of in Safari.
    "apple-mobile-web-app-capable": "yes",
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#6DBE00",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 font-sans text-gray-800 antialiased">{children}</body>
    </html>
  );
}
