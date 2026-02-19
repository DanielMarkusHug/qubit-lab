'use client';

import { useEffect, useRef, useState } from "react";

type TeaserCardProps = {
  title: string;
  subtitle?: string;

  // 10s local looping teaser
  shortMp4Src: string;
  posterSrc?: string;

  // YouTube URL for the extended teaser (embedded inline on click)
  youtubeUrl: string;

  // Optional: volume for YouTube player (0-100). Default 50.
  youtubeVolume?: number;

  // Optional: make the overlay larger (Tailwind max width class)
  overlayMaxWidthClassName?: string; // e.g. "max-w-6xl" or "max-w-7xl"
};

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);

    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").trim();
      return id || null;
    }

    const v = u.searchParams.get("v");
    if (v) return v;

    const parts = u.pathname.split("/").filter(Boolean);
    const embedIndex = parts.indexOf("embed");
    if (embedIndex >= 0 && parts[embedIndex + 1]) return parts[embedIndex + 1];

    return null;
  } catch {
    return null;
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Minimal YouTube IFrame Player API types (only what we use).
 */
type YTPlayer = {
  destroy: () => void;
  playVideo: () => void;
  setVolume: (v: number) => void;
};

type YTPlayerEvent = {
  target: YTPlayer;
};

type YTPlayerConstructor = new (
  elementId: string,
  options: {
    videoId: string;
    playerVars?: Record<string, string | number>;
    events?: {
      onReady?: (e: YTPlayerEvent) => void;
    };
  }
) => YTPlayer;

type YTNamespace = {
  Player: YTPlayerConstructor;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export default function TeaserCard({
  title,
  subtitle,
  shortMp4Src,
  posterSrc,
  youtubeUrl,
  youtubeVolume = 50,
  overlayMaxWidthClassName = "max-w-6xl",
}: TeaserCardProps) {
  const shortRef = useRef<HTMLVideoElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [open, setOpen] = useState(false);

  const youtubeId = extractYouTubeId(youtubeUrl);
  const playerElementId = youtubeId ? `yt-teaser-player-${youtubeId}` : "yt-teaser-player";

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Keep short teaser looping (muted autoplay)
  useEffect(() => {
    const v = shortRef.current;
    if (!v) return;

    v.muted = true;

    if (reducedMotion) {
      v.pause();
      v.currentTime = 0;
      return;
    }

    // Pause the short teaser while the overlay is open (optional)
    if (open) {
      v.pause();
      return;
    }

    v.play().catch(() => {});
  }, [reducedMotion, open]);

  // Load YouTube IFrame API and set volume (default 50%)
  useEffect(() => {
    if (!open) return;
    if (!youtubeId) return;

    let player: YTPlayer | null = null;

    const loadApi = () =>
      new Promise<void>((resolve) => {
        if (window.YT?.Player) return resolve();

        const existing = document.querySelector(
          'script[src="https://www.youtube.com/iframe_api"]'
        );

        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          prev?.();
          resolve();
        };

        if (existing) return;

        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(tag);
      });

    loadApi().then(() => {
      if (!window.YT?.Player) return;

      const vol = clamp(youtubeVolume, 0, 100);

      player = new window.YT.Player(playerElementId, {
        videoId: youtubeId,
        playerVars: {
          autoplay: 1,
          playsinline: 1,
          rel: 0,
        },
        events: {
          onReady: (e) => {
            e.target.setVolume(vol);
            e.target.playVideo();
          },
        },
      });
    });

    return () => {
      try {
        player?.destroy();
      } catch {}
    };
  }, [open, youtubeId, playerElementId, youtubeVolume]);

  const onClickCard = () => setOpen(true);
  const onClose = () => setOpen(false);

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
              <div className="text-gray-300 mt-1 leading-relaxed whitespace-pre-line">
                {subtitle}
              </div>
            ) : null}
            <div className="mt-3 text-sm text-gray-400">
              Click to play the extended quantum landscape preview.
            </div>
          </div>
        </div>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-2 md:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`w-full ${overlayMaxWidthClassName} rounded-2xl overflow-hidden ring-1 ring-white/10 bg-neutral-950`}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="text-gray-200 font-semibold">Extended Preview on Quantum Landscape</div>
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
                  <div id={playerElementId} className="w-full h-full" />
                ) : (
                  <div className="p-6 text-gray-200">
                    Could not parse YouTube ID from the provided URL.
                  </div>
                )}
              </div>

              {subtitle ? (
                <div className="text-gray-400 text-sm mt-3 whitespace-pre-line">
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}