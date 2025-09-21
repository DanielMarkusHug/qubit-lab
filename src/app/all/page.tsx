import { videos } from "@/data/videos";
import VideoList from "@/components/VideoList";
import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";

export default function AllVideosPage() {
  const sortedVideos = [...videos].sort((a, b) => b.number - a.number);

  return (
    <AppLayout>
      <Header />
      <section className="max-w-6xl mx-auto px-6 pt-24">
        <h1 className="text-4xl font-bold text-cyan-300 mb-6">All Videos</h1>
        <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-10">
          This section brings together the complete Qubit-Lab video series — 
          from strategy and business implications to finance use cases, 
          technical deep dives, and introductory lessons.  
          The goal is to build both awareness and understanding: how quantum computing works, 
          where it can be applied, and why it matters today.
          <br /><br />
          Each video combines clear explanation with practical demonstrations, 
          often supported by interactive notebooks. You can follow the code, 
          see algorithms in action, and compare quantum approaches with classical methods.  
          Whether you are seeking a high-level perspective or hands-on experience, 
          this collection allows you to explore at your own pace.
        </p>

        <VideoList videos={sortedVideos} title="All Qubit-Lab Videos" />
      </section>
    </AppLayout>
  );
}
