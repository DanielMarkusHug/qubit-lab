import "./globals.css";
import { ReactNode } from "react";
import BackgroundVideo from "@/components/BackgroundVideo";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="text-white relative min-h-screen">
        <BackgroundVideo />
        <div className="relative z-10 min-h-screen">{children}</div>
      </body>
    </html>
  );
}
