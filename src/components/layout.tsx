import "./globals.css";
import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="text-white">
        {/* Background video */}
        <video
          src="/background.mp4"
          className="fixed inset-0 w-full h-full object-cover scale-125 pointer-events-none z-0 brightness-50"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/70 z-0" />

        {/* Page content */}
        <div className="relative z-20 min-h-screen">{children}</div>
      </body>
    </html>
  );
}
