'use client';

import Particles from "react-tsparticles";
import { loadSlim } from '@tsparticles/slim';
import { FaYoutube, FaLinkedin, FaAddressCard, FaGithub } from "react-icons/fa";
import Image from "next/image";
import Link from "next/link";
import Giscus from '@giscus/react';
import React from "react";

const quantumResources = [
  {
    category: "Educational Resources",
    resources: [
      {
        name: "Quantum Country",
        url: "https://quantum.country/qcvc",
        description: "Memory-aid for learning quantum computing concepts.",
      },
      {
        name: "Qiskit Textbook",
        url: "https://qiskit.org/textbook/preface.html",
        description: "IBM’s interactive textbook for learning Qiskit.",
      },
      {
        name: "Microsoft Quantum Learn",
        url: "https://learn.microsoft.com/en-us/training/paths/quantum-computing-fundamentals/",
        description: "Modular course on quantum computing fundamentals.",
      },
    ],
  },
  {
    category: "Hands-on Programming",
    resources: [
      {
        name: "IBM Quantum Lab",
        url: "https://quantum-computing.ibm.com/",
        description: "Run real quantum circuits using Qiskit online.",
      },
      {
        name: "QuTiP",
        url: "https://qutip.org/",
        description: "Simulating quantum systems in Python.",
      },
      {
        name: "Quantum Composer (IBM)",
        url: "https://quantum-computing.ibm.com/composer",
        description: "Visual circuit builder and simulator.",
      },
      {
        name: "Quirk",
        url: "https://algassert.com/quirk",
        description: "Interactive drag-and-drop quantum circuit simulator in the browser.",
      },
      {
        name: "Quirk Documentation",
        url: "https://algassert.com/quirk-doc/",
        description: "Reference documentation for the Quirk simulator.",
      },
    ],
  },
  {
    category: "Research and News",
    resources: [
      {
        name: "Quantum Computing Report",
        url: "https://quantumcomputingreport.com/",
        description: "Industry news and analysis.",
      },
      {
        name: "arXiv Quantum Physics",
        url: "https://arxiv.org/archive/quant-ph",
        description: "Preprints in quantum computing and physics.",
      },
      {
        name: "Nature Quantum Information",
        url: "https://www.nature.com/natquantuminf/",
        description: "Peer-reviewed quantum research journal.",
      },
    ],
  },
  {
    category: "Community and Collaboration",
    resources: [
      {
        name: "StackExchange – Quantum",
        url: "https://quantumcomputing.stackexchange.com/",
        description: "Q&A platform for all quantum topics.",
      },
      {
        name: "Qiskit Community",
        url: "https://qiskit.org/events/",
        description: "Events, Slack, and contributions to Qiskit.",
      },
      {
        name: "Quantum Open Source Foundation (QOSF)",
        url: "https://qosf.org/",
        description: "Supports open quantum projects and mentorship.",
      },
    ],
  },
];



