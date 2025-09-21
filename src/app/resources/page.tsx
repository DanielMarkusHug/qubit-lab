import Header from "@/components/Header";
import { resources } from "@/data/resources";
import ResourceList from "@/components/ResourceList";
import AppLayout from "@/components/AppLayout";

export default function ResourcesPage() {
  return (
    <AppLayout>
      <Header />
      <section className="max-w-6xl mx-auto px-6 pt-24">
        <h1 className="text-4xl font-bold text-cyan-300 mb-6">Resources</h1>
        <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-10">
          Here is a curated list of resources to learn more about quantum computing.  
          Each entry includes a link, description, and tags to help you explore the material most relevant to your needs.  
          Use the filter buttons to focus on frameworks, education, research, or practical tools.
        </p>
        <ResourceList resources={resources} />
      </section>
    </AppLayout>
  );
}
