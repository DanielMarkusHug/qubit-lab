import { videos } from "@/data/videos";
import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";
import VideoGrid from "@/components/VideoGrid";

export default function DeepDivePage() {
  const deepDiveVideos = videos.filter((v) => (v.bins ?? []).includes("Chemistry"));

  return (
    <AppLayout>
      <Header />
      <section className="max-w-6xl mx-auto px-6 pt-24">
        <h1 className="text-4xl font-bold text-cyan-300 mb-6">Quantum Hamiltonian Simulation in Chemistry</h1>

        <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-8">
          Chemistry is widely regarded as one of the most promising application areas for quantum computing.
          The videos in this section show how molecules can be translated into quantum representations,
          and why Hamiltonian simulation, especially for problems such as ground state energy estimation,
          is considered a leading candidate for achieving real quantum advantage in practice.
          <br /><br />
          The videos connect the underlying physics with the computational workflow,
          helping you understand the modeling steps, the algorithms involved,
          and where quantum methods could eventually surpass classical approaches.
        </p>

        <VideoGrid title="Chemistry Videos" videos={deepDiveVideos} />
      </section>
    </AppLayout>
  );
}