
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
      </body>
    </html>
  );
}

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
        url: "https://qubit-lab.ch/og-image2x.png", // <- create and host this image
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
};
