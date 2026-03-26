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
        <div className="max-w-4xl mb-14">
          <h1 className="text-4xl md:text-5xl font-bold text-cyan-300 mb-6">
            Post-Quantum Cryptography
          </h1>

          <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-4">
            Post-quantum cryptography refers to cryptographic methods designed to
            withstand future quantum attacks.
          </p>

          <p className="text-gray-300 text-lg leading-relaxed mb-4">
            For regulated institutions, the topic matters because cryptography
            supports confidentiality, authentication, digital signatures, and
            trusted communication across business and technology environments.
          </p>

          <p className="text-gray-300 text-lg leading-relaxed">
            Public roadmaps are now making PQC an increasingly tangible
            management topic, not just a distant technical issue.
          </p>
        </div>

        <section className="mb-16">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
              <Image
                src="/EU-Roadmap.png"
                alt="EU PQC roadmap slide"
                width={1600}
                height={900}
                className="w-full h-auto"
                priority
              />
            </div>

            <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
              <Image
                src="/UK-Roadmap.png"
                alt="UK PQC timeline slide"
                width={1600}
                height={900}
                className="w-full h-auto"
              />
            </div>
          </div>
        </section>

        <div className="max-w-4xl mb-10">
          <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-4">
            The issue is no longer limited to a distant future migration.
          </p>

          <p className="text-gray-300 text-lg leading-relaxed mb-4">
            Sensitive data captured today may still need protection years from
            now, and digital trust mechanisms created today may need to remain
            defensible in the future. In parallel, public PQC roadmaps are
            making regulatory direction and transition expectations increasingly
            tangible.
          </p>

          <p className="text-gray-300 text-lg leading-relaxed">
            Qubit Lab helps clients build awareness, assess relevant exposure,
            and define a practical starting point.
          </p>
        </div>

        <section className="mb-16">
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            <Image
              src="/HNDL-TNFL.png"
              alt="HNDL and TNFL overview slide"
              width={1600}
              height={900}
              className="w-full h-auto"
            />
          </div>
        </section>

        <section className="mb-16">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-10">
            <h2 className="text-3xl font-bold text-cyan-300 mb-4">
              PQC Checkup
            </h2>

            <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-4">
              Qubit Lab also offers a structured PQC Checkup for organizations
              that want to move from awareness to a first practical view of
              exposure, priorities, and planning needs.
            </p>

            <p className="text-gray-300 text-lg leading-relaxed mb-6 max-w-4xl">
              It is designed as a practical starting point for management,
              business, risk, legal, and technology stakeholders who need more
              than general awareness, but are not yet ready for a full migration
              program.
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href="/pqc_checkup"
                className="inline-block px-6 py-3 bg-cyan-600 text-white rounded-lg font-bold hover:bg-cyan-700 transition"
              >
                Explore PQC Checkup
              </a>
              <a
                href="/contact"
                className="inline-block px-6 py-3 border border-cyan-400 text-cyan-200 rounded-lg font-bold hover:bg-cyan-400/10 transition"
              >
                Discuss Your Situation
              </a>
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