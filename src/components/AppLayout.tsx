"use client";

import { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen text-white">
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
      <div className="absolute inset-0 bg-black/70 z-0" />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </main>
  );
}
