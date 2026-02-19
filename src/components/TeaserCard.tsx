'use client';

import { useEffect, useRef, useState } from "react";

type TeaserCardProps = {
  title: string;
  subtitle?: string;
  mp4Src: string;
  webmSrc?: string;
  posterSrc?: string;
};

export default function TeaserCard({
  title,
  subtitle,
  mp4Src,
  webmSrc,
  posterSrc,
}: TeaserCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Autoplay only if user does not prefer reduced motion
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (reducedMotion) {
      v.pause();
      v.currentTime = 0;
      setIsPlaying(false);
      return;
    }

    v.play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, [reducedMotion]);

  const toggle = async () => {
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
      try {
        await v.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden ring-1 ring-white/10 bg-white/5">
      <button
        type="button"
        onClick={toggle}
        className="w-full text-left hover:bg-white/10 transition"
        aria-label="Play or pause teaser"
      >
        <div className="grid md:grid-cols-[320px_1fr] gap-0">
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              loop
              playsInline
              preload="metadata"
              poster={posterSrc}
            >
              {webmSrc ? <source src={webmSrc} type="video/webm" /> : null}
              <source src={mp4Src} type="video/mp4" />
            </video>

            <div className="absolute bottom-3 left-3 text-xs px-2 py-1 rounded-md bg-black/50 text-white">
              {isPlaying ? "Playing" : "Paused"}
            </div>
          </div>

          <div className="p-5 text-gray-200">
            <div className="text-cyan-300 font-bold text-lg">{title}</div>
            {subtitle ? (
              <div className="text-gray-300 mt-1 leading-relaxed">{subtitle}</div>
            ) : null}
            <div className="mt-3 text-sm text-gray-400">
              Click the card to play or pause.
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}