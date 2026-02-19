'use client';

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type TeaserCardProps = {
  title: string;
  subtitle?: string;
  href: string;
  mp4Src: string;
  webmSrc?: string;
  posterSrc?: string;
};

export default function TeaserCard({
  title,
  subtitle,
  href,
  mp4Src,
  webmSrc,
  posterSrc,
}: TeaserCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (reducedMotion) {
      v.pause();
      v.currentTime = 0;
      return;
    }

    v.play().catch(() => {});
  }, [reducedMotion]);

  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl overflow-hidden ring-1 ring-white/10 bg-white/5 hover:bg-white/10 transition"
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
        </div>

        <div className="p-5 text-gray-200">
          <div className="text-cyan-300 font-bold text-lg">{title}</div>
          {subtitle ? (
            <div className="text-gray-300 mt-1 leading-relaxed">{subtitle}</div>
          ) : null}
          <div className="mt-3 text-sm text-gray-400">
            Opens the full video on YouTube.
          </div>
        </div>
      </div>
    </Link>
  );
}