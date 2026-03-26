import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";
import Link from "next/link";
import EmailCopyButton from "./EmailCopyButton";

export default function ContactPage() {
  return (
    <AppLayout>
      <Header />

      <section className="max-w-3xl mx-auto px-6 pt-24 pb-12">
        <h1 className="text-4xl font-bold text-cyan-300 mb-8">Contact</h1>

        <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-6">
          If you are exploring quantum topics in your organization, feel free to get in touch.
        </p>

        <p className="text-gray-300 text-lg leading-relaxed mb-10">
          Typical starting formats include management briefings, expert workshops,
          use-case discussions, and PQC Checkup conversations. The best first
          step is usually a short exchange by email.
        </p>

        <div className="flex flex-wrap gap-4 mb-6">
          <a
            href="mailto:contact@qubit-lab.ch?subject=Discussion%20via%20qubit-lab.ch"
            className="px-5 py-3 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition"
          >
            Start the Discussion
          </a>

          <EmailCopyButton />

          <a
            href="https://www.linkedin.com/in/danielhug"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-3 bg-white/5 border border-white/10 text-white rounded-lg font-semibold hover:bg-white/10 transition"
          >
            Connect on LinkedIn
          </a>
        </div>

        <p className="text-sm text-gray-400 leading-relaxed">
          Or email directly:{" "}
          <a
            href="mailto:contact@qubit-lab.ch"
            className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
          >
            contact@qubit-lab.ch
          </a>
        </p>
      </section>

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