"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { videos } from "@/data/videos";
import Header from "@/components/Header";

const BIN_ROUTES: Record<string, string> = {
  Finance: "/finance",
  "Deep Dive": "/deepdive",
  Strategy: "/strategy",
  Intro: "/intro",
  RQP: "/qaoa-rqp",
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
      <video
        ref={videoRef}
        src="/background_slow.mp4"
        className="fixed inset-0 z-0 h-full w-full scale-125 object-cover brightness-50 pointer-events-none"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-0 bg-black/70" />

      <div className="relative z-20">
        <Header />

        <section className="mx-auto mb-16 flex max-w-6xl flex-col items-center gap-8 px-6 pt-24 md:flex-row">
          <Image
            src="/logo_new_squared2.png"
            alt="Qubit Lab Logo"
            width={220}
            height={220}
            className="rounded-full flex-shrink-0"
          />
          <div>
            <h1 className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-5xl font-extrabold text-transparent md:text-6xl">
              Qubit Lab
            </h1>
            <h2 className="mb-6 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text pb-1 text-4xl font-bold text-transparent md:text-5xl">
              Quantum Computing. Demystified.
            </h2>
            <p className="text-2xl text-gray-200">
              Unlock the secrets of quantum computing - step by step.
            </p>
          </div>
        </section>

        <section className="mx-auto mb-16 max-w-4xl px-6">
          <h2 className="mb-6 text-3xl font-bold text-cyan-300 md:text-4xl">
            Quantum Computing. Straight Talk.
          </h2>
          <p className="mb-8 text-xl font-semibold leading-relaxed text-gray-300">
            Qubit Lab translates quantum computing into practical guidance for decision
            makers and practitioners. I explain how the technology works, where it
            matters for business and finance, and how to move from curiosity to concrete
            next steps. The content is designed for clarity and impact: no unnecessary
            physics, no hype, and a focus on what you can evaluate, pilot, and prepare
            for. Training and advisory are available for teams that want a structured
            path.
          </p>
          <a
            href="/about"
            className="inline-block rounded-lg bg-cyan-600 px-6 py-3 text-lg font-bold text-white transition hover:bg-cyan-700"
          >
            Learn more about Qubit Lab, training and advisory
          </a>
        </section>

        <section className="mx-auto mb-16 max-w-6xl px-6">
          <div className="mb-10 rounded-2xl border border-cyan-900/70 bg-slate-950/80 p-6 shadow-lg">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-cyan-300">
                  New tool
                </p>
                <h2 className="text-2xl font-bold text-white">
                  Quantum Portfolio Optimizer
                </h2>
                <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-300">
                  Test the new Rapid Quantum Prototyping Tool by qubit-lab.ch.
                  Define a portfolio optimization problem in Excel and let the tool
                  build the QUBO, QAOA setup, simulation outputs, and diagnostics.
                </p>
              </div>

              <a
                href="/qaoa-rqp"
                className="inline-flex shrink-0 items-center justify-center rounded-full bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                Open QAOA RQP Tool
              </a>
            </div>
          </div>
        </section>

        <section className="mx-auto mb-16 max-w-6xl px-6">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="text-3xl font-bold text-cyan-300 md:text-4xl">
              Latest videos
            </h2>
            <a
              href={BIN_ROUTES.All}
              className="font-semibold text-cyan-200 hover:text-cyan-100"
            >
              Browse all
            </a>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {newest3.map((v, idx) => {
              const vertical = isVertical(v);
              const padBottom = vertical ? "177.78%" : "56.25%";
              const release = formatIsoDate(v.publishDate);
              const isExpanded = Boolean(expanded[v.id]);

              return (
                <article
                  key={v.id}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg"
                >
                  <a
                    href={`https://www.youtube.com/watch?v=${v.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
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

                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="font-bold text-cyan-200">
                        {String(v.topic).toUpperCase()}#{v.number}
                      </div>
                      {release ? (
                        <div className="text-sm text-gray-300">Released {release}</div>
                      ) : null}
                    </div>

                    <h3 className="mb-2 text-xl font-bold leading-snug text-white">
                      {v.title}
                    </h3>

                    <p
                      className={`mb-3 text-sm leading-relaxed text-gray-200 ${
                        isExpanded ? "" : "line-clamp-6"
                      }`}
                    >
                      {v.description}
                    </p>

                    <button
                      type="button"
                      onClick={() => toggleExpanded(v.id)}
                      className="mb-4 self-start rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-cyan-200 transition hover:bg-white/10 hover:text-cyan-100"
                    >
                      {isExpanded ? "Show less" : "More"}
                    </button>

                    <div className="mt-auto flex flex-wrap gap-2">
                      {(v.bins ?? []).map((b) => (
                        <a
                          key={`${v.id}-${b}`}
                          href={BIN_ROUTES[b] ?? BIN_ROUTES.All}
                          className="rounded-full border border-cyan-400/30 bg-cyan-600/30 px-3 py-1 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-600/45"
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
                    ? "rounded-xl border border-white/15 bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400 hover:to-blue-500"
                    : "rounded-xl border border-white/10 bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 font-bold text-white shadow-lg shadow-cyan-500/10 transition hover:from-cyan-500 hover:to-blue-500"
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