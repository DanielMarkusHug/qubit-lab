import { videos } from "@/data/videos";
import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";
import VideoGrid from "@/components/VideoGrid";
import TeaserCard from "@/components/TeaserCard";

export default function DeepDivePage() {
  const deepDiveVideos = videos.filter((v) => (v.bins ?? []).includes("Strategy"));

  return (
    <AppLayout>
      <Header />
      <section className="max-w-6xl mx-auto px-6 pt-24">
        <h1 className="text-4xl font-bold text-cyan-300 mb-6">Quantum Strategy</h1>
        <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-10">
          Quantum computing is not about counting qubits.  
          It is about understanding how a technology that will mature in the 2030s 
          already creates questions for risk management, corporate governance, 
          and long-term planning today.  
          <br /><br />
          These videos focus on the strategic dimension: regulation, security, 
          and the capability to integrate quantum into business models.
        </p>

        <div className="mb-10">
          <TeaserCard
            title="Quantum Initiatives in Finance (2021–today)"
            subtitle="Click to play the preview. Or play the full video below for comments and more context."
            shortMp4Src="/teasers/finance-teaser-10s.mp4"
            posterSrc="/teasers/finance-teaser.jpg"
            youtubeUrl="https://youtu.be/5bvqJxxYHTQ"
          />
        </div>

        <VideoGrid title="Strategy Videos" videos={deepDiveVideos} />
      </section>
    </AppLayout>
  );
}