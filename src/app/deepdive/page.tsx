import { videos } from "@/data/videos";
import VideoList from "@/components/VideoList";
import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";

export default function DeepDivePage() {
  return (
    <AppLayout>
      <Header />
      <section className="max-w-6xl mx-auto px-6 pt-24">
        <h1 className="text-4xl font-bold text-cyan-300 mb-6">Tech Deep Dives</h1>
        <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-10">
          To really understand quantum computing, we need to look under the hood.  
          This section goes step by step through the mathematics of gates, 
          interference, and multi-qubit systems. You will see how linear algebra 
          connects directly to quantum circuits, why reversibility matters, and 
          how entanglement creates complexity that classical computers cannot 
          handle.  
          <br /><br />
          These videos are the technical foundation for advanced quantum programming.
        </p>
        <VideoList
          videos={videos.filter((v) => v.topic === "deepdive")}
          title="Deep Dive Videos"
        />
      </section>
    </AppLayout>
  );
}
