import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";  // 👈 added

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Qubit-Lab",
  description: "Exploring Quantum Computing in Finance and Beyond",
  openGraph: {
    title: "Qubit-Lab",
    description: "Exploring Quantum Computing in Finance and Beyond",
    url: "https://qubit-lab.ch",
    siteName: "Qubit-Lab",
    images: [
      {
        url: "https://qubit-lab.ch/og-image2x.png",
        width: 1200,
        height: 630,
        alt: "Qubit-Lab",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Qubit-Lab",
    description: "Exploring Quantum Computing in Finance and Beyond",
    images: ["https://qubit-lab.ch/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/Icon-192x512.png", sizes: "192x192", type: "image/png" },
      { url: "/Icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
        <SpeedInsights />  {/* 👈 added block */}
      </body>
    </html>
  );
}