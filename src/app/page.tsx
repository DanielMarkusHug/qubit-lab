"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { videos } from "@/data/videos";
import VideoList from "@/components/VideoList";
import Header from "@/components/Header";

export default function Home() {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = 0.3;

    const tryPlay = () => v.play().catch(() => {});
    v.addEventListener("canplay", tryPlay, { once: true });
    tryPlay();

    return () => v.removeEventListener("canplay", tryPlay);
  }, []);

  return (
    <main className="relative min-h-screen text-white">
      {/* 🔹 Background Video + Overlay */}
      <video
        ref={videoRef}
        src="/background.mp4"
        className="fixed inset-0 w-full h-full object-cover scale-125 pointer-events-none z-0 brightness-50"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-black/70 z-0" />

      {/* 🔹 Content */}
      <div className="relative z-20">
        {/* Header */}
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
              Unlock the secrets of quantum computing – step by step.
            </p>
          </div>
        </section>

        {/* Straight Talk Section */}
        <section className="max-w-4xl mx-auto px-6 mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-cyan-300 mb-6">
            Quantum Computing. Straight Talk. <br /><br />
          </h2>
          <p className="text-gray-300 text-xl font-semibold leading-relaxed mb-8">
            This project bridges the gap between technical depth and business relevance —
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

        {/* Video Sections */}
        <VideoList
          videos={videos.filter((v) => v.topic === "strategy")}
          title="Quantum Strategy"
        />
        <VideoList
          videos={videos.filter((v) => v.topic === "finance")}
          title="Quantum Finance"
        />
        <VideoList
          videos={videos.filter((v) => v.topic === "intro")}
          title="Introductory Videos"
        />
        <VideoList
          videos={videos.filter((v) => v.topic === "deepdive")}
          title="Deep Dives"
        />
      </div>
    </main>
  );
}
