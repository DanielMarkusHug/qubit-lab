import { videos } from "@/data/videos";
import VideoList from "@/components/VideoList";
import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";

export default function StrategyPage() {
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
        <VideoList
          videos={videos.filter((v) => v.topic === "strategy")}
          title="Strategy Videos"
        />
      </section>
    </AppLayout>
  );
}
