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
            Post-quantum cryptography is becoming a current management topic for
            regulated institutions.
          </p>

          <p className="text-gray-300 text-lg leading-relaxed mb-4">
            qubit-lab.ch helps clients build awareness, assess relevant
            exposure, and define a practical starting point.
          </p>

          <p className="text-gray-300 text-lg leading-relaxed">
            For more information, contact:{" "}
            <a
              href="mailto:contact@qubit-lab.ch"
              className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
            >
              contact@qubit-lab.ch
            </a>
          </p>
        </div>

        <section className="mb-16">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
              <Image
                src="/EU-Roadmap.jpeg"
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

        <section>
          <VideoGrid title="PQC Videos" videos={pqcVideos} />
        </section>
      </section>
    </AppLayout>
  );
}