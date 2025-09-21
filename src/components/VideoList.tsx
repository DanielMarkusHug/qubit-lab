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
  if (videos.length === 0) return null;

  const [filter, setFilter] = useState<string | null>(null);

  // Collect unique tags from the provided videos
  const allTags = Array.from(new Set(videos.flatMap((v) => v.tags || [])));

  // Filter videos by tag if selected
  const filteredVideos = filter
    ? videos.filter((v) => v.tags?.includes(filter))
    : videos;

  return (
    <section className="max-w-6xl mx-auto px-6 py-16">
      <h2 className="text-4xl font-bold text-center text-cyan-300 mb-10">
        {title}
      </h2>

      {/* Filter Buttons */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          <button
            onClick={() => setFilter(null)}
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              filter === null
                ? "bg-cyan-600 text-white"
                : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setFilter(tag)}
              className={`px-3 py-1 rounded-full text-sm font-semibold ${
                filter === tag
                  ? "bg-cyan-600 text-white"
                  : "bg-white/10 text-gray-300 hover:bg-white/20"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Videos */}
      <div className="space-y-12">
        {filteredVideos.map((video) => (
          <VideoItem key={video.id} video={video} />
        ))}
      </div>
    </section>
  );
}

function VideoItem({ video }: { video: Video }) {
  const [play, setPlay] = useState(false);

  return (
    <div className="flex flex-col md:flex-row items-start gap-6 bg-white/5 p-6 rounded-xl shadow-lg hover:scale-[1.01] transition relative">
      {/* Video Number Badge */}
      <span className="absolute top-3 right-3 z-20 bg-cyan-600 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg">
        #{video.number}
      </span>

      {/* Thumbnail or Video */}
      <div
        className="w-full md:w-1/2 aspect-video rounded overflow-hidden relative cursor-pointer"
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
              className="object-cover z-0"
            />
            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="text-white text-5xl">▶</span>
            </div>
          </>
        )}
      </div>

      {/* Text Content */}
      <div className="flex-1">
        <h3 className="text-2xl font-bold text-cyan-300 mb-2">
          {video.title}
        </h3>
        <p className="text-gray-300 mb-4">{video.description}</p>

        {/* Tags */}
        {video.tags && (
          <div className="flex flex-wrap gap-2 mb-4">
            {video.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-cyan-800/70 text-cyan-200 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Multiple Links */}
        {video.links && (
          <div className="flex flex-wrap gap-3">
            {video.links.map((link) => (
              <Link
                key={link.url}
                href={link.url}
                target="_blank"
                className="inline-block px-4 py-2 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition"
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
