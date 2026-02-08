"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { Video } from "@/data/videos";

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
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function isVertical(v: Video) {
  return v.topic === "stq" || v.image?.toUpperCase().startsWith("STQ-");
}

type Props = {
  title?: string;
  videos: Video[];
  showSectionButtonsAtEnd?: boolean; // optional, for future use
};

export default function VideoGrid({ title, videos }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // NEW: inline player state
  const [playing, setPlaying] = useState<Record<string, boolean>>({});

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // NEW: toggle inline player
  const togglePlaying = (id: string) =>
    setPlaying((prev) => ({ ...prev, [id]: !prev[id] }));

  const allTags = useMemo(() => {
    const s = new Set<string>();
    for (const v of videos) (v.tags ?? []).forEach((t) => s.add(t));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [videos]);

  const filtered = useMemo(() => {
    const base = [...videos].sort((a, b) => b.number - a.number);
    if (!activeTag) return base;
    return base.filter((v) => (v.tags ?? []).includes(activeTag));
  }, [videos, activeTag]);

  return (
    <section className="max-w-6xl mx-auto">
      {title ? (
        <h2 className="text-3xl md:text-4xl font-bold text-cyan-300 mb-6">
          {title}
        </h2>
      ) : null}

      {/* Tag filter */}
      {allTags.length > 0 ? (
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="text-gray-200 font-semibold">
              Filter by tag
              {activeTag ? (
                <span className="text-gray-400 font-normal">: {activeTag}</span>
              ) : null}
            </div>

            {activeTag ? (
              <button
                type="button"
                onClick={() => setActiveTag(null)}
                className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-200 text-sm font-semibold hover:bg-white/10 transition"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {allTags.map((t) => {
              const active = t === activeTag;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTag(active ? null : t)}
                  className={
                    active
                      ? "px-3 py-1 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 border border-white/10 text-white text-sm font-bold shadow-lg shadow-cyan-500/10 transition"
                      : "px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-200 text-sm font-semibold hover:bg-white/10 transition"
                  }
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {filtered.map((v, idx) => {
          const vertical = isVertical(v);
          const padBottom = vertical ? "177.78%" : "56.25%"; // 9:16 vs 16:9
          const release = formatIsoDate(v.publishDate);
          const isExpanded = Boolean(expanded[v.id]);
          const isPlaying = Boolean(playing[v.id]);

          return (
            <article
              key={v.id}
              className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg flex flex-col h-full"
            >
              {/* Thumbnail / Inline Player */}
              <div className="relative w-full" style={{ paddingBottom: padBottom }}>
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
                      sizes="(max-width: 768px) 100vw, 33vw"
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

              {/* Content */}
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-cyan-200 font-bold">
                    {String(v.topic).toUpperCase()}#{v.number}
                  </div>
                  {release ? (
                    <div className="text-gray-300 text-sm">Released {release}</div>
                  ) : null}
                </div>

                <h3 className="text-xl font-bold text-white mb-2 leading-snug">
                  {v.title}
                </h3>

                {/* Actions */}
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

                {/* Links */}
                {v.links?.length ? (
                  <div className="mb-4">
                    <div className="text-gray-300 text-sm font-semibold mb-2">
                      Links
                    </div>
                    <div className="flex flex-col gap-2">
                      {v.links.map((l) => (
                        <a
                          key={l.url}
                          href={l.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-cyan-200 hover:text-cyan-100 text-sm font-semibold underline decoration-white/20 hover:decoration-white/40 transition"
                        >
                          {l.text}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Tags (clickable) */}
                {v.tags?.length ? (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {v.tags.map((t) => {
                        const active = t === activeTag;
                        return (
                          <button
                            key={`${v.id}-tag-${t}`}
                            type="button"
                            onClick={() => setActiveTag(active ? null : t)}
                            className={
                              active
                                ? "px-3 py-1 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 border border-white/10 text-white text-sm font-bold shadow-lg shadow-cyan-500/10 transition"
                                : "px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-200 text-sm font-semibold hover:bg-white/10 transition"
                            }
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Bins as buttons */}
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
    </section>
  );
}