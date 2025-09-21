import "./globals.css";
import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="text-white relative min-h-screen">
        {/* Background container */}
        <div className="fixed inset-0 -z-10">
          {/* Background video */}
          <video
            src="/background.mp4"
            className="w-full h-full object-cover scale-125 brightness-50"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
          />
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/70" />
        </div>

        {/* Page content */}
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
