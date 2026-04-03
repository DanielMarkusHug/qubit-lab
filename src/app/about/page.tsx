import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";
import Image from "next/image";
import Link from "next/link";

export default function AboutPage() {
  return (
    <AppLayout>
      <Header />

      <section className="max-w-4xl mx-auto px-6 pt-24 text-gray-200">
        <h1 className="text-4xl font-bold text-cyan-300 mb-8">
          About qubit-lab.ch
        </h1>

        <section className="max-w-4xl mx-auto px-0 pt-2 pb-12">
          <h2 className="text-2xl font-bold text-cyan-300 mb-4">
            Watch the Overview
          </h2>

          <div className="max-w-sm sm:max-w-md mx-auto">
            <div className="aspect-[9/16] rounded-xl overflow-hidden shadow-lg ring-1 ring-white/10">
              <iframe
                className="w-full h-full"
                src="https://www.youtube-nocookie.com/embed/MyhqYV0sAbU?rel=0&playsinline=1"
                title="qubit-lab Overview (Short)"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            <p className="text-sm text-gray-400 leading-relaxed mt-3">
              Short introduction to qubit-lab.ch and its practical focus.
            </p>
          </div>
        </section>

        <h2 className="text-3xl font-bold text-cyan-300 mb-6">
          Quantum Computing. Straight Talk.
        </h2>

        <h3 className="text-2xl font-semibold mb-2">What is qubit-lab.ch?</h3>
        <p className="text-lg leading-relaxed mb-6">
          qubit-lab.ch is a platform focused on making quantum computing
          understandable, relevant, and actionable. It connects technical
          foundations with practical questions in business, finance, and selected
          adjacent domains.
        </p>

        <h3 className="text-2xl font-semibold mb-2">Who is it for?</h3>
        <p className="text-lg leading-relaxed mb-6">
          The platform is designed for business leaders, finance professionals,
          technology stakeholders, managers, quants, and technically curious
          practitioners who want a realistic view of quantum computing and its
          implications. The aim is to provide a structured entry point without
          unnecessary hype or unnecessary jargon.
        </p>

        <h3 className="text-2xl font-semibold mb-2">Why now?</h3>
        <p className="text-lg leading-relaxed mb-6">
          Quantum computing is progressing from a purely research-driven topic
          into one that increasingly affects management thinking, security
          planning, innovation agendas, and technology roadmaps. For
          organizations, the implications are becoming more tangible in areas
          such as post-quantum cryptography, strategic positioning, and the
          evaluation of future use cases.
        </p>

        <h3 className="text-2xl font-semibold mb-2">
          How does qubit-lab.ch approach the topic?
        </h3>
        <p className="text-lg leading-relaxed mb-10">
          The focus is on clear explanation, practical orientation, and honest
          framing of what quantum can and cannot do today. This includes videos,
          examples, and selected advisory-oriented material that help translate
          technical concepts into usable insight for real stakeholders.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-6 pt-4 pb-16 text-gray-200">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 md:p-10">
          <h2 className="text-3xl font-bold text-cyan-300 mb-4">
            How qubit-lab.ch can support
          </h2>

          <p className="text-lg leading-relaxed mb-8">
            In addition to public content, qubit-lab.ch supports organizations
            through practical quantum advisory, education, and concrete PQC
            offerings. The strongest current focus is on financial services,
            regulated environments, expert and management education, and
            structured readiness thinking.
          </p>

          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Quantum Advisory
              </h3>
              <p className="text-lg leading-relaxed text-gray-300">
                Structured support for organizations exploring realistic use
                cases, PoCs, and practical decision paths.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Quantum Education
              </h3>
              <p className="text-lg leading-relaxed text-gray-300">
                Executive briefings, management sessions, and expert training
                for teams that need grounded understanding.
              </p>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white mb-2">
                PQC
              </h3>
              <p className="text-lg leading-relaxed text-gray-300">
                Concrete offerings for post-quantum cryptography, including
                PQC Mobilization and PQC Navigator.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              href="/work"
              className="px-5 py-3 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition"
            >
              Explore Work With Me
            </Link>
            <Link
              href="/pqc-navigator"
              className="px-5 py-3 border border-cyan-400 text-cyan-200 rounded-lg font-semibold hover:bg-cyan-400/10 transition"
            >
              Explore PQC Offering
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-20 text-gray-200">
        <h2 className="text-3xl font-bold text-cyan-300 mb-4">
          Example training formats
        </h2>

        <p className="text-lg leading-relaxed mb-8">
          Training formats can be adapted to the audience, context, and time
          available. Typical formats range from management-focused overview
          sessions to deeper workshops for expert and quant teams.
        </p>

        <div className="space-y-10">
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
              Executive overview and decision workshop focused on realistic
              applicability, roadmap thinking, and post-quantum readiness.
            </p>
          </div>

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
              Technical deep dive and hands-on workshops, including topics such
              as QAOA, VQC, and QMC, with emphasis on sound reasoning, practical
              constraints, and realistic expectations.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 mt-12">
          <Link
            href="/work"
            className="px-5 py-3 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition"
          >
            Explore Work With Me
          </Link>
          <a
            href="mailto:contact@qubit-lab.ch"
            className="px-5 py-3 border border-white/15 text-white rounded-lg font-semibold hover:bg-white/10 transition"
          >
            Start the Discussion
          </a>
          <a
            href="https://www.linkedin.com/in/danielhug"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 border border-white/15 text-white rounded-lg font-semibold hover:bg-white/10 transition"
          >
            Connect on LinkedIn
          </a>
        </div>

        <p className="text-lg leading-relaxed mt-10">
          Quantum computing is complex, but increasingly relevant. Organizations
          that start building awareness and structure today will be better
          positioned to mitigate risk, identify realistic opportunities, and
          respond credibly as the field evolves.
        </p>

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