export default function Home() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const particlesInit = async (engine: any) => {
    await loadSlim(engine);
  };

  const videos_intro = [
    {
      id: "_88ECktcxSg",
      title: "Video 1: Why Quantum Computing Matters",
      description:
        "🌟 Quantum computing is making headlines everywhere — but is it hype or the next big thing? In this video, we go beyond the buzzwords to understand how quantum computers work, how they could disrupt industries like finance, AI, and cryptography, and what programming a quantum computer really looks like. No PhD needed — just curiosity and a bit of Python. Let's get started!"
    },
    {
      id: "8vYwq1jUYNI",
      title: "Video 2: How Quantum Computers Think",
      description:
        "🧠 Before we code, we need to understand how quantum computers think. We dive into the four cornerstones: qubits, superposition, measurement, entanglement, and quantum gates. You'll see how quantum magic like interference and reversibility makes these machines so unique — and why programming them is a whole new ballgame."
    },
    {
      id: "cCKH1soP4yI",
      title: "Video 3: Our First Quantum Program",
      description:
        "🎲 Time to roll the dice — literally! We build our very first quantum circuit: a real eight-sided die powered by quantum randomness. Using Python and Qiskit, we'll create and run a simple but powerful “Hello, Quantum World!” program. Your first step into real quantum coding starts here — and it's easier than you think."
    }
  ];

  const videos_deepdive = [

    {
      id: "iHhmEkdoerM",
      title: "Video 4: Mastering Quantum Gates",
      description:
        "🔧 Ready to build your quantum toolbox? Now that you've seen your first circuit, it's time to learn how quantum gates really work. We revisit vectors and matrices from high school, uncover why quantum gates must be reversible, and explore key players like the X gate and Hadamard gate — with real Python examples to prove it. Understanding these simple tools is your gateway to mastering real quantum algorithms!"
    }
  ];

  


  return (
    <div className="relative min-h-screen font-sans overflow-hidden bg-black">
      {/* Background Video */}
      <video
        src="/background.mp4"
        className="absolute top-0 left-0 w-full h-full object-cover z-[-1]"
        autoPlay
        muted
        loop
        playsInline
      />

      <Particles
        className="absolute inset-0 z-0"
        init={particlesInit}
        options={{
          background: { color: "transparent" },
          particles: {
            color: { value: "#ffffff" },
            links: { enable: true, color: "#ffffff" },
            move: { enable: true, speed: 1 },
            number: { value: 50 },
            opacity: { value: 0.5 },
            shape: { type: "circle" },
            size: { value: { min: 1, max: 3 } },
          },
        }}
      />

<header className="flex flex-col md:flex-row items-center md:items-start max-w-6xl mx-auto px-6 pt-32 relative z-10 gap-8 mb-24">
        <div className="flex-shrink-0">
          <Image
            src="/logo.png"
            alt="Qubit Lab Logo"
            width={280}
            height={280}
            className="rounded-full"
          />
        </div>

        <div className="flex flex-col text-left">
          <h1 className="text-5xl md:text-6xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
            Qubit Lab
          </h1>
          <h2 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-10">
            Quantum Computing. Demystified.
          </h2>
          <h2 className="text-2xl text-gray-200">
            Unlock the secrets of quantum computing step by step.
          </h2>
          <div className="flex gap-4 mt-10">
            <Link href="#videos" className="px-6 py-3 bg-cyan-500 text-white rounded-full font-semibold hover:bg-cyan-600 transition">Introductory Videos</Link>
            <Link href="#videos_deepdive" className="px-6 py-3 bg-cyan-600 text-white rounded-full font-semibold hover:bg-cyan-700 transition">Next Step Videos</Link>
            <Link href="#quirk" className="px-6 py-3 bg-cyan-700 text-white rounded-full font-semibold hover:bg-cyan-800 transition">Quirk</Link>
            <Link href="#comments" className="px-6 py-3 bg-cyan-800 text-white rounded-full font-semibold hover:bg-cyan-900 transition">Feedback</Link>
            <Link href="https://linkedin.com/in/danielhug" target="_blank" className="px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition">Connect on LinkedIn</Link>
          </div>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-20 space-y-12 text-gray-200 relative z-10">
        <h2 className="text-4xl font-bold mb-6">
          Quantum Computing. Straight Talk.
        </h2>
        <Section title="Who is this for?">
          No advanced math or physics background is required. With basic Python skills and a healthy dose of curiosity, anyone can start learning quantum computing. This series is ideal for finance professionals, tech enthusiasts, students, and anyone interested in the future of computing.
        </Section>

        <Section title="Why explore quantum computing?">
          Quantum computing is advancing from theory to reality faster than many realize. However, learning resources often remain either too abstract or too complex. This project aims to bridge the gap — providing an accessible, practical introduction to core quantum concepts and hands-on programming.
        </Section>

        <Section title="What will you achieve?">
          You will learn how quantum computers store and process information, how to design simple quantum circuits in Python using Qiskit, and how fundamental phenomena like superposition and interference are applied to computation. The goal is to build not only an understanding of what quantum computing is, but also how it works — preparing for deeper exploration into the field.
        </Section>

        <Section title="Begin the journey toward a new way of thinking about computing...">
        ...it is not trivial, but you can do it!
        </Section>

<div className="pt-6">
          <p className="text-xl font-bold text-cyan-400"></p>
        </div>
      </section>

      <section id="videos" className="max-w-6xl mx-auto px-6 pb-20 space-y-14 relative z-10">
        <h2 className="text-4xl font-bold text-center text-cyan-300 mb-10">Introduction - My First Quantum Circuit</h2>
        <div className="grid gap-12 md:grid-cols-2">
          {videos_intro.map(video => (
            <div key={video.id} className="bg-gradient-to-br from-slate-100 to-blue-200 rounded-2xl p-6 shadow-2xl hover:scale-105 hover:ring-4 hover:ring-cyan-400 transition">
              <div className="relative pb-[56.25%] mb-4 rounded-xl overflow-hidden">
                <iframe
                  src={`https://www.youtube.com/embed/${video.id}`}
                  title={video.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute top-0 left-0 w-full h-full"
                ></iframe>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{video.title}</h3>
              <p className="text-gray-700">{video.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="quirk" className="px-4 py-12 max-w-5xl mx-auto">
        <div className="rounded-2xl border border-gray-200 shadow hover:shadow-md transition-shadow p-4 bg-white">
          <a
            href="https://algassert.com/quirk"
            target="_blank"
            rel="noopener noreferrer"
          >
            <h2 className="text-xl font-semibold text-blue-600 hover:underline">
              Quirk – Interactive Quantum Circuit Simulator
            </h2>
          </a>
          <p className="text-gray-700 mt-2 text-sm">
            Drag-and-drop quantum gates to simulate quantum circuits in real time. Built for learning and experimentation, right in your browser.
          </p>

          <div className="mt-4 aspect-video w-full border rounded overflow-hidden">
            <iframe
              src="https://algassert.com/quirk"
              title="Quirk Quantum Simulator"
              loading="lazy"
              className="w-full h-full border-0"
              allowFullScreen
            />
          </div>
        </div>
      </section>

      <section id="videos_deepdive" className="max-w-6xl mx-auto px-6 pb-20 space-y-14 relative z-10">
        <h2 className="text-4xl font-bold text-center text-cyan-300 mb-10">Deep Dives - The Next Step</h2>
        <div className="grid gap-12 md:grid-cols-2">
          {videos_deepdive.map(video => (
            <div key={video.id} className="bg-gradient-to-br from-slate-100 to-blue-200 rounded-2xl p-6 shadow-2xl hover:scale-105 hover:ring-4 hover:ring-cyan-400 transition">
              <div className="relative pb-[56.25%] mb-4 rounded-xl overflow-hidden">
                <iframe
                  src={`https://www.youtube.com/embed/${video.id}`}
                  title={video.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute top-0 left-0 w-full h-full"
                ></iframe>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{video.title}</h3>
              <p className="text-gray-700">{video.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="comments" className="max-w-6xl mx-auto px-6 pb-20 space-y-14 relative z-10">
        <div className="max-w-6xl mx-auto px-6 pb-20 relative z-10">
          <div className="bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl p-6 shadow-2xl hover:scale-[1.01] transition">
            <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">What’s On Your Mind?</h2>
            <Giscus
              id="comments"
              repo="DanielMarkusHug/qubit-lab-comments"
              repoId="R_kgDOOh8qEA"
              category="General"
              categoryId="DIC_kwDOOh8qEM4Cpmp3"
              mapping="pathname"
              reactionsEnabled="1"
              emitMetadata="0"
              inputPosition="bottom"
              theme="light"  // light = matches video tile background
              lang="en"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      <section id="resources" className="max-w-6xl mx-auto px-6 pb-20 space-y-14 relative z-10">
        <QuantumResourcesSection />
      </section>

<main className="max-w-6xl mx-auto px-6 pb-20 grid gap-10 md:grid-cols-2 relative z-10">
        <SocialCard icon={<FaYoutube className="text-5xl text-red-500 mb-4" />} title="Qubit Lab on YouTube" link="https://www.youtube.com/@qubit-lab" buttonText="Watch Videos" />
        <SocialCard icon={<FaLinkedin className="text-5xl text-blue-600 mb-4" />} title="LinkedIn Profile" link="https://linkedin.com/in/danielhug" buttonText="Connect on LinkedIn" />
        <SocialCard icon={<FaAddressCard className="text-5xl text-indigo-500 mb-4" />} title="HiHello Profile" link="https://hihello.me/p/952356c5-423a-4aee-b1ae-05973a468ac6" buttonText="Visit HiHello" />
        <SocialCard icon={<FaGithub className="text-5xl text-gray-700 mb-4" />} title="GitHub Repository" comingSoon />
      </main>

      <footer className="text-center text-gray-400 text-sm pb-10 relative z-10">
        &copy; 2025 Qubit Lab. Demystifying Quantum Computing.
      </footer>
    </div>
  );
}


function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-2xl font-semibold mb-2 text-cyan-300">{title}</h3>
      <p className="text-lg text-gray-300 leading-relaxed">{children}</p>
    </div>
  );
}

function SocialCard({
  icon,
  title,
  link,
  buttonText,
  comingSoon,
}: {
  icon: React.ReactNode;
  title: string;
  link?: string;
  buttonText?: string;
  comingSoon?: boolean;
}) {
  return (
    <div className="rounded-2xl p-8 shadow-2xl bg-gradient-to-br from-orange-400 to-brown-600 flex flex-col items-center text-center hover:scale-105 hover:ring-4 hover:ring-cyan-400 transition">
      {icon}
      <h2 className="text-2xl font-bold mb-2 text-gray-900">{title}</h2>
      {!comingSoon ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 mt-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition"
        >
          {buttonText}
        </a>
      ) : (
        <span className="px-6 py-3 mt-4 bg-gray-600 text-white rounded-xl font-semibold">
          Coming Soon
        </span>
      )}
    </div>
  );
}


function QuantumResourcesSection() {
  return (
    <section className="px-4 py-12 max-w-5xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">Quantum Computing Resources</h2>
      {quantumResources.map((group) => (
        <div key={group.category} className="mb-10">
          <h3 className="text-xl font-semibold mb-4">{group.category}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.resources.map((resource) => (
              <a
                key={resource.url}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-gray-200 shadow hover:shadow-md transition-shadow p-4 bg-white"
              >
                <h4 className="text-lg font-semibold text-blue-600 hover:underline">
                  {resource.name}
                </h4>
                <p className="text-gray-700 mt-1 text-sm">{resource.description}</p>
              </a>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}