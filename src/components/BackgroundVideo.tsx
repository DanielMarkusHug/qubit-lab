"use client";
import React from "react";

export default function BackgroundVideo() {
  return (
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
  );
}
