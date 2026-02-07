import { videos } from "@/data/videos";
import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";
import VideoGrid from "@/components/VideoGrid";

export default function DeepDivePage() {
  const deepDiveVideos = videos.filter((v) => (v.bins ?? []).includes("Finance"));

  return (
    <AppLayout>
      <Header />
      <section className="max-w-6xl mx-auto px-6 pt-24">
        <h1 className="text-4xl font-bold text-cyan-300 mb-6">Quantum Finance</h1>
        <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-10">
          Finance is one of the most practical entry points for quantum computing.  
          The videos in this section show how portfolio optimization, option pricing, 
          and fraud detection can be formulated as quantum problems.  
          <br /><br />
          Each video is supported by notebooks so you can follow the code, 
          understand the algorithms, and evaluate where quantum may 
          outperform classical methods.
        </p>
        <VideoGrid title="Deep Dive Videos" videos={deepDiveVideos} />
      </section>
    </AppLayout>
  );
}