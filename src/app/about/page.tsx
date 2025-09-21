import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";

export default function AboutPage() {
  return (
    <AppLayout>
      <Header />
      <section className="max-w-4xl mx-auto px-6 pt-24 text-gray-200">
        <h1 className="text-4xl font-bold text-cyan-300 mb-8">
          About Qubit-Lab.ch
        </h1>

        {/* Intro Video */}
        <section className="max-w-4xl mx-auto px-6 pt-12 pb-16">
          <h2 className="text-2xl font-bold text-cyan-300 mb-4">
            Watch the Overview
          </h2>
          <div className="aspect-video rounded-xl overflow-hidden shadow-lg">
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/cy9YVwhnKNQ?rel=0"
              title="Qubit-Lab Introduction Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>

        <h2 className="text-3xl font-bold text-cyan-300 mb-6">
          Quantum Computing. Straight Talk.
        </h2>

        <h3 className="text-2xl font-semibold mb-2">Who is this for?</h3>
        <p className="text-lg leading-relaxed mb-6">
          You do not need an advanced background in mathematics or physics.
          This series is designed for finance professionals, technology
          leaders, managers, students, and anyone curious about how quantum
          computing will affect business and society. Whether your goal is to
          explore hands-on programming or to understand the strategic
          implications, Qubit-Lab provides a structured entry point.
        </p>

        <h3 className="text-2xl font-semibold mb-2">Why explore quantum computing?</h3>
        <p className="text-lg leading-relaxed mb-6">
          Quantum computing is moving from research to early real-world
          application faster than expected. Beyond its scientific appeal, it
          raises concrete questions for corporate strategy: post-quantum
          security, competitive advantage, new business models, and risk
          management. Many resources focus either purely on the theory or
          purely on coding. Qubit-Lab aims to bridge this gap — connecting
          technical foundations with their direct business relevance.
        </p>

        <h3 className="text-2xl font-semibold mb-2">What will you achieve?</h3>
        <p className="text-lg leading-relaxed mb-6">
          You will gain a clear understanding of how quantum computers store
          and process information, how they differ fundamentally from todays
          systems, and what opportunities and risks they create for
          enterprises. If you are interested in the technical side, you will
          also learn to design simple circuits in Python using Qiskit. The
          overall aim is to prepare you for deeper exploration — whether as a
          decision-maker shaping long-term strategy or as a practitioner
          experimenting with new solutions.
        </p>

        <h3 className="text-2xl font-semibold mb-2">Begin the journey…</h3>
        <p className="text-lg leading-relaxed">
          Quantum computing is not trivial, but it is becoming increasingly
          relevant. Organizations and individuals who start building awareness
          today will be better positioned to manage risks, understand
          opportunities, and actively contribute as the field progresses.
        </p>
      </section>

      {/* Awareness & Support */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-24 text-gray-200">
        <h2 className="text-3xl font-bold text-cyan-300 mb-6">
          Awareness and Support
        </h2>
        <p className="text-lg leading-relaxed mb-6">
          Understanding quantum computing is not just about technology — it is
          also about building awareness across management and teams. I offer
          sessions that explain the essentials in clear business language,
          illustrate practical use cases, and introduce simple coding
          exercises. The aim is to make quantum computing accessible and
          relevant for different audiences within an organization.
        </p>
        <p className="text-lg leading-relaxed mb-8">
          Beyond awareness, I offer support in preparing, planning, and
          executing a companys quantum roadmap. This can include workshops for
          leadership, use case exploration for business units, and hands-on
          sessions for those interested in coding. The focus is always on
          aligning technology insights with business priorities — ensuring that
          organizations are ready for the opportunities and challenges ahead.
        </p>

        <div className="flex flex-wrap gap-4">
          <a
            href="mailto:daniel.hug@qubit-lab.ch"
            className="px-5 py-2 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition"
          >
            📧 Email Me
          </a>
          <a
            href="https://www.linkedin.com/in/danielhug"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition"
          >
            🔗 LinkedIn
          </a>
          <a
            href="https://hihello.me/p/952356c5-423a-4aee-b1ae-05973a468ac6"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition"
          >
            💼 HiHello
          </a>
        </div>
      </section>
    </AppLayout>
  );
}
