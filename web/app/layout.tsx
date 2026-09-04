import type { Metadata } from "next";
import "./globals.css";
import "./sizing.css";

export const metadata: Metadata = {
  title: "layout-lab",
  description: "Interactive experiments for CSS layout, geometry, sizing algorithms, and 2D/3D transforms.",
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
