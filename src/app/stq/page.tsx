import { videos } from "@/data/videos";
import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";
import VideoGrid from "@/components/VideoGrid";

export default function STQPage() {
  const stqVideos = videos.filter((v) => (v.bins ?? []).includes("STQ"));

  return (
    <AppLayout>
      <Header />
      <section className="max-w-4xl mx-auto px-6 pt-24">
        <h1 className="text-4xl font-bold text-cyan-300 mb-6">
          Straight Talk Quantum
        </h1>
        <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-10">
          Short, vertical videos with straight answers to common quantum questions.
          Fast, clear, and to the point - each episode tackles one topic in just a few minutes.
          <br />
          <br />
          Ideal for a quick dive into real challenges and opportunities in quantum computing.
        </p>

        <VideoGrid title="Straight Talk Quantum Episodes" videos={stqVideos} />
      </section>
    </AppLayout>
  );
}