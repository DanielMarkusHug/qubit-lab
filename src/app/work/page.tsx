import Image from "next/image";
import Header from "@/components/Header";
import AppLayout from "@/components/AppLayout";

export default function WorkWithMePage() {
  return (
    <AppLayout>
      <Header />

      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <h1 className="text-4xl font-bold text-cyan-300 mb-6">
          Work With Me
        </h1>

        <p className="text-gray-200 text-xl font-semibold leading-relaxed mb-6">
          Practical quantum guidance for business, finance, and technical teams.
        </p>

        <p className="text-gray-300 text-lg leading-relaxed mb-10 max-w-4xl">
          Qubit Lab supports organizations that want to understand where quantum matters,
          how to prepare, and how to turn interest into a credible next step.
          The focus is on practical relevance rather than hype: executive awareness,
          structured evaluation of use cases, expert training, and PQC readiness.
          Particular emphasis is placed on financial services and regulated environments,
          while selected adjacent topics can also be supported.
        </p>

        <div className="flex flex-wrap gap-4 mb-12">
          <a
            href="/contact"
            className="px-6 py-3 rounded-lg bg-cyan-400 text-black font-semibold hover:bg-cyan-300 transition"
          >
            Discuss Your Situation
          </a>
          <a
            href="/pqc_checkup"
            className="px-6 py-3 rounded-lg border border-cyan-400 text-cyan-300 font-semibold hover:bg-cyan-400/10 transition"
          >
            Explore PQC Checkup
          </a>
        </div>

        <div className="mb-16">
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
        </div>

        <section className="mb-16">
          <h2 className="text-3xl font-bold text-cyan-300 mb-6">
            How I can support
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed max-w-4xl mb-4">
            Engagements are tailored to the maturity, goals, and audience of your organization.
            In practice, most collaboration starts through one of three entry points.
          </p>
          <p className="text-gray-400 text-base leading-relaxed max-w-4xl">
            Typical starting formats: management briefing, expert workshop, use-case discussion,
            or PQC Checkup conversation.
          </p>
        </section>

        <section className="grid gap-8 md:grid-cols-3 mb-16">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-2xl font-bold text-cyan-300 mb-3">
              Quantum Advisory
            </h3>
            <p className="text-gray-200 font-semibold mb-4">
              From first questions to structured next steps
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              For organizations exploring where quantum may become relevant,
              whether from a strategy, innovation, or technical perspective.
            </p>
            <h4 className="text-white font-semibold mb-2">Typical topics</h4>
            <ul className="text-gray-300 space-y-2 list-disc list-inside mb-4">
              <li>identifying realistic use cases</li>
              <li>separating signal from hype</li>
              <li>framing internal discussions and decisions</li>
              <li>shaping an initial PoC or evaluation path</li>
              <li>translating between business and technical stakeholders</li>
            </ul>
            <h4 className="text-white font-semibold mb-2">Typical deliverables</h4>
            <ul className="text-gray-300 space-y-2 list-disc list-inside">
              <li>management briefing</li>
              <li>structured use-case view</li>
              <li>PoC framing and recommendation</li>
              <li>discussion support across stakeholder groups</li>
            </ul>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-2xl font-bold text-cyan-300 mb-3">
              Quantum Education
            </h3>
            <p className="text-gray-200 font-semibold mb-4">
              Targeted learning for decision-makers and expert teams
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              For organizations that want a clearer internal understanding of quantum computing,
              tailored either to senior management or to technically engaged teams.
            </p>
            <h4 className="text-white font-semibold mb-2">Formats</h4>
            <ul className="text-gray-300 space-y-2 list-disc list-inside mb-4">
              <li>executive awareness sessions</li>
              <li>management briefings</li>
              <li>quant and expert training</li>
              <li>tailored workshops</li>
            </ul>
            <h4 className="text-white font-semibold mb-2">Typical outcomes</h4>
            <ul className="text-gray-300 space-y-2 list-disc list-inside">
              <li>clearer understanding of relevance and limitations</li>
              <li>stronger internal alignment</li>
              <li>better basis for decisions on experimentation or readiness</li>
              <li>more confidence in discussions with vendors and internal teams</li>
            </ul>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h3 className="text-2xl font-bold text-cyan-300 mb-3">
              PQC Checkup
            </h3>
            <p className="text-gray-200 font-semibold mb-4">
              A structured starting point for post-quantum cryptography readiness
            </p>
            <p className="text-gray-300 leading-relaxed mb-4">
              For organizations that want to move from broad awareness to a first structured
              view of exposure, priorities, and planning needs.
            </p>
            <h4 className="text-white font-semibold mb-2">Focus areas</h4>
            <ul className="text-gray-300 space-y-2 list-disc list-inside mb-4">
              <li>current-state awareness</li>
              <li>cryptographic exposure and dependency mapping</li>
              <li>long-term confidentiality considerations</li>
              <li>prioritization of action fields</li>
              <li>management-ready decision support</li>
            </ul>
            <h4 className="text-white font-semibold mb-2">Typical outcomes</h4>
            <ul className="text-gray-300 space-y-2 list-disc list-inside">
              <li>structured overview of relevant risks and dependencies</li>
              <li>clearer understanding of where analysis should start</li>
              <li>prioritized next steps</li>
              <li>basis for a broader assessment or implementation planning</li>
            </ul>
          </div>
        </section>

        <div className="mb-20">
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            <Image
              src="/PQC-Readiness.png"
              alt="PQC readiness and implementation planning approach"
              width={1600}
              height={900}
              className="w-full h-auto"
            />
          </div>
        </div>

        <section className="mb-16">
          <h2 className="text-3xl font-bold text-cyan-300 mb-6">
            Who this is for
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-6 max-w-4xl">
            Qubit Lab is particularly relevant for organizations that need a practical
            translation layer between business relevance and technical substance.
          </p>
          <ul className="text-gray-300 text-lg leading-relaxed space-y-2 list-disc list-inside">
            <li>banks and other financial institutions</li>
            <li>regulated organizations</li>
            <li>innovation and strategy teams</li>
            <li>risk, security, and architecture stakeholders</li>
            <li>quant and technical expert teams</li>
            <li>leadership groups seeking a realistic view of quantum impact</li>
          </ul>
        </section>

        <section className="mb-16">
          <h2 className="text-3xl font-bold text-cyan-300 mb-6">
            Where the focus is strongest
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-4 max-w-4xl">
            The strongest current focus is on financial services, quantum education
            and awareness building, practical use-case framing, and post-quantum
            cryptography readiness.
          </p>
          <p className="text-gray-300 text-lg leading-relaxed max-w-4xl">
            In addition, selected technical and educational topics beyond finance can
            also be supported where there is a good fit. This includes, for example,
            technically grounded material in areas such as Hamiltonian simulation and
            quantum computing fundamentals, especially where the need is for clear
            explanation, structured education, or applied translation rather than deep
            domain consulting.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold text-cyan-300 mb-6">
            How I work
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-4 max-w-4xl">
            The approach is pragmatic, structured, and tailored to the audience.
          </p>
          <ul className="text-gray-300 text-lg leading-relaxed space-y-2 list-disc list-inside mb-6">
            <li>starting from the actual business or technical question</li>
            <li>reducing unnecessary jargon</li>
            <li>being explicit about what quantum can and cannot do today</li>
            <li>creating outputs that are usable for real stakeholders</li>
          </ul>
          <p className="text-gray-300 text-lg leading-relaxed max-w-4xl">
            The aim is not to make quantum sound impressive. The aim is to make it
            understandable, relevant, and actionable.
          </p>
        </section>

        <div className="mb-20">
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            <Image
              src="/Org-Readiness.png"
              alt="Why start now: lead time and organizational advantage"
              width={1600}
              height={900}
              className="w-full h-auto"
            />
          </div>
        </div>

        <section className="mb-16">
          <h2 className="text-3xl font-bold text-cyan-300 mb-6">
            Typical starting points
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-2">
                Management Briefing
              </h3>
              <p className="text-gray-300 leading-relaxed">
                A focused session for leadership teams that want a realistic understanding
                of quantum relevance, timing, opportunities, and risk.
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-2">
                Expert Workshop
              </h3>
              <p className="text-gray-300 leading-relaxed">
                A deeper session for quants, technical teams, or innovation stakeholders
                who want to engage with concrete concepts, methods, and examples.
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-2">
                PQC Checkup Discussion
              </h3>
              <p className="text-gray-300 leading-relaxed">
                A first discussion around cryptographic exposure, planning questions,
                and how a structured PQC Checkup could look in practice.
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-2">
                Use-Case Scoping
              </h3>
              <p className="text-gray-300 leading-relaxed">
                A targeted conversation on where a PoC or internal evaluation may make
                sense and how to frame it credibly.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-3xl font-bold text-cyan-300 mb-6">
            Why Qubit Lab
          </h2>
          <ul className="text-gray-300 text-lg leading-relaxed space-y-2 list-disc list-inside">
            <li>a background in physics and business</li>
            <li>experience in financial services and project leadership</li>
            <li>practical quantum programming capability</li>
            <li>a strong focus on clear communication and usable outputs</li>
          </ul>
          <p className="text-gray-300 text-lg leading-relaxed mt-6 max-w-4xl">
            The emphasis is on credibility, structure, and practical value rather than broad claims.
          </p>
        </section>

        <section className="border-t border-white/10 pt-12">
          <h2 className="text-3xl font-bold text-cyan-300 mb-6">
            Start the conversation
          </h2>
          <p className="text-gray-300 text-lg leading-relaxed mb-8 max-w-4xl">
            If you are exploring quantum topics in your organization and want a practical
            discussion, feel free to get in touch. Whether the topic is executive awareness,
            expert training, use-case evaluation, or PQC readiness, the best first step is
            usually a short conversation around your specific situation.
          </p>
          <a
            href="/contact"
            className="inline-block px-6 py-3 rounded-lg bg-cyan-400 text-black font-semibold hover:bg-cyan-300 transition"
          >
            Contact Me
          </a>
        </section>
      </section>
    </AppLayout>
  );
}