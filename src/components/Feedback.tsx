"use client";
import Giscus from "@giscus/react";

export default function Feedback() {
  return (
    <section
      id="comments"
      className="max-w-6xl mx-auto px-6 pb-20 space-y-14 relative z-10"
    >
      <div className="bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl p-6 shadow-2xl hover:scale-[1.01] transition">
        <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">
          What’s On Your Mind?
        </h2>
        <Giscus
          id="comments"
          repo="DanielMarkusHug/qubit-lab-comments"
          repoId="R_kgDOOh8qEA"
          category="General"
          categoryId="DIC_kwDOOh8qEM4Cpmp3"
          mapping="pathname"
          reactionsEnabled="1"
          emitMetadata="0"
          inputPosition="bottom"
          theme="light"
          lang="en"
          loading="lazy"
        />
      </div>
    </section>
  );
}
