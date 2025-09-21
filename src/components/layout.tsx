import "./globals.css";
import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="text-white relative min-h-screen">
        {/* Background */}
        <div className="fixed inset-0 z-0">
          <video
            src="/background.mp4"
            className="absolute inset-0 w-full h-full object-cover scale-125 brightness-50"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-black/70" />
        </div>

        {/* Content */}
        <div className="relative z-10 min-h-screen">{children}</div>
      </body>
    </html>
  );
}
