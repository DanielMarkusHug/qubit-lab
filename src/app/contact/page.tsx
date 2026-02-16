import Header from "@/components/Header";
import Feedback from "@/components/Feedback";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";

export default function ContactPage() {
  return (
    <AppLayout>
      <Header />

      <section className="max-w-3xl mx-auto px-6 pt-24 pb-12">
        <h1 className="text-4xl font-bold text-cyan-300 mb-8">Contact</h1>
        <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-10">
          I’m always interested in feedback and suggestions, collaboration ideas,
          or questions about quantum computing and its applications in business and finance.
          Reach out by email, connect on LinkedIn or HiHello, or leave your
          thoughts directly below.
        </p>

        <div className="flex flex-wrap gap-4 mb-12">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText("contact@qubit-lab.ch");
            }}
            className="px-5 py-2 bg-white/5 border border-white/10 text-white rounded-lg font-semibold hover:bg-white/10 transition"
          >
            📋 Email Me: contact@qubit-lab.ch
          </button>

          <a
            href="https://www.linkedin.com/in/danielhug"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition"
          >
            🔗 LinkedIn
          </a>
        </div>
      </section>

      {/* Feedback section (Giscus) */}
      <Feedback />

      {/* Legal link */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        <p className="text-sm text-gray-400 leading-relaxed mt-10">
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