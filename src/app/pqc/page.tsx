import { videos } from "@/data/videos";
import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";
import VideoGrid from "@/components/VideoGrid";
import Image from "next/image";

export default function PQCPage() {
  const pqcVideos = videos.filter((v) => (v.bins ?? []).includes("PQC"));

  return (
    <AppLayout>
      <Header />

      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-4xl mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-cyan-300 mb-6">
            Post-Quantum Cryptography
          </h1>

          <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-4">
            Post-quantum cryptography is becoming a practical management topic for
            regulated institutions, not just a distant technical issue.
          </p>

          <p className="text-gray-300 text-lg leading-relaxed mb-4">
            Cryptography underpins confidentiality, authentication, digital
            signatures, and trusted communication across business and technology
            environments. That means the issue is not only future migration. It
            also affects how organizations think about long-lived confidentiality,
            digital trust, governance, and liability exposure today.
          </p>

          <p className="text-gray-300 text-lg leading-relaxed">
            Qubit Lab supports clients with awareness building, stakeholder
            alignment, and structured readiness assessment for practical next
            steps.
          </p>
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

        <div className="max-w-4xl mb-12">
          <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-4">
            Management exposure does not depend on a dedicated PQC law.
          </p>

          <p className="text-gray-300 text-lg leading-relaxed mb-4">
            Sensitive data captured today may still need protection years from
            now, and digital trust mechanisms created today may need to remain
            defensible in the future. At the same time, regulatory and
            supervisory direction is becoming more explicit across major markets.
          </p>

          <p className="text-gray-300 text-lg leading-relaxed">
            For many organizations, the immediate question is how to move from
            general awareness to a more structured view of exposure, ownership,
            and planning readiness.
          </p>
        </div>

        <section className="mb-16">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-10">
              <h2 className="text-3xl font-bold text-cyan-300 mb-4">
                PQC Mobilization
              </h2>

              <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-4">
                A focused entry step to build awareness, align key stakeholders,
                and create an informed basis for next-step decisions.
              </p>

              <p className="text-gray-300 text-lg leading-relaxed mb-6">
                Designed for organizations that need a practical starting point
                on PQC across management, legal, risk, business, and technology
                stakeholders.
              </p>

              <div className="flex flex-wrap gap-4">
                <a
                  href="/pqc-navigator"
                  className="inline-block px-6 py-3 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700 transition"
                >
                  Explore PQC Mobilization
                </a>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-10">
              <h2 className="text-3xl font-bold text-cyan-300 mb-4">
                PQC Navigator
              </h2>

              <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-4">
                A structured readiness assessment for organizations that want a
                clearer view of current status, key gaps, and planning options.
              </p>

              <p className="text-gray-300 text-lg leading-relaxed mb-6">
                Includes mobilization and then assesses current readiness,
                remaining gaps, and planning maturity across the baseline PQC
                planning flow.
              </p>

              <div className="flex flex-wrap gap-4">
                <a
                  href="/pqc-navigator"
                  className="inline-block px-6 py-3 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700 transition"
                >
                  Explore PQC Navigator
                </a>
                <a
                  href="/contact"
                  className="inline-block px-6 py-3 border border-cyan-400 text-cyan-200 rounded-lg font-bold hover:bg-cyan-400/10 transition"
                >
                  Discuss Your Situation
                </a>
              </div>
            </div>
          </div>
        </section>

        <section>
          <VideoGrid title="Related PQC Videos" videos={pqcVideos} />
        </section>
      </section>
    </AppLayout>
  );
}