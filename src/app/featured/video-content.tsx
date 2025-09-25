"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { videos } from "@/data/videos";
import VideoList from "@/components/VideoList";
import Header from "@/components/Header";
import { Analytics } from "@vercel/analytics/react";

export default function FeaturedVideoContent() {
  const searchParams = useSearchParams();
  const videoNumber = searchParams.get("video");

  const video = videos.find((v) => String(v.number) === String(videoNumber));

  if (!video) {
    return <div className="p-8 text-white">No video found. Please provide a valid video number.</div>;
  }

  return (
    <main className="relative min-h-screen text-white bg-gradient-to-b from-black via-blue-950 to-black">
      {/* Header */}
      <Header />

      <div className="pt-28 max-w-5xl mx-auto px-6">
        <h1 className="text-4xl font-bold mb-6">Featured Video</h1>

        {/* Single Featured Video */}
        <VideoList videos={[video]} title={`Video ${video.number}`} />

        {/* Navigation Buttons */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center">
          <Link href="/">
            <span className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 transition text-white font-semibold shadow">
              Start Page
            </span>
          </Link>
          <Link href="/strategy">
            <span className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 transition text-white font-semibold shadow">
              Quantum Strategy Videos
            </span>
          </Link>
          <Link href="/finance">
            <span className="px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 transition text-white font-semibold shadow">
              Quantum Finance Use Cases
            </span>
          </Link>
          <Link href="/videos">
            <span className="px-4 py-2 rounded-xl bg-blue-400 hover:bg-blue-500 transition text-black font-semibold shadow">
              All Videos
            </span>
          </Link>
          <Link href="/intro">
            <span className="px-4 py-2 rounded-xl bg-blue-300 hover:bg-blue-400 transition text-black font-semibold shadow">
              Introductory Videos
            </span>
          </Link>
          <Link href="/deepdive">
            <span className="px-4 py-2 rounded-xl bg-blue-200 hover:bg-blue-300 transition text-black font-semibold shadow">
              Tech Deep Dive Videos
            </span>
          </Link>
        </div>
      </div>

      {/* Analytics */}
      <Analytics />
    </main>
  );
}