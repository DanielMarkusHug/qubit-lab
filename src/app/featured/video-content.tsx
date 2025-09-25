"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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

      {/* Hero Section */}
      <section className="flex flex-col md:flex-row items-center max-w-6xl mx-auto px-6 pt-32 gap-8 mb-16">
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
            Unlock the secrets of quantum computing – step by step.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6">

        {/* Single Featured Video */}
        <VideoList videos={[video]} title={`Featured Video #${video.number}`} />

        {/* Navigation Buttons */}
        <div className="mt-8 flex flex-col gap-3 items-center">
          <Link href="/" passHref>
            <span className="block w-full max-w-sm px-4 py-2 rounded-xl bg-blue-200 hover:bg-blue-300 transition text-black font-semibold text-center shadow">
              Start Page
            </span>
          </Link>
          <Link href="/strategy" passHref>
            <span className="block w-full max-w-sm px-4 py-2 rounded-xl bg-blue-200 hover:bg-blue-300 transition text-black font-semibold text-center shadow">
              Quantum Strategy Videos
            </span>
          </Link>
          <Link href="/finance" passHref>
            <span className="block w-full max-w-sm px-4 py-2 rounded-xl bg-blue-200 hover:bg-blue-300 transition text-black font-semibold text-center shadow">
              Quantum Finance Use Cases
            </span>
          </Link>
          <Link href="/videos" passHref>
            <span className="block w-full max-w-sm px-4 py-2 rounded-xl bg-blue-200 hover:bg-blue-300 transition text-black font-semibold text-center shadow">
              All Videos
            </span>
          </Link>
          <Link href="/intro" passHref>
            <span className="block w-full max-w-sm px-4 py-2 rounded-xl bg-blue-200 hover:bg-blue-300 transition text-black font-semibold text-center shadow">
              Introductory Videos
            </span>
          </Link>
          <Link href="/deepdive" passHref>
            <span className="block w-full max-w-sm px-4 py-2 rounded-xl bg-blue-200 hover:bg-blue-300 transition text-black font-semibold text-center shadow">
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