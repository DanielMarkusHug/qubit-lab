import Image from "next/image";
import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";

export default function PQCNavigatorPage() {
  return (
    <AppLayout>
      <Header />

      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-4xl mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-cyan-300 mb-6">
            PQC Navigator
          </h1>

          <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-6">
            A structured readiness assessment for organizations that want a clearer
            view of current status, key gaps, and practical next steps for
            post-quantum cryptography.
          </p>

          <p className="text-gray-300 text-lg leading-relaxed mb-4">
            PQC Navigator is designed for organizations that want to move beyond
            general awareness and develop a more decision-useful view of exposure,
            dependencies, planning maturity, and management priorities.
          </p>

          <p className="text-gray-300 text-lg leading-relaxed">
            It is particularly relevant for financial institutions and other
            regulated organizations where long-lived confidentiality, digital
            trust, governance, and transition readiness already matter today.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 mb-16">
          <a
            href="/contact"
            className="inline-block px-6 py-3 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700 transition"
          >
            Discuss PQC Navigator
          </a>
          <a
            href="/services"
            className="inline-block px-6 py-3 border border-cyan-400 text-cyan-200 rounded-lg font-bold hover:bg-cyan-400/10 transition"
          >
            Back to Services
          </a>
        </div>

        <section className="mb-16">
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            <Image
              src="/PQC-Direction-Liability.png"
              alt="PQC direction is emerging and liability exists today"
              width={1600}
              height={900}
              className="w-full h-auto"
              priority
            />
          </div>
        </section>

        <section className="mb-16">
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            <Image
              src="/PQC-Offerings.png"
              alt="PQC Mobilization and PQC Navigator offering structure"
              width={1600}
              height={900}
              className="w-full h-auto"
            />
          </div>
        </section>

        <section className="mb-16">
          <div className="max-w-4xl">
            <p className="text-gray-300 text-lg leading-relaxed">
              The offering is structured in two steps. PQC Mobilization helps build
              initial awareness and stakeholder alignment. PQC Navigator includes
              that mobilization step and then assesses current planning status,
              key gaps, and practical management options against a baseline PQC
              planning flow.
            </p>
          </div>
        </section>

        <section id="mobilization" className="mb-16">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-10 max-w-4xl">
            <h2 className="text-3xl font-bold text-cyan-300 mb-4">
              PQC Mobilization
            </h2>

            <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-4">
              A focused entry step to build awareness, align key stakeholders, and create
              an informed basis for next-step decisions.
            </p>

            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              Best suited for organizations that first need a practical, workshop-based
              introduction to PQC risk, management relevance, likely exposure areas, and
              cross-functional alignment.
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href="/contact"
                className="inline-block px-6 py-3 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700 transition"
              >
                Discuss PQC Mobilization
              </a>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-10">
            <h2 className="text-3xl font-bold text-cyan-300 mb-6">
              What PQC Navigator provides
            </h2>

            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="text-xl font-bold text-cyan-200 mb-3">
                  Core focus
                </h3>
                <ul className="text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
                  <li>current readiness and planning maturity assessment</li>
                  <li>visibility on cryptographic exposure and dependencies</li>
                  <li>connection between information assets and cryptographic risk</li>
                  <li>identification of key gaps, action areas, and decision points</li>
                  <li>structured basis for strengthening and tailoring the planning approach</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-bold text-cyan-200 mb-3">
                  Typical client value
                </h3>
                <ul className="text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
                  <li>clearer management view of readiness, gaps, and exposure</li>
                  <li>better alignment across business, risk, legal, and technology</li>
                  <li>stronger basis for prioritization and next-step decisions</li>
                  <li>more credible starting point for follow-on planning and implementation</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-cyan-300 mb-4">
                Typical stakeholders
              </h2>
              <ul className="text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
                <li>management and sponsor stakeholders</li>
                <li>risk and security functions</li>
                <li>legal and compliance representatives</li>
                <li>business and information owners</li>
                <li>IT, architecture, and vendor-related teams</li>
              </ul>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-cyan-300 mb-4">
                Typical outputs
              </h2>
              <ul className="text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
                <li>structured management summary</li>
                <li>readiness view across key assessment dimensions</li>
                <li>prioritized gaps and action areas</li>
                <li>practical management options for how to strengthen or start the approach</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <div className="max-w-4xl">
            <h2 className="text-3xl font-bold text-cyan-300 mb-6">
              Why start now
            </h2>

            <p className="text-gray-300 text-lg leading-relaxed mb-4">
              PQC readiness is not only about a future migration. It is also about
              current governance, dependency visibility, stakeholder alignment,
              planning readiness, and the ability to respond before pressure and
              urgency increase.
            </p>

            <p className="text-gray-300 text-lg leading-relaxed">
              Organizations that start early are better positioned to identify
              relevant exposure, create internal alignment, and prepare a more
              credible path forward.
            </p>
          </div>
        </section>

        <section className="border-t border-white/10 pt-12">
          <h2 className="text-3xl font-bold text-cyan-300 mb-6">
            Start the discussion
          </h2>

          <p className="text-gray-300 text-lg leading-relaxed mb-8 max-w-4xl">
            A short discussion is often the best first step. Depending on your
            situation, that may lead into a focused PQC Mobilization or directly
            into a broader PQC Navigator assessment.
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href="/contact"
              className="inline-block px-6 py-3 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700 transition"
            >
              Start the Conversation
            </a>
            <a
              href="/pqc"
              className="inline-block px-6 py-3 border border-white/15 text-gray-200 rounded-lg font-bold hover:bg-white/10 transition"
            >
              Browse PQC Videos
            </a>
          </div>
        </section>
      </section>
    </AppLayout>
  );
}