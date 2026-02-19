'use client';

import { useEffect, useRef, useState } from "react";

type TeaserCardProps = {
  title: string;
  subtitle?: string;

  // 10s local looping teaser
  shortMp4Src: string;
  posterSrc?: string;

  // full URL ok, we will extract the ID
  youtubeUrl: string;
};

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    // youtu.be/<id>
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").trim();
      return id || null;
    }
    // youtube.com/watch?v=<id>
    const v = u.searchParams.get("v");
    if (v) return v;
    // youtube.com/embed/<id>
    const parts = u.pathname.split("/").filter(Boolean);
    const embedIndex = parts.indexOf("embed");
    if (embedIndex >= 0 && parts[embedIndex + 1]) return parts[embedIndex + 1];
    return null;
  } catch {
    return null;
  }
}

export default function TeaserCard({
  title,
  subtitle,
  shortMp4Src,
  posterSrc,
  youtubeUrl,
}: TeaserCardProps) {
  const shortRef = useRef<HTMLVideoElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [open, setOpen] = useState(false);

  const youtubeId = extractYouTubeId(youtubeUrl);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Autoplay short loop unless reduced motion OR overlay is open
  useEffect(() => {
    const v = shortRef.current;
    if (!v) return;

    if (reducedMotion || open) {
      v.pause();
      return;
    }

    v.play().catch(() => {});
  }, [reducedMotion]);

  const onClickCard = () => {
    // user gesture: open inline YouTube player
    setOpen(true);
  };

  const onClose = () => {
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClickCard}
        className="w-full text-left rounded-2xl overflow-hidden ring-1 ring-white/10 bg-white/5 hover:bg-white/10 transition"
        aria-label="Play extended teaser"
      >
        <div className="grid md:grid-cols-[320px_1fr] gap-0">
          <div className="relative">
            <video
              ref={shortRef}
              className="w-full h-full object-cover"
              muted
              loop
              playsInline
              autoPlay
              preload="metadata"
              poster={posterSrc}
            >
              <source src={shortMp4Src} type="video/mp4" />
            </video>
            <div className="absolute bottom-3 left-3 text-xs px-2 py-1 rounded-md bg-black/50 text-white">
              Click to play 1-minute teaser
            </div>
          </div>

          <div className="p-5 text-gray-200">
            <div className="text-cyan-300 font-bold text-lg">{title}</div>
            {subtitle ? (
              <div className="text-gray-300 mt-1 leading-relaxed">{subtitle}</div>
            ) : null}
            <div className="mt-3 text-sm text-gray-400">
              10s preview loops silently. Click to play the extended teaser inline.
            </div>
          </div>
        </div>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-4xl rounded-2xl overflow-hidden ring-1 ring-white/10 bg-neutral-950">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="text-gray-200 font-semibold">Extended teaser</div>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-300 hover:text-white px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition"
              >
                Close
              </button>
            </div>

            <div className="p-4">
              <div className="aspect-video rounded-xl overflow-hidden ring-1 ring-white/10 bg-black">
                {youtubeId ? (
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&playsinline=1`}
                    title="Extended teaser"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <div className="p-6 text-gray-200">
                    Could not parse YouTube ID from the provided URL.
                  </div>
                )}
              </div>
              {subtitle ? (
                <div className="text-gray-400 text-sm mt-3">{subtitle}</div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}