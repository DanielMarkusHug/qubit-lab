import Header from "@/components/Header";
import Feedback from "@/components/Feedback";
import AppLayout from "@/components/AppLayout";

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

        {/* Contact Buttons */}
        <div className="flex flex-wrap gap-4 mb-12">
          <a
            href="mailto:daniel.hug@qubit-lab.ch"
            className="px-5 py-2 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition"
          >
            📧 Email Me
          </a>
          <a
            href="https://www.linkedin.com/in/danielhug"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition"
          >
            🔗 LinkedIn
          </a>
          <a
            href="https://hihello.me/p/952356c5-423a-4aee-b1ae-05973a468ac6"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition"
          >
            💼 HiHello
          </a>
        </div>
      </section>

      {/* Feedback section (Giscus) */}
      <Feedback />
    </AppLayout>
  );
}
