import Image from "next/image";
import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";

export default function PQCCheckupPage() {
  return (
    <AppLayout>
      <Header />

      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-4xl mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-cyan-300 mb-6">
            PQC Checkup
          </h1>

          <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-6">
            A structured starting point for turning post-quantum cryptography
            readiness into a practical management agenda.
          </p>

          <p className="text-gray-300 text-lg leading-relaxed mb-4">
            The PQC Checkup is designed for organizations that want to move from
            broad awareness to a first structured view of exposure,
            dependencies, priorities, and planning needs.
          </p>

          <p className="text-gray-300 text-lg leading-relaxed">
            It is particularly relevant for financial institutions and other
            regulated organizations where long-term confidentiality, digital
            trust, and migration planning already matter today.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 mb-16">
          <a
            href="/contact"
            className="inline-block px-6 py-3 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700 transition"
          >
            Discuss PQC Checkup
          </a>
          <a
            href="/work"
            className="inline-block px-6 py-3 border border-cyan-400 text-cyan-200 rounded-lg font-bold hover:bg-cyan-400/10 transition"
          >
            Back to Work With Me
          </a>
        </div>

        <section className="mb-16">
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            <Image
              src="/HNDL-TNFL.png"
              alt="PQC risks already active today: long-lived confidentiality risk and long-lived trust risk"
              width={1600}
              height={900}
              className="w-full h-auto"
              priority
            />
          </div>
        </section>

        <section className="mb-16">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-10">
            <h2 className="text-3xl font-bold text-cyan-300 mb-6">
              What the PQC Checkup provides
            </h2>

            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="text-xl font-bold text-cyan-200 mb-3">
                  Core focus
                </h3>
                <ul className="text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
                  <li>current-state awareness and readiness tracking</li>
                  <li>identification of cryptographic usage and dependencies</li>
                  <li>linkage to relevant information assets and sensitivity</li>
                  <li>prioritization of action fields and decision needs</li>
                  <li>structured basis for roadmap and follow-on planning</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-bold text-cyan-200 mb-3">
                  Typical client value
                </h3>
                <ul className="text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
                  <li>clearer management view of current readiness and key gaps</li>
                  <li>better alignment across business, risk, legal, and IT</li>
                  <li>more transparent view of urgency and transition implications</li>
                  <li>stronger basis for prioritization, planning, and stakeholder communication</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            <Image
              src="/PQC-Readiness.png"
              alt="PQC readiness and implementation planning approach"
              width={1600}
              height={900}
              className="w-full h-auto"
            />
          </div>
        </section>

        <section className="mb-16">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-cyan-300 mb-4">
                Typical stakeholders
              </h2>
              <ul className="text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
                <li>management and strategy stakeholders</li>
                <li>risk and security functions</li>
                <li>legal and compliance representatives</li>
                <li>IT, architecture, and infrastructure teams</li>
                <li>teams involved in vendor and dependency management</li>
              </ul>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-cyan-300 mb-4">
                Typical outcomes
              </h2>
              <ul className="text-gray-300 space-y-2 list-disc list-inside leading-relaxed">
                <li>structured management summary</li>
                <li>prioritized view of relevant action fields</li>
                <li>clearer picture of where deeper analysis is needed</li>
                <li>practical basis for planning a broader assessment or implementation phase</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            <Image
              src="/Org-Readiness.png"
              alt="Why start now: lead time and organizational readiness"
              width={1600}
              height={900}
              className="w-full h-auto"
            />
          </div>
        </section>

        <section className="mb-16">
          <div className="max-w-4xl">
            <h2 className="text-3xl font-bold text-cyan-300 mb-6">
              Why start now
            </h2>

            <p className="text-gray-300 text-lg leading-relaxed mb-4">
              PQC readiness is not only about a future technical migration.
              It is also about lead time, dependency visibility, internal
              alignment, and management readiness.
            </p>

            <p className="text-gray-300 text-lg leading-relaxed">
              Organizations that start early are better positioned to build
              awareness, identify relevant exposure, and define a credible path
              before external pressure and operational urgency increase.
            </p>
          </div>
        </section>

        <section className="border-t border-white/10 pt-12">
          <h2 className="text-3xl font-bold text-cyan-300 mb-6">
            Start the discussion
          </h2>

          <p className="text-gray-300 text-lg leading-relaxed mb-8 max-w-4xl">
            If PQC is becoming a relevant topic in your organization, a short
            discussion is often the best first step. The goal is not to jump
            into a migration program immediately, but to understand where a
            structured checkup can create clarity and momentum.
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href="/contact"
              className="inline-block px-6 py-3 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700 transition"
            >
              Contact Me
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