"use client";

import { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen text-white">
      {/* Background video */}
      <video
        src="/background_slow.mp4"
        className="fixed inset-0 w-full h-full object-cover scale-125 pointer-events-none z-0 brightness-50"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      />

      {/* Overlay must be fixed so it covers full scroll/viewport */}
      <div className="fixed inset-0 bg-black/70 z-0" />

      {/* Content */}
      <div className="relative z-20">{children}</div>
    </main>
  );
}