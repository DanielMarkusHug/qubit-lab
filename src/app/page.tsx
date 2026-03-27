"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { videos } from "@/data/videos";
import Header from "@/components/Header";

const BIN_ROUTES: Record<string, string> = {
  Finance: "/finance",
  Chemistry: "/chemistry",
  "Deep Dive": "/deepdive",
  Strategy: "/strategy",
  PQC: "/pqc",
  Intro: "/intro",
  STQ: "/stq",
  All: "/all",
};

function formatIsoDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function isVertical(v: { topic: string; image: string }) {
  return v.topic === "stq" || v.image?.toUpperCase().startsWith("STQ-");
}

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const [playing, setPlaying] = useState<Record<string, boolean>>({});
  const togglePlaying = (id: string) =>
    setPlaying((prev) => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = 1.0;

    const tryPlay = () => v.play().catch(() => {});
    v.addEventListener("canplay", tryPlay, { once: true });
    tryPlay();

    return () => v.removeEventListener("canplay", tryPlay);
  }, []);

  const newest6 = useMemo(() => {
    return [...videos].sort((a, b) => b.number - a.number).slice(0, 6);
  }, []);

  const sectionButtons = useMemo(() => {
    const unique = new Set<string>();
    for (const v of videos) (v.bins ?? []).forEach((b) => unique.add(b));
    const ordered = ["STQ", "Strategy", "PQC", "Finance", "Chemistry", "Intro", "Deep Dive"].filter(
      (b) => unique.has(b)
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
      <div className="fixed inset-0 bg-black/70 z-0" />

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
            <p className="text-2xl text-gray-200 mb-6">
              Clear insights for business leaders, practitioners, and quantum enthusiasts.
            </p>
            <p className="text-lg text-gray-300 leading-relaxed max-w-3xl mb-6">
              From executive awareness and quant education to practical use-case framing
              and PQC readiness, Qubit Lab helps organizations understand where quantum
              matters, where it does not, and how to prepare in a structured way.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="/work"
                className="inline-block px-6 py-3 bg-cyan-600 text-white rounded-lg font-bold text-lg hover:bg-cyan-700 transition"
              >
                Work With Me
              </a>
              <a
                href="/pqc_checkup"
                className="inline-block px-6 py-3 border border-cyan-400 text-cyan-200 rounded-lg font-bold text-lg hover:bg-cyan-400/10 transition"
              >
                Explore PQC
              </a>
            </div>
          </div>
        </section>

        {/* Intro Section */}
        <section className="max-w-4xl mx-auto px-6 mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-cyan-300 mb-6">
            Quantum Computing. Straight Talk.
          </h2>
          <p className="text-gray-300 text-xl font-semibold leading-relaxed mb-8">
            Qubit Lab makes quantum computing understandable, relevant, and actionable.
            It is designed for business leaders who need clarity on use cases, timing,
            and strategic implications, and for practitioners who want to understand
            the underlying concepts, algorithms, and code.
            <br />
            <br />
            Through focused videos, practical examples, and advisory-oriented content,
            the platform connects quantum theory with real-world decision-making in
            finance, chemistry, and beyond.
          </p>
        </section>

        {/* Work With Me Preview */}
        <section className="max-w-6xl mx-auto px-6 mb-20">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-10">
            <div className="max-w-4xl mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-cyan-300 mb-4">
                Work With Me
              </h2>
              <p className="text-gray-300 text-lg leading-relaxed">
                Qubit Lab supports organizations that want practical quantum guidance
                rather than abstract technology talk. The strongest current focus is on
                financial services, regulated environments, quantum education, use-case
                framing, and post-quantum cryptography readiness.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3 mb-8">
              <div className="bg-black/20 border border-white/10 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-cyan-200 mb-3">
                  Quantum Advisory
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  Structured support for organizations exploring realistic quantum use cases,
                  PoCs, and decision paths.
                </p>
              </div>

              <div className="bg-black/20 border border-white/10 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-cyan-200 mb-3">
                  Quantum Education
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  Executive briefings, management sessions, and expert training for teams
                  that need clear and grounded understanding.
                </p>
              </div>

              <div className="bg-black/20 border border-white/10 rounded-2xl p-6">
                <h3 className="text-xl font-bold text-cyan-200 mb-3">
                  PQC Checkup
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  A structured starting point for assessing exposure, priorities, and
                  planning needs in post-quantum cryptography readiness.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <a
                href="/work"
                className="inline-block px-6 py-3 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700 transition"
              >
                Explore Work With Me
              </a>
              <a
                href="/contact"
                className="inline-block px-6 py-3 border border-white/15 text-gray-200 rounded-lg font-bold hover:bg-white/10 transition"
              >
                Contact
              </a>
            </div>
          </div>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {newest6.map((v, idx) => {
              const vertical = isVertical(v);
              const padBottom = vertical ? "177.78%" : "56.25%";
              const release = formatIsoDate(v.publishDate);
              const isExpanded = Boolean(expanded[v.id]);
              const isPlaying = Boolean(playing[v.id]);

              return (
                <article
                  key={v.id}
                  className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg flex flex-col h-full"
                >
                  <div
                    className="relative w-full"
                    style={{ paddingBottom: padBottom }}
                  >
                    {isPlaying ? (
                      <iframe
                        className="absolute inset-0 w-full h-full"
                        src={`https://www.youtube-nocookie.com/embed/${v.id}?rel=0&playsinline=1`}
                        title={v.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    ) : (
                      <>
                        <Image
                          src={`/${v.image}`}
                          alt={v.title}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          priority={idx === 0}
                        />
                        <button
                          type="button"
                          onClick={() => togglePlaying(v.id)}
                          className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/35 transition"
                          aria-label={`Play ${v.title}`}
                        >
                          <span className="px-5 py-2 rounded-full bg-cyan-600 text-white font-bold shadow-lg ring-1 ring-white/10">
                            ▶ Play
                          </span>
                        </button>
                      </>
                    )}
                  </div>

                  <div className="p-5 flex flex-col flex-1">
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

                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => togglePlaying(v.id)}
                        className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-cyan-200 text-sm font-semibold hover:bg-white/10 hover:text-cyan-100 transition"
                      >
                        {isPlaying ? "Close video" : "Watch here"}
                      </button>

                      <a
                        href={`https://www.youtube.com/watch?v=${v.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-200 text-sm font-semibold hover:bg-white/10 transition"
                      >
                        Open on YouTube
                      </a>
                    </div>

                    <p
                      className={`text-gray-200 text-sm leading-relaxed mb-3 ${
                        isExpanded ? "" : "line-clamp-6"
                      }`}
                    >
                      {v.description}
                    </p>

                    <button
                      type="button"
                      onClick={() => toggleExpanded(v.id)}
                      className="self-start mb-4 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-cyan-200 text-sm font-semibold hover:bg-white/10 hover:text-cyan-100 transition"
                    >
                      {isExpanded ? "Show less" : "More"}
                    </button>

                    <div className="flex flex-wrap gap-2 mt-auto">
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

          <div className="mt-10 flex flex-wrap gap-3">
            {sectionButtons.map((label) => (
              <a
                key={label}
                href={BIN_ROUTES[label] ?? BIN_ROUTES.All}
                className={
                  label === "All"
                    ? "px-5 py-2 rounded-xl font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/20 border border-white/15 transition"
                    : "px-5 py-2 rounded-xl font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-500/10 border border-white/10 transition"
                }
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