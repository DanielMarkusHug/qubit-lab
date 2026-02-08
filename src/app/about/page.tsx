import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";
import Image from "next/image";
import Link from "next/link";

export default function AboutPage() {
  return (
    <AppLayout>
      <Header />

      {/* Hero / Intro */}
      <section className="max-w-4xl mx-auto px-6 pt-24 text-gray-200">
        <h1 className="text-4xl font-bold text-cyan-300 mb-8">
          About qubit-lab.ch
        </h1>

        {/* Intro Video */}
        <section className="max-w-4xl mx-auto px-0 pt-2 pb-12">
          <h2 className="text-2xl font-bold text-cyan-300 mb-4">
            Watch the Overview
          </h2>
          <div className="aspect-video rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10">
            <iframe
              className="w-full h-full"
              src="https://www.youtube.com/embed/cy9YVwhnKNQ?rel=0"
              title="qubit-lab Introduction Video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </section>

        {/* Core Narrative */}
        <h2 className="text-3xl font-bold text-cyan-300 mb-6">
          Quantum Computing. Straight Talk.
        </h2>

        <h3 className="text-2xl font-semibold mb-2">Who is this for?</h3>
        <p className="text-lg leading-relaxed mb-6">
          No advanced background in mathematics or physics is required. This
          program is designed for finance professionals, technology leaders,
          managers, and specialists who want to understand the business impact
          of quantum computing. Whether the goal is strategic awareness or
          practical exploration, qubit-lab provides a structured entry point.
        </p>

        <h3 className="text-2xl font-semibold mb-2">Why now?</h3>
        <p className="text-lg leading-relaxed mb-6">
          Quantum computing is advancing from research to early real-world
          applications faster than expected. For corporations, the implications
          are concrete: post-quantum security, competitive advantage, risk
          management, and new business models. While many resources focus
          either on abstract theory or on coding details, qubit-lab bridges the
          gap, translating technical foundations into business relevance.
        </p>

        <h3 className="text-2xl font-semibold mb-2">
          What outcomes can you expect?
        </h3>
        <p className="text-lg leading-relaxed mb-6">
          Participants gain a clear understanding of how quantum systems work,
          how they differ fundamentally from classical IT, and what opportunities
          and risks they create. Decision-makers will be equipped to integrate
          quantum considerations into long-term strategy, while specialists can
          explore hands-on basics with Qiskit in a guided environment.
        </p>
      </section>

      {/* From Awareness to Action */}
      <section className="max-w-4xl mx-auto px-6 pt-6 pb-24 text-gray-200">
        <h2 className="text-3xl font-bold text-cyan-300 mb-4">
          From Awareness to Action
        </h2>
        <p className="text-lg leading-relaxed mb-8">
          Building awareness is only the first step. To capture value,
          organizations need a structured approach, from educating leadership
          to identifying use cases and managing proof-of-concepts. qubit-lab
          supports this journey with tailored services:
        </p>

        <div className="space-y-6">
          <div>
            <h4 className="text-xl font-semibold text-white mb-1">
              Quantum Awareness Building
            </h4>
            <p className="text-lg leading-relaxed">
              Executive briefings and targeted workshops to build a shared
              understanding across leadership and teams.
            </p>
          </div>

          <div>
            <h4 className="text-xl font-semibold text-white mb-1">
              Quantum Consulting
            </h4>
            <p className="text-lg leading-relaxed">
              Strategic guidance on post-quantum security, use case
              identification, and alignment with business priorities.
            </p>
          </div>

          <div>
            <h4 className="text-xl font-semibold text-white mb-1">
              Quantum Project Design &amp; Management
            </h4>
            <p className="text-lg leading-relaxed">
              Structured design and execution of quantum initiatives, from
              proof-of-concepts to implementation, ensuring integration into
              existing processes.
            </p>
          </div>

          <div>
            <h4 className="text-xl font-semibold text-white mb-1">
              Practical Guidance &amp; Enablement
            </h4>
            <p className="text-lg leading-relaxed">
              Introductory coding demonstrations, conceptual guidance, and
              support in overcoming hurdles, always in collaboration with
              technical specialists.
            </p>
          </div>
        </div>

        {/* Training overview */}
        <section className="mt-12">
          <h2 className="text-3xl font-bold text-cyan-300 mb-4">
            Training Modules Overview
          </h2>

          <p className="text-lg leading-relaxed mb-8">
            Two tracks are available, one for leadership and one for expert teams.
            Formats can be adapted to your context and time constraints.
          </p>

          <div className="space-y-10">
            {/* Management */}
            <div>
              <h3 className="text-2xl font-semibold mb-3">
                Management audience
              </h3>

              <a
                href="/training-management.png"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <div className="rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10 bg-white/5">
                  <Image
                    src="/training-management.png"
                    alt="Training modules overview for management audience"
                    width={1600}
                    height={900}
                    className="w-full h-auto"
                    priority={false}
                  />
                </div>
              </a>

              <p className="text-sm text-gray-400 leading-relaxed mt-3">
                Executive overview and decision workshop, focused on realistic applicability,
                roadmap thinking, and post-quantum readiness.
              </p>
            </div>

            {/* Experts */}
            <div>
              <h3 className="text-2xl font-semibold mb-3">
                Expert and quant audience
              </h3>

              <a
                href="/training-experts.png"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <div className="rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10 bg-white/5">
                  <Image
                    src="/training-experts.png"
                    alt="Training modules overview for expert and quant audience"
                    width={1600}
                    height={900}
                    className="w-full h-auto"
                  />
                </div>
              </a>

              <p className="text-sm text-gray-400 leading-relaxed mt-3">
                Technical deep dive plus hands-on workshops, including QAOA, VQC, and QMC,
                with emphasis on correct reasoning, constraints, and practical limits.
              </p>
            </div>
          </div>

          <div className="mt-8">
            <p className="text-lg leading-relaxed">
              For a tailored agenda and commercial proposal, please{" "}
              <Link
                href="/contact"
                className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
              >
                get in touch
              </Link>
              .
            </p>
          </div>
        </section>

        {/* CTA Buttons */}
        <div className="flex flex-wrap gap-4 mt-10">
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
        </div>

        {/* Closing line */}
        <p className="text-lg leading-relaxed mt-10">
          Quantum computing is complex, but increasingly relevant. Organizations
          that start building awareness today will be better positioned to
          mitigate risks, seize opportunities, and actively shape the future of
          this technology.
        </p>

        {/* Legal link */}
        <p className="text-sm text-gray-400 leading-relaxed mt-8">
          Legal notice, terms of use, and privacy information are available{" "}
          <Link
            href="/legal"
            className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
          >
            here
          </Link>
          .
        </p>
      </section>
    </AppLayout>
  );
}