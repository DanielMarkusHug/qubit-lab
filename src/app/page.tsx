"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { videos } from "@/data/videos";
import Header from "@/components/Header";

const BIN_ROUTES: Record<string, string> = {
  Finance: "/finance",
  "Deep Dive": "/deepdive",
  Strategy: "/strategy",
  Intro: "/intro",
  STQ: "/stq",
  All: "/all",
};

function formatIsoDate(iso: string | null): string {
  if (!iso) return "";
  // iso expected: YYYY-MM-DD
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function isVertical(v: { topic: string; image: string }) {
  // STQ thumbnails are typically vertical
  return v.topic === "stq" || v.image?.toUpperCase().startsWith("STQ-");
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = 1.0;

    const tryPlay = () => v.play().catch(() => {});
    v.addEventListener("canplay", tryPlay, { once: true });
    tryPlay();

    return () => v.removeEventListener("canplay", tryPlay);
  }, []);

  const newest3 = useMemo(() => {
    return [...videos].sort((a, b) => b.number - a.number).slice(0, 3);
  }, []);

  const sectionButtons = useMemo(() => {
    const unique = new Set<string>();
    for (const v of videos) {
      (v.bins ?? []).forEach((b) => unique.add(b));
    }
    const ordered = ["STQ", "Strategy", "Finance", "Intro", "Deep Dive"].filter((b) =>
      unique.has(b)
    );
    return ["All", ...ordered];
  }, []);

  return (
    <main className="relative min-h-screen text-white">
      {/* Background Video + Overlay */}
      <video
        ref={videoRef}
        src="/background_slow.mp4"
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
      <div className="relative z-20">
        <Header />

        {/* Hero Section */}
        <section className="flex flex-col md:flex-row items-center max-w-6xl mx-auto px-6 pt-24 gap-8 mb-16">
          <Image
            src="/logo_new_squared2.png"
            alt="Qubit Lab Logo"
            width={220}
            height={220}
            className="rounded-full flex-shrink-0"
          />
          <div>
            <h1 className="text-5xl md:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
              Qubit Lab
            </h1>
            <h2 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-6 pb-1">
              Quantum Computing. Demystified.
            </h2>
            <p className="text-2xl text-gray-200">
              Unlock the secrets of quantum computing - step by step.
            </p>
          </div>
        </section>

        {/* Straight Talk Section */}
        <section className="max-w-4xl mx-auto px-6 mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-cyan-300 mb-6">
            Quantum Computing. Straight Talk.
          </h2>
          <p className="text-gray-300 text-xl font-semibold leading-relaxed mb-8">
            This project bridges the gap between technical depth and business relevance,
            showing how quantum computing works, why it matters, and what it means for
            strategy and practice.
            The focus is on clarity and impact: making the concepts understandable without
            advanced physics, highlighting where quantum could affect industries like finance,
            and offering a perspective that connects technology with real business decisions.
          </p>
          <a
            href="/about"
            className="inline-block px-6 py-3 bg-cyan-600 text-white rounded-lg font-bold text-lg hover:bg-cyan-700 transition"
          >
            Learn more about qubit-lab.ch
          </a>
        </section>

        {/* Latest Videos */}
        <section className="max-w-6xl mx-auto px-6 mb-16">
          <div className="flex items-end justify-between gap-4 mb-6">
            <h2 className="text-3xl md:text-4xl font-bold text-cyan-300">
              Latest videos
            </h2>
            <a
              href={BIN_ROUTES.All}
              className="text-cyan-200 hover:text-cyan-100 font-semibold"
            >
              Browse all
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {newest3.map((v, idx) => {
              const vertical = isVertical(v);
              const padBottom = vertical ? "177.78%" : "56.25%"; // 9:16 vs 16:9
              const release = formatIsoDate(v.publishDate);

              return (
                <article
                  key={v.id}
                  className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg"
                >
                  {/* Thumbnail */}
                  <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noreferrer">
                    <div className="relative w-full" style={{ paddingBottom: padBottom }}>
                      <Image
                        src={`/${v.image}`}
                        alt={v.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                        priority={idx === 0}
                      />
                    </div>
                  </a>

                  {/* Content */}
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="text-cyan-200 font-bold">
                        {String(v.topic).toUpperCase()}#{v.number}
                      </div>
                      {release ? (
                        <div className="text-gray-300 text-sm">
                          Released {release}
                        </div>
                      ) : null}
                    </div>

                    <h3 className="text-xl font-bold text-white mb-2 leading-snug">
                      {v.title}
                    </h3>

                    <p className="text-gray-200 text-sm leading-relaxed line-clamp-4 mb-4">
                      {v.description}
                    </p>

                    {/* Bins as buttons */}
                    <div className="flex flex-wrap gap-2">
                      {(v.bins ?? []).map((b) => (
                        <a
                          key={`${v.id}-${b}`}
                          href={BIN_ROUTES[b] ?? BIN_ROUTES.All}
                          className="px-3 py-1 rounded-full bg-cyan-600/30 border border-cyan-400/30 text-cyan-100 text-sm font-semibold hover:bg-cyan-600/45 transition"
                        >
                          {b}
                        </a>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Section buttons at end */}
          <div className="mt-10 flex flex-wrap gap-3">
            {sectionButtons.map((label) => (
              <a
                key={label}
                href={BIN_ROUTES[label] ?? BIN_ROUTES.All}
                className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition"
              >
                {label === "All" ? "Browse all videos" : `Browse ${label}`}
              </a>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}