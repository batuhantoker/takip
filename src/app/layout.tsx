import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OSIRIS — Global Intelligence Platform",
  description: "Open-source geospatial intelligence platform. Real-time tracking of aircraft, satellites, maritime vessels, seismic events, and global conflicts. Built on OSINT data.",
  keywords: ["OSINT", "intelligence", "geospatial", "tracking", "aircraft", "satellites", "open source", "palantir alternative"],
  authors: [{ name: "Osiris Project" }],
  openGraph: {
    title: "OSIRIS — Global Intelligence Platform",
    description: "Real-time OSINT dashboard for global situational awareness",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
