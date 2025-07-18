'use client';

import Particles from "react-tsparticles";
import { loadSlim } from '@tsparticles/slim';
import { FaYoutube, FaLinkedin, FaAddressCard } from "react-icons/fa";
import Image from "next/image";
import Link from "next/link";
import Giscus from '@giscus/react';
import React from "react";
import { useEffect, useRef } from "react";

const quantumResources = [
  {
    category: "Math Basics and General Quantum Computing",
    resources: [
      {
        name: "Matrix Multiplication for Beginners (Video)",
        url: "https://www.youtube.com/watch?v=XkY2DOUCWMU",
        description: "Step-by-step video explanation of how to multiply matrices — essential for understanding quantum gates.",
      },
      {
        name: "Complex Numbers for Beginners (Video)",
        url: "https://www.youtube.com/watch?v=T647CGsuOVU",
        description: "Friendly visual introduction to imaginary numbers and why the square root of −1 is useful in quantum mechanics.",
      },
      {
        name: "Quantum Country",
        url: "https://quantum.country/qcvc",
        description: "A memory aid for learning quantum computing concepts through spaced repetition.",
      },
    ],
  },
  {
    category: "Qiskit Resources (IBM)",
    resources: [
      {
        name: "Qiskit",
        url: "https://www.ibm.com/quantum/qiskit",
        description: "The Homepage of IBM’s Qiskit.",
      },
      {
        name: "Qiskit Reference",
        url: "https://docs.quantum.ibm.com/api/qiskit",
        description: "Qiskit documentation (latest version)",
      },
      {
        name: "Python Basics for Qiskit Users",
        url: "https://qiskit.org/learn/course/basics-of-python/",
        description: "Qiskit's official Python refresher covering the essentials for quantum programming.",
      },
    ],
  },
  {
    category: "Cirq Programming Resources (Google)",
    resources: [
      {
        name: "Cirq",
        url: "https://quantumai.google/cirq",
        description: "Google's Python framework for creating, editing, and invoking Noisy Intermediate Scale Quantum (NISQ) circuits.",
      },
      {
        name: "Cirq Tutorials",
        url: "https://quantumai.google/cirq/tutorials",
        description: "A collection of tutorials to help you get started with Cirq.",
      },
    ],
  },
  {
    category: "Interactive Quantum Circuit Simulators",
    resources: [
      {
        name: "Quirk",
        url: "https://algassert.com/quirk",
        description: "Interactive drag-and-drop quantum circuit simulator in the browser.",
      },
      {
        name: "Quantum Composer (IBM)",
        url: "https://quantum-computing.ibm.com/composer",
        description: "Visual circuit builder and simulator for designing quantum algorithms.",
      },
    ],
  },
  {
    category: "Python Programming for Quantum Computing",
    resources: [
      {
        name: "Real Python",
        url: "https://realpython.com/",
        description: "High-quality tutorials to build strong Python foundations for quantum circuit coding.",
      }
    ],
  },
  {
    category: "Education, Community & Collaboration",
    resources: [
      {
        name: "Quantum Computing Report - Eduction section",
        url: "https://quantumcomputingreport.com/education/",
        description: "More resources to learn about quantum computing.",
      },
      {
        name: "Quantum Computing Stack Exchange",
        url: "https://quantumcomputing.stackexchange.com/",
        description: "Q&A platform for engineers, scientists, and programmers interested in quantum computing.",
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
  
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 0.25;
    }
  }, []);  
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const particlesInit = async (engine: any) => {
    await loadSlim(engine);
  };

  const videos_intro = [
    {
      id: "Ht8jRtI2k5Q",
      title: "Video 1: Why Quantum Computing Matters",
      description:
        "🌟 Quantum computing is making headlines everywhere — but is it hype or the next big thing? In this video, we go beyond the buzzwords to understand how quantum computers work, how they could disrupt industries like finance, AI, and cryptography, and what programming a quantum computer really looks like. No PhD needed — just curiosity and a bit of Python. Let's get started!"
    },
    {
      id: "kCDn9aTnGB0",
      title: "Video 2: How Quantum Computers Think",
      description:
        "🧠 Before we code, we need to understand how quantum computers think. We dive into the four cornerstones: qubits, superposition, measurement, entanglement, and quantum gates. You'll see how quantum magic like interference and reversibility makes these machines so unique — and why programming them is a whole new ballgame."
    },
    {
      id: "HUZ7C7aAp9w",
      title: "Video 3: Our First Quantum Program",
      description:
        "🎲 Time to roll the dice — literally! We build our very first quantum circuit: a real eight-sided die powered by quantum randomness. Using Python and Qiskit, we'll create and run a simple but powerful “Hello, Quantum World!” program. Your first step into real quantum coding starts here — and it's easier than you think.",
      colabUrl: "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%203%20The-Eight-Sided-Die%20(Qiskit-1-version).ipynb"
      }
  ];

  const videos_deepdive = [


    {
      id: "Y5dwYVTI97o",
      title: "Video 4: Mastering Quantum Gates",
      description: "🔧 Ready to build your quantum toolbox? Now that you've seen your first circuit, it's time to learn how quantum gates really work. We revisit vectors and matrices from high school, uncover why quantum gates must be reversible, and explore key players like the X gate and Hadamard gate — with real Python examples to prove it. Understanding these simple tools is your gateway to mastering real quantum algorithms!",
      colabUrl: "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%204%20Deep%20Dive%201%20Quantum%20Gates.ipynb"
    },
    {
      id: "FDWJ5KgN6Xo",
      title: "Video 5: Quantum Interference",
      description: "🌀 In this video, we explore complex numbers and their phases — the hidden dimension powering quantum computing. You’ll learn how phase shifts enable ✨ quantum interference, constructive and destructive. Discover how gates like Hadamard and Z work together to manipulate probability flows in ways classical computers can’t."
    },
    {
      id: "LrujTEpfmSk",
      title: "Video 6: Multi Qubit Systems",
      description: "🧠 In this Deep Dive, we scale up to multi-qubit systems and explore entanglement — the third quantum superpower. You’ll see how the tensor product builds 4-state vectors, how CNOT creates Bell states, and why this quickly gets too big for classical computers. Try it all out in the Colab notebook—just click and run.",
      colabUrl: "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%206%20Deep%20Dive%203%20Multi%20Qubit%20Systems.ipynb"
 
    }
  ];

  const videos_quantum_finance = [
    {
      id: "WSXt4ODJBkA",
      title: "Quantum Finance: QAOA Portfolio Optimization",
      description: "Explore quantum portfolio optimization: QAOA, real-world finance, and the future beyond classical methods — all explained step by step.",
      colabUrl: "https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%207%20Quantum%20Finance%20QAOA%20Portfolio%20Optimization.ipynb"
    }
  ];

  return (
    <div className="relative min-h-screen font-sans overflow-hidden bg-black">
      {/* Background Video */}
      <video
        ref={videoRef}
        src="/background.mp4"
        className="absolute top-0 left-0 w-full h-full object-cover z-0"
        autoPlay
        muted
        loop
        playsInline
      />
      {/* Background Overlay */}
      <div className="absolute top-0 left-0 w-full h-full bg-black opacity-80 z-0" />

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
            Unlock the secrets of quantum computing - step by step.
          </h2>
          <div className="flex gap-4 mt-10">
            <Link href="#videos" className="px-6 py-3 bg-cyan-500 text-white rounded-full font-semibold hover:bg-cyan-600 transition">Introductory Videos</Link>
            <Link href="#videos_deepdive" className="px-6 py-3 bg-cyan-600 text-white rounded-full font-semibold hover:bg-cyan-700 transition">Deep Dive Videos</Link>
          </div>
          <div className="flex gap-4 mt-4">
            <Link href="#videos_quantum_finance" className="px-6 py-3 bg-cyan-700 text-white rounded-full font-semibold hover:bg-cyan-800 transition">Quantum Finance Videos</Link>
          </div>
          <div className="flex gap-4 mt-4">
            <Link href="#resources" className="px-6 py-3 bg-blue-400 text-white rounded-full font-semibold hover:bg-blue-500 transition">Resources</Link>
            <Link href="#comments" className="px-6 py-3 bg-blue-500 text-white rounded-full font-semibold hover:bg-blue-600 transition">Feedback</Link>
          </div>       
          <div className="flex gap-4 mt-4">
            <Link href="https://linkedin.com/in/danielhug" target="_blank" className="px-6 py-3 bg-blue-600 text-white rounded-full font-semibold hover:bg-blue-700 transition">Connect on LinkedIn</Link>
          </div>          </div>
      </header>


      <section className="max-w-3xl mx-auto px-6 py-10 relative z-10">
        <div className="rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 p-1 shadow-xl hover:scale-[1.01] transition">
          <div className="bg-black rounded-2xl p-6">
            {/*<h2 className="text-3xl font-bold text-center text-white mb-4">🎬 Let Us Explain...</h2>*/}
            <div className="relative w-full mb-4 overflow-hidden rounded-xl" style={{ paddingBottom: '56.25%' }}>
              <iframe
                src="https://www.youtube.com/embed/xeOuL77sb3A?rel=0"
                title="Teaser"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute top-0 left-0 w-full h-full"
              />
            </div>
            <p className="text-center text-gray-300 text-l">A quick overview of what Qubit Lab is all about.</p>
          </div>
        </div>
      </section>



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




      <section
        id="videos"
        className="max-w-7xl mx-auto px-6 pb-20 space-y-14 relative z-10"
      > 
        <h2 className="text-4xl font-bold text-center text-cyan-300 mb-10">
          Introduction - My First Quantum Circuit
        </h2>
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          {videos_intro.map((video) => (
            <div
              key={video.title}
              className="bg-gradient-to-br from-slate-100 to-blue-200 rounded-2xl p-6 shadow-2xl flex flex-col justify-center items-center text-center hover:scale-105 hover:ring-4 hover:ring-cyan-400 transition"
            >
              {video.id === "xxxxx" ? (
                <>
                  <div className="relative w-full mb-4 overflow-hidden rounded-xl bg-white" style={{ paddingBottom: '56.25%' }}>
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                      <Image
                        src="/logo.png"
                        alt="Qubit Lab Logo"
                        width={150}
                        height={150}
                        className="rounded-full"
                      />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{video.title}</h3>
                  <p className="text-gray-700">{video.description}</p>
                </>
              ) : (
                <>
                  <div className="relative w-full mb-4 overflow-hidden rounded-xl" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${video.id}`}
                      title={video.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute top-0 left-0 w-full h-full"
                    />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{video.title}</h3>
                  <p className="text-gray-700 mb-4">{video.description}</p>

                  {video.colabUrl && (
                    <a
                      href={video.colabUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-6 py-2 mt-2 bg-cyan-600 text-white font-semibold rounded-xl hover:bg-cyan-700 transition"
                    >
                      Try the Jupyter Notebook
                    </a>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>



      <section className="max-w-6xl mx-auto px-6 pb-20 relative z-10">
        <h2 className="text-xl font-bold text-center text-white mb-6">
          Compare 3 Implementations of the Eight-Sided-Die Quantum Circuit as used in Video 3:
        </h2>
        <p className="text-center text-gray-300 mb-8">
          Explore the same circuit in different quantum SDKs. Run each version directly in Google Colab.
        </p>

        <div className="bg-gradient-to-br from-slate-100 to-blue-300 rounded-2xl border shadow-lg overflow-hidden max-w-2xl mx-auto p-6 text-center">

          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Choose an implementation:
          </h3>
          <div className="flex flex-col gap-4">
            <a
              href="https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%203%20The-Eight-Sided-Die%20(Qiskit-1-version).ipynb"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition"
            >
              Qiskit 1 Implementation (as shown in the video)
            </a>
            <a
              href="https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%203%20The-Eight-Sided-Die%20(Qiskit-2-version).ipynb"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition"
            >
              Qiskit 2 Implementation
            </a>
            <a
              href="https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%203%20The-Eight-Sided-Die%20(cirq-version)%202.ipynb"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-6 py-3 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition"
            >
              Google cirq Implementation
            </a>
          </div>
        </div>
      </section>


      <section
        id="videos_deepdive"
        className="max-w-7xl mx-auto px-6 pb-20 space-y-14 relative z-10"
      > 
        <h2 className="text-4xl font-bold text-center text-cyan-300 mb-10">
          Deep Dives - The Next Step
        </h2>
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          {videos_deepdive.map((video) => (
            <div
              key={video.title}
              className="bg-gradient-to-br from-slate-100 to-blue-200 rounded-2xl p-6 shadow-2xl flex flex-col justify-center items-center text-center hover:scale-105 hover:ring-4 hover:ring-cyan-400 transition"
            >
              {video.id === "xxxxx" ? (
                <>
                  <div className="relative w-full mb-4 overflow-hidden rounded-xl bg-white" style={{ paddingBottom: '56.25%' }}>
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                      <Image
                        src="/logo.png"
                        alt="Qubit Lab Logo"
                        width={150}
                        height={150}
                        className="rounded-full"
                      />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{video.title}</h3>
                  <p className="text-gray-700">{video.description}</p>
                </>
              ) : (
                <>
                  <div className="relative w-full mb-4 overflow-hidden rounded-xl" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${video.id}`}
                      title={video.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute top-0 left-0 w-full h-full"
                    />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{video.title}</h3>
                  <p className="text-gray-700 mb-4">{video.description}</p>

                  {video.colabUrl && (
                    <a
                      href={video.colabUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-6 py-2 mt-2 bg-cyan-600 text-white font-semibold rounded-xl hover:bg-cyan-700 transition"
                    >
                      Try the Jupyter Notebook
                    </a>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <section
        id="videos_quantum_finance"
        className="max-w-7xl mx-auto px-6 pb-20 space-y-14 relative z-10"
      > 
        <h2 className="text-4xl font-bold text-center text-cyan-300 mb-10">
          Quantum Finance - Real Life Use Cases
        </h2>
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          {videos_quantum_finance.map((video) => (   // <<< FIX HERE!
            <div
              key={video.title}
              className="bg-gradient-to-br from-slate-100 to-blue-200 rounded-2xl p-6 shadow-2xl flex flex-col justify-center items-center text-center hover:scale-105 hover:ring-4 hover:ring-cyan-400 transition"
            >
              {video.id === "xxxxx" ? (
                <>
                  <div className="relative w-full mb-4 overflow-hidden rounded-xl bg-white" style={{ paddingBottom: '56.25%' }}>
                    <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                      <Image
                        src="/logo.png"
                        alt="Qubit Lab Logo"
                        width={150}
                        height={150}
                        className="rounded-full"
                      />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{video.title}</h3>
                  <p className="text-gray-700">{video.description}</p>
                </>
              ) : (
                <>
                  <div className="relative w-full mb-4 overflow-hidden rounded-xl" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${video.id}`}
                      title={video.title}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="absolute top-0 left-0 w-full h-full"
                    />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{video.title}</h3>
                  <p className="text-gray-700 mb-4">{video.description}</p>

                  {video.colabUrl && (
                    <a
                      href={video.colabUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-6 py-2 mt-2 bg-cyan-600 text-white font-semibold rounded-xl hover:bg-cyan-700 transition"
                    >
                      Try the Jupyter Notebook
                    </a>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>


      <section id="resources" className="max-w-6xl mx-auto px-6 pb-20 space-y-14 relative z-10">
        <QuantumResourcesSection />
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


<main className="max-w-6xl mx-auto px-6 pb-20 grid gap-10 md:grid-cols-3 relative z-10">
        <SocialCard icon={<FaYoutube className="text-5xl text-red-500 mb-4" />} title="Qubit Lab on YouTube" link="https://www.youtube.com/@qubit-lab" buttonText="Watch Videos" />
        <SocialCard icon={<FaLinkedin className="text-5xl text-blue-600 mb-4" />} title="LinkedIn Profile" link="https://linkedin.com/in/danielhug" buttonText="Connect on LinkedIn" />
        <SocialCard icon={<FaAddressCard className="text-5xl text-indigo-500 mb-4" />} title="HiHello Profile" link="https://hihello.me/p/952356c5-423a-4aee-b1ae-05973a468ac6" buttonText="Visit HiHello" />
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
    <div className="rounded-2xl p-4 shadow-2xl bg-gradient-to-br from-blue-200 to-blue-400 flex flex-col items-center text-center hover:scale-105 hover:ring-4 hover:ring-cyan-400 transition">
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
        <h2 className="text-4xl font-bold text-center text-cyan-300 mb-10">Quantum Computing Resources</h2>
      {quantumResources.map((group) => (
        <div key={group.category} className="mb-10">
          <h3 className="text-xl text-gray-200 font-semibold mb-4">{group.category}</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.resources.map((resource) => (
              <a
                key={resource.url}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl border border-gray-200 bg-gradient-to-br from-orange-100 to-orange-300 shadow hover:shadow-md transition-shadow p-4"
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

/*function LatestQuantumVideos() {
  const [videos, setVideos] = useState([]);

  interface YouTubeVideo {
    id: { videoId: string };
    snippet: { title: string };
  }
  
  useEffect(() => {
    async function fetchVideos() {
      const res = await fetch('/api/youtube');
      const data = await res.json();
      setVideos(data.items || []);
    }
    fetchVideos();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
      {videos.map((video: YouTubeVideo) => (
        <div key={video.id.videoId} className="flex flex-col items-center bg-blue-100 p-4 rounded-xl shadow-lg">
          <iframe
            width="100%"
            height="215"
            src={`https://www.youtube.com/embed/${video.id.videoId}`}
            title={video.snippet.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
          <h3 className="text-center text-gray-900 mt-2 font-semibold">{video.snippet.title}</h3>
        </div>
      ))}
    </div>
  );
}*/


/*    <section className="max-w-6xl mx-auto px-6 pb-20 relative z-10">
        <h2 className="text-4xl font-bold text-center text-cyan-300 mb-6">
          Try the Quantum Notebook from Video 4
        </h2>
        <p className="text-center text-gray-300 mb-6">
          Run the code for “Mastering Quantum Gates” directly in Google Colab.
        </p>
        <div className="bg-white rounded-2xl border shadow-lg overflow-hidden max-w-3xl mx-auto p-6 text-center">
          <Image
            src="/logo.png"
            alt="Notebook Preview"
            width={120}
            height={120}
            className="mx-auto mb-4 rounded-full"
          />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Video 4: Quantum Gates Notebook
          </h3>
          <a
            href="https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%204%20Deep%20Dive%201%20Quantum%20Gates.ipynb"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition"
          >
            Open in Google Colab
          </a>
        </div>
      </section>
*/


/*      <section id="videos" className="max-w-6xl mx-auto px-6 pb-20 space-y-14 relative z-10">
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
*/

/*
      <section className="max-w-6xl mx-auto px-6 pb-20 relative z-10">
        <h2 className="text-4xl font-bold text-center text-cyan-300 mb-6">
          Try the Google cirq version of the notebook from Video 3
        </h2>
        <p className="text-center text-gray-300 mb-6">
          Run the code directly in Google Colab.
        </p>
        <div className="bg-gradient-to-br from-slate-100 to-blue-200 rounded-2xl border shadow-lg overflow-hidden max-w-3xl mx-auto p-6 text-center">
          <Image
            src="/logo.png"
            alt="Notebook Preview"
            width={120}
            height={120}
            className="mx-auto mb-4 rounded-full"
          />
          <h3 className="text-l font-semibold text-gray-900 mb-2">
            Video 3: Google cirq version of the Eight-Sided-Die Jupyter Notebook
          </h3>
          <a
            href="https://colab.research.google.com/github/DanielMarkusHug/qubit-lab-notebooks/blob/main/notebooks/Video%203%20The-Eight-Sided-Die%20(cirq-version)%202.ipynb"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-cyan-600 text-white font-semibold rounded-lg hover:bg-cyan-700 transition"
          >
            Open in Google Colab
          </a>
        </div>
      </section>
*/