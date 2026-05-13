import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE_URL = "https://osirisai.live";
const SITE_NAME = "OSIRIS";
const SITE_TITLE = "OSIRIS — Global Intelligence Platform | Real-Time OSINT Dashboard";
const SITE_DESCRIPTION = "The world's most advanced open-source intelligence (OSINT) platform. Real-time tracking of 10,000+ aircraft, 2,000 satellites, worldwide CCTV cameras, earthquakes, wildfires, nuclear facilities, severe weather, cyber threats, and global conflicts across 20+ live data feeds. The #1 open-source Palantir alternative.";

export const viewport: Viewport = {
  themeColor: "#D4AF37",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  colorScheme: "dark",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s | OSIRIS Intelligence",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "OSINT", "open source intelligence", "intelligence platform", "global intelligence",
    "geospatial intelligence", "GEOINT", "SIGINT", "real-time tracking",
    "flight tracker", "aircraft tracking", "ADS-B", "satellite tracking",
    "CCTV surveillance", "security cameras", "earthquake monitor",
    "wildfire tracker", "nuclear facilities", "severe weather",
    "cyber threats", "threat intelligence", "palantir alternative",
    "open source palantir", "intelligence dashboard", "NMAP scanner",
    "network reconnaissance", "DNS lookup", "WHOIS lookup",
    "geopolitical intelligence", "defense analytics", "commodities tracker",
    "space weather", "GPS jamming", "air quality monitoring",
    "global risk assessment", "security operations center", "SOC dashboard",
    "osiris", "osirisai", "osirisai.live",
  ],
  authors: [{ name: "Osiris Project", url: SITE_URL }],
  creator: "Osiris Project",
  publisher: "Osiris Project",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.svg", type: "image/svg+xml", sizes: "32x32" },
    ],
    apple: "/osiris-icon.png",
    shortcut: "/favicon.svg",
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: "OSIRIS — The World's Most Advanced Open-Source Intelligence Platform",
    description: "Track 10,000+ aircraft, 2,000 satellites, worldwide CCTV, earthquakes, wildfires, nuclear facilities & global conflicts in real-time. 20+ live data feeds. Free. Open Source.",
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: SITE_URL,
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "OSIRIS Global Intelligence Platform — Real-time OSINT Dashboard",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "🛰️ OSIRIS — Global Intelligence Platform",
    description: "20+ live feeds. Aircraft, CCTV, satellites, nuclear facilities, weather, cyber threats & more. The #1 open-source Palantir alternative.",
    creator: "@simplifaisoul",
    site: "@simplifaisoul",
    images: [`${SITE_URL}/og-image.png`],
  },
  category: "technology",
  classification: "Intelligence & Security",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "OSIRIS",
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#06060C",
    "msapplication-config": "none",
  },
};

// JSON-LD Structured Data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  alternateName: "OSIRIS Intelligence Platform",
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "SecurityApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
  featureList: [
    "Real-time flight tracking (10,000+ aircraft)",
    "Satellite tracking (2,000+ objects)",
    "Worldwide CCTV camera monitoring",
    "Earthquake monitoring (USGS feed)",
    "Wildfire detection (NASA FIRMS)",
    "Nuclear facility mapping",
    "Severe weather alerts",
    "Cyber threat intelligence",
    "NMAP network scanner",
    "DNS/WHOIS/BGP reconnaissance",
    "Space weather monitoring",
    "GPS jamming detection",
    "Defense & commodity markets",
    "SIGINT news feed",
    "3D interactive globe",
    "Region dossier reports",
  ],
  screenshot: `${SITE_URL}/og-image.png`,
  author: {
    "@type": "Organization",
    name: "Osiris Project",
    url: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" type="image/svg+xml" sizes="32x32" href="/favicon-32.svg" />
        <link rel="apple-touch-icon" href="/osiris-icon.png" />
        <link rel="canonical" href={SITE_URL} />
        
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
