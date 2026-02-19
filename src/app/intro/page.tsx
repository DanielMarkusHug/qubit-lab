import { videos } from "@/data/videos";
import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";
import VideoGrid from "@/components/VideoGrid";

export default function DeepDivePage() {
  const deepDiveVideos = videos.filter((v) => (v.bins ?? []).includes("Intro"));

  return (
    <AppLayout>
      <Header />
      <section className="max-w-6xl mx-auto px-6 pt-24">
      <h1 className="text-4xl font-bold text-cyan-300 mb-6">Introductory Videos</h1>
        <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-10">
          If you are new to quantum computing, this is the best place to start.  
          We begin with the motivation: why quantum matters at all.  
          Then we explain how qubits, superposition, and entanglement work, 
          and how they differ from classical bits.  
          Finally, we build and run the first simple circuits together in Python.
        </p>
        <VideoGrid title="Intro Videos" videos={deepDiveVideos} />
      </section>
    </AppLayout>
  );
}