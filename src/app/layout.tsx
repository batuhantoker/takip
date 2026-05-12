import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OSIRIS — Global Intelligence Platform",
  description: "Open-source geospatial intelligence (OSINT) platform. Real-time tracking of 10K+ aircraft, 2K satellites, worldwide CCTV cameras, earthquakes, wildfires, nuclear facilities, severe weather, air quality, space weather, defense stocks, commodities, and global conflicts. 16+ live API feeds. The #1 open-source Palantir alternative.",
  keywords: ["OSINT", "intelligence", "geospatial", "tracking", "aircraft", "satellites", "CCTV", "open source", "palantir alternative", "real-time", "surveillance", "analytics", "nuclear", "weather", "air quality", "space weather", "commodities", "global intelligence", "dashboard"],
  authors: [{ name: "Osiris Project" }],
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/osiris-icon.png', type: 'image/png' },
    ],
    apple: '/osiris-icon.png',
  },
  openGraph: {
    title: "OSIRIS — Open Source Global Intelligence Platform",
    description: "16+ live data feeds. Track aircraft, satellites, CCTV, earthquakes, wildfires, nuclear facilities, severe weather, commodities & global conflicts in real-time. Free. Open Source.",
    type: "website",
    siteName: "OSIRIS",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "🏛️ OSIRIS — Open Source Global Intelligence Platform",
    description: "16+ live feeds. Aircraft, CCTV, nuclear facilities, weather, commodities & more. The #1 open-source Palantir alternative.",
    creator: "@simplifaisoul",
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
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/osiris-icon.png" />
        <meta name="theme-color" content="#06060C" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
