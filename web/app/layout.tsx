import type { Metadata } from "next";
import "./globals.css";
import "./workbench.css";
import "./workbench-inline.css";
import "./editor-pages.css";
import "./sizing.css";
import "./sizing-depth.css";
import "./grid-depth.css";
import "./three-d-depth.css";
import "./compositing-depth.css";

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
