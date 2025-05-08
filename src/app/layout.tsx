import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics /> {/* ✅ Track usage across all pages */}
      </body>
    </html>
  );
}

export const metadata = {
  title: 'Qubit Lab',
  description: 'Quantum computing. Demystified.',
  verification: {
    google: '1xVwE8IosALQcsc9WyNWWjeBpFfY_Ng8kwbg9K_Iqg0'
  }
};