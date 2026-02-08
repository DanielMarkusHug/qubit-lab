import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";

export default function LegalPage() {
  return (
    <AppLayout>
      <Header />

      <section className="max-w-4xl mx-auto px-6 pt-24 pb-24 text-gray-200">
        <h1 className="text-4xl font-bold text-cyan-300 mb-8">Legal</h1>

        <p className="text-lg leading-relaxed mb-10">
          This page contains the legal notice, terms of use, and key privacy
          information for Qubit-Lab.ch.
        </p>

        {/* Legal Notice */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-cyan-300 mb-4">Legal Notice</h2>

          <div className="rounded-xl shadow-lg ring-1 ring-white/10 bg-white/5 p-6">
            <h3 className="text-2xl font-semibold mb-3">Website operator</h3>
            <p className="text-lg leading-relaxed">
              Qubit-Lab.ch
              <br />
              Bitziberg 24
              <br />
              8184 Bachenbülach
              <br />
              Switzerland
            </p>

            <h3 className="text-2xl font-semibold mt-6 mb-3">Contact</h3>
            <p className="text-lg leading-relaxed">
              Email:{" "}
              <a
                href="mailto:contact@qubit-lab.ch"
                className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
              >
                contact@qubit-lab.ch
              </a>
            </p>
          </div>
        </section>

        {/* Terms of Use */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-cyan-300 mb-4">Terms of Use</h2>

          <div className="rounded-xl shadow-lg ring-1 ring-white/10 bg-white/5 p-6 space-y-6">
            <p className="text-lg leading-relaxed">
              All content on this website, including but not limited to slides,
              videos, texts, graphics, templates, code, notebooks, and branding
              elements (collectively, the “Content”), is protected by
              intellectual property laws.
            </p>

            <div>
              <h3 className="text-2xl font-semibold mb-2">Permitted use</h3>
              <p className="text-lg leading-relaxed">
                You may access and view the Content for personal and internal
                evaluation purposes.
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-2">
                Prohibited use unless you have prior written permission
              </h3>
              <ul className="list-disc pl-6 space-y-2 text-lg leading-relaxed">
                <li>
                  Copy, reproduce, distribute, publish, or make the Content
                  publicly available
                </li>
                <li>
                  Reuse the Content in trainings, presentations, consulting
                  deliverables, commercial products, or marketing materials
                </li>
                <li>
                  Modify, translate, or create derivative works based on the
                  Content
                </li>
                <li>
                  Remove copyright notices, watermarks, or attribution
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-2">
                Licensing and permissions
              </h3>
              <p className="text-lg leading-relaxed">
                Licenses for professional use, training delivery,
                redistribution, or reuse of slides, templates, or code are
                available on request. Contact{" "}
                <a
                  href="mailto:contact@qubit-lab.ch"
                  className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
                >
                  contact@qubit-lab.ch
                </a>
                .
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-2">No warranty, no advice</h3>
              <p className="text-lg leading-relaxed">
                The Content is provided for general information only and does
                not constitute professional, legal, financial, or investment
                advice. No warranty is given as to accuracy, completeness, or
                timeliness.
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-2">Liability limitation</h3>
              <p className="text-lg leading-relaxed">
                To the extent permitted by law, the website operator is not
                liable for direct or indirect damages arising from the use of
                this website or the Content.
              </p>
            </div>

            <div>
              <h3 className="text-2xl font-semibold mb-2">
                Governing law and venue
              </h3>
              <p className="text-lg leading-relaxed">
                Swiss law applies. Place of jurisdiction is Zurich, Switzerland,
                unless mandatory law provides otherwise.
              </p>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-cyan-300 mb-4">Privacy</h2>

          <div className="rounded-xl shadow-lg ring-1 ring-white/10 bg-white/5 p-6 space-y-4">
            <p className="text-lg leading-relaxed">
              If you contact us by email, we process the personal data you
              provide solely to handle your request and for related
              communication.
            </p>

            <p className="text-lg leading-relaxed">
              This website may use embedded third party services (for example
              YouTube) or analytics. Such providers may process data according
              to their own policies.
            </p>

            <p className="text-lg leading-relaxed">
              If you publish a dedicated privacy policy page, you can link it
              here (recommended).
            </p>
          </div>
        </section>

        {/* Third-party content */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-cyan-300 mb-4">
            Third-Party Content and Links
          </h2>

          <div className="rounded-xl shadow-lg ring-1 ring-white/10 bg-white/5 p-6 space-y-4">
            <p className="text-lg leading-relaxed">
              Third party content (for example embedded videos, logos, or
              referenced materials) remains the property of its respective
              owners.
            </p>

            <p className="text-lg leading-relaxed">
              External links are provided for convenience. We have no control
              over third party sites and assume no responsibility for their
              content or practices.
            </p>
          </div>
        </section>

        {/* Copyright */}
        // Add this inside your existing /legal page component, in the Copyright section,
        // replacing the current "Suggested slide footer" paragraph.

        <section>
          <h2 className="text-3xl font-bold text-cyan-300 mb-4">Copyright</h2>

          <div className="rounded-xl shadow-lg ring-1 ring-white/10 bg-white/5 p-6">
            <p className="text-lg leading-relaxed">
              © 2026 Qubit-Lab.ch. All rights reserved.
            </p>

            <p className="text-lg leading-relaxed mt-4">
              For permitted licensed reuse only: if your license requires attribution,
              the standard notice is:
            </p>

            <div className="mt-3 rounded-lg bg-black/30 ring-1 ring-white/10 px-4 py-3">
              <code className="text-sm text-gray-200">
                © 2026 Qubit-Lab.ch | All rights reserved | qubit-lab.ch/legal
              </code>
            </div>
          </div>
        </section>
    </AppLayout>
  );
}