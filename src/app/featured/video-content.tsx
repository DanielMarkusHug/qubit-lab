// app/featured/video-content.tsx
"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { videos } from "@/data/videos";
import VideoList from "@/components/VideoList";

export default function FeaturedVideoContent() {
  const searchParams = useSearchParams();
  const videoNumber = searchParams.get("video");

  const video = videos.find((v) => v.id.toString() === videoNumber);

  if (!video) {
    return <div>No video found. Please provide a valid video number.</div>;
  }

  return (
    <main className="p-8 text-white">
      <h1 className="text-3xl font-bold mb-6">Featured Video</h1>
      <div className="max-w-3xl mx-auto">
        <VideoList videos={[video]} title={`Video ${video.id}`} />

        {/* Navigation Buttons */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link href="/">
            <span className="px-4 py-2 rounded-xl bg-gray-600 hover:bg-gray-700 transition text-white font-semibold shadow">
              Start Page
            </span>
          </Link>
          <Link href="/strategy">
            <span className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 transition text-white font-semibold shadow">
              Quantum Strategy Videos
            </span>
          </Link>
          <Link href="/finance">
            <span className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 transition text-white font-semibold shadow">
              Quantum Finance Use Cases
            </span>
          </Link>
          <Link href="/videos">
            <span className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 transition text-white font-semibold shadow">
              All Videos
            </span>
          </Link>
          <Link href="/intro">
            <span className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 transition text-white font-semibold shadow">
              Introductory Videos
            </span>
          </Link>
          <Link href="/deepdive">
            <span className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 transition text-white font-semibold shadow">
              Tech Deep Dive Videos
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}