import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rubis Enjoy — Stock & Reorder",
  description: "Stock counts, reorders and branch messaging for Rubis Enjoy. Supplied by Pure Nutrition.",
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
