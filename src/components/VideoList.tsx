"use client";
import { useState } from "react";
import { Video } from "@/data/videos";
import Link from "next/link";
import Image from "next/image";

export default function VideoList({
  videos,
  title,
}: {
  videos: Video[];
  title: string;
}) {
  // Collect all tags
  const allTags = Array.from(new Set(videos.flatMap((v) => v.tags ?? []))).sort();
  const [activeTag, setActiveTag] = useState<string | null>(null);

  if (videos.length === 0) return null;

  const filteredVideos =
    activeTag === null ? videos : videos.filter((v) => v.tags?.includes(activeTag));

  return (
    <section className="max-w-7xl mx-auto px-6 py-16">
      <h2 className="text-4xl font-bold text-center text-cyan-300 mb-10">
        {title}
      </h2>

      {/* Tag Filters */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <button
            onClick={() => setActiveTag(null)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition ${
              activeTag === null
                ? "bg-cyan-600 text-white"
                : "bg-white/10 text-cyan-200 hover:bg-cyan-700 hover:text-white"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                activeTag === tag
                  ? "bg-cyan-600 text-white"
                  : "bg-white/10 text-cyan-200 hover:bg-cyan-700 hover:text-white"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Grid for all videos */}
      <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {filteredVideos.map((video) => (
          <VideoItem key={video.id} video={video} />
        ))}
      </div>
    </section>
  );
}

function VideoItem({ video }: { video: Video }) {
  const [play, setPlay] = useState(false);

  const isPortrait = video.topic === "stq";

  return (
    <div className="relative bg-white/5 p-4 rounded-xl shadow-lg hover:scale-[1.01] transition flex flex-col">
      {/* Video Number Badge */}
      <span className="absolute top-3 right-3 z-20 bg-cyan-600 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg">
        #{video.number}
      </span>

      {/* Thumbnail / Video */}
      <div
        className={`relative overflow-hidden rounded cursor-pointer mb-4
          ${isPortrait ? "aspect-[9/16]" : "aspect-video"}`}
        onClick={() => setPlay(true)}
      >
        {play ? (
          <iframe
            className="w-full h-full"
            src={`https://www.youtube.com/embed/${video.id}?autoplay=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <>
            <Image
              src={`/${video.image}`}
              alt={video.title}
              fill
              className="object-cover z-10"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
              <span className="text-white text-5xl">▶</span>
            </div>
          </>
        )}
      </div>

      {/* Text Content */}
      <div className={`${isPortrait ? "text-center" : ""}`}>
        <h3 className="text-lg font-bold text-cyan-300 mb-2">{video.title}</h3>
        <p className="text-gray-300 text-sm mb-3 line-clamp-3">
          {video.description}
        </p>

        {/* Tags */}
        {video.tags && (
          <div
            className={`flex flex-wrap gap-2 mb-3 ${
              isPortrait ? "justify-center" : ""
            }`}
          >
            {video.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-1 bg-cyan-800/70 text-cyan-200 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Links */}
        {video.links && (
          <div
            className={`flex flex-wrap gap-2 ${
              isPortrait ? "justify-center" : ""
            }`}
          >
            {video.links.map((link) => (
              <Link
                key={link.url}
                href={link.url}
                target="_blank"
                className="inline-block px-3 py-1 bg-cyan-600 text-white rounded-lg text-xs font-semibold hover:bg-cyan-700 transition"
              >
                {link.text}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}