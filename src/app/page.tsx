'use client';

import Particles from "react-tsparticles";
import { loadSlim } from '@tsparticles/slim';
import type { Engine } from "@tsparticles/engine"; // <-- ADD THIS
import { FaYoutube, FaLinkedin, FaAddressCard, FaGithub } from "react-icons/fa";
import Image from "next/image";

export default function Home() {
  const particlesInit = async (engine: Engine) => {
    await loadSlim(engine);
  };

  return (
    <div className="relative min-h-screen font-sans overflow-hidden bg-black">

      {/* Background Video */}
      <video
        src="/background.mp4"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: -1,
        }}
        autoPlay
        muted
        loop
        playsInline
      />

      {/* Particles */}
      <Particles
        className="absolute inset-0 z-0"
        init={particlesInit}
        options={{
          background: { color: "transparent" },
          particles: {
            color: { value: "#ffffff" },
            links: { enable: true, color: "#ffffff" },
            move: { enable: true, speed: 1 },
            number: { value: 60 },
            size: { value: { min: 1, max: 3 } },
          },
        }}
      />

      {/* Logo and Title */}
      <header className="flex flex-col md:flex-row items-center md:items-start max-w-6xl mx-auto px-6 pt-32 relative z-10 gap-8 mb-24">
        <div className="flex-shrink-0">
          <Image
            src="/logo.png"
            alt="Qubit Lab Logo"
            width={200}
            height={200}
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
          <p className="text-xl text-gray-200 max-w-2xl">
            Breaking down complex ideas into clear, practical steps — making it easier to learn, experiment, and apply quantum computing.
          </p>
        </div>
      </header>

      {/* Intro Section */}
      <section className="max-w-4xl mx-auto px-6 pb-20 text-gray-200 relative z-10 text-center">
        <h2 className="text-4xl font-bold mb-4">
          A Practical Introduction for Curious Minds
        </h2>

        <div className="w-24 mx-auto border-t-2 border-cyan-400 my-6"></div>

        <div className="space-y-8 text-lg text-left">
          <div>
            <h3 className="text-2xl font-semibold mb-2 text-cyan-300">Who is this for?</h3>
            <p>
              This series is designed for anyone curious about quantum computing — no advanced math or physics background required.
              If you have basic Python skills and a healthy dose of curiosity, you&apos;re perfectly equipped to follow along.
              Whether you&apos;re a finance professional, a tech enthusiast, a student, or simply interested in the future of computing, this is for you.
            </p>
          </div>

          <div>
            <h3 className="text-2xl font-semibold mb-2 text-cyan-300">Why am I doing this?</h3>
            <p>
              Quantum computing is moving from theory to reality faster than many realize.
              Yet, most explanations either stay too high-level or become too complex too quickly.
              I want to bridge that gap — to show that the basic concepts and first steps in quantum programming are surprisingly accessible.
            </p>
          </div>

          <div>
            <h3 className="text-2xl font-semibold mb-2 text-cyan-300">What will you achieve?</h3>
            <p>
              By the end of this series, you will understand how quantum computers store and process information,
              how to program your own simple quantum circuits in Python using Qiskit,
              and how core quantum mechanics concepts like superposition and interference are used for computation.
              You&apos;ll not only understand the what — but also the how — preparing you for deeper exploration into the fascinating world of quantum technologies.
            </p>
          </div>

          <div className="text-center pt-6">
            <p className="text-xl font-bold text-cyan-400">
              Let&apos;s get started and open the door to a new way of thinking about computing!
            </p>
          </div>
        </div>
      </section>

      {/* YouTube Videos */}
      <section className="max-w-6xl mx-auto px-6 pb-20 flex flex-col gap-12 relative z-10">
      {/* Video 1 */}
      <div className="flex flex-col md:flex-row items-center gap-8">
        <div className="relative w-full md:w-1/2 group">
          <div className="overflow-hidden rounded-2xl transition-transform duration-300 group-hover:scale-105 ring-2 ring-transparent group-hover:ring-cyan-400">
            <iframe
              width="100%"
              height="315"
              src="https://www.youtube.com/embed/_88ECktcxSg"
              title="Part 1 - My First Quantum Program"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full rounded-2xl"
            ></iframe>
          </div>
        </div>
        <div className="text-gray-200 md:w-1/2">
          <h3 className="text-2xl font-bold mb-2">Video 1: Why Quantum Computing Matters</h3>
          <p className="text-lg leading-relaxed">
            🌟 Quantum computing is making headlines everywhere — but is it hype or the next big thing?
            In this video, we go beyond the buzzwords to understand how quantum computers work, how they could disrupt industries like finance, AI, and cryptography, and what programming a quantum computer really looks like. No PhD needed — just curiosity and a bit of Python. Let’s get started!
          </p>
        </div>
      </div>

      {/* Repeat for Video 2 */}
      <div className="flex flex-col md:flex-row items-center gap-8">
        <div className="relative w-full md:w-1/2 group">
          <div className="overflow-hidden rounded-2xl transition-transform duration-300 group-hover:scale-105 ring-2 ring-transparent group-hover:ring-cyan-400">
            <iframe
              width="100%"
              height="315"
              src="https://www.youtube.com/embed/8vYwq1jUYNI"
              title="Part 2 - My First Quantum Program"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full rounded-2xl"
            ></iframe>
          </div>
        </div>
        <div className="text-gray-200 md:w-1/2">
          <h3 className="text-2xl font-bold mb-2">Video 2: How Quantum Computers Think</h3>
          <p className="text-lg leading-relaxed">
            🧠 Welcome back! Before we code, we need to understand how quantum computers think.
            We dive into the four cornerstones: qubits, superposition, measurement, entanglement, and quantum gates.
            You&apos;ll see how quantum magic like interference and reversibility makes these machines so unique — and why programming them is a whole new ballgame.
          </p>
        </div>
      </div>

      {/* Repeat for Video 3 */}
      <div className="flex flex-col md:flex-row items-center gap-8">
        <div className="relative w-full md:w-1/2 group">
          <div className="overflow-hidden rounded-2xl transition-transform duration-300 group-hover:scale-105 ring-2 ring-transparent group-hover:ring-cyan-400">
            <iframe
              width="100%"
              height="315"
              src="https://www.youtube.com/embed/cCKH1soP4yI"
              title="Part 3 - My First Quantum Program"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full rounded-2xl"
            ></iframe>
          </div>
        </div>
        <div className="text-gray-200 md:w-1/2">
          <h3 className="text-2xl font-bold mb-2">Video 3: Our First Quantum Program</h3>
          <p className="text-lg leading-relaxed">
            🎲 Time to roll the dice — literally!
            We build our very first quantum circuit: a real eight-sided die powered by quantum randomness.
            Using Python and Qiskit, we’ll create and run a simple but powerful “Hello, Quantum World!” program.
            Your first step into real quantum coding starts here — and it&apos;s easier than you think.
          </p>
        </div>
      </div>

      {/* Repeat for Video 4 */}
      <div className="flex flex-col md:flex-row items-center gap-8">
        <div className="relative w-full md:w-1/2 group">
          <div className="overflow-hidden rounded-2xl transition-transform duration-300 group-hover:scale-105 ring-2 ring-transparent group-hover:ring-cyan-400">
            <iframe
              width="100%"
              height="315"
              src="https://www.youtube.com/embed/iHhmEkdoerM"
              title="Deep Dive #1 - Quantum Gates"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full rounded-2xl"
            ></iframe>
          </div>
        </div>
        <div className="text-gray-200 md:w-1/2">
          <h3 className="text-2xl font-bold mb-2">Video 4: Mastering Quantum Gates</h3>
          <p className="text-lg leading-relaxed">
            🔧 Ready to build your quantum toolbox?
            Now that you&apos;ve seen your first circuit, it&apos;s time to learn how quantum gates really work.
            We revisit vectors and matrices from high school, uncover why quantum gates must be reversible,
            and explore key players like the X gate and Hadamard gate — with real Python examples to prove it.
            Understanding these simple tools is your gateway to mastering real quantum algorithms!
          </p>
        </div>
      </div>
    </section>

      {/* Social Links Cards */}
      <main className="max-w-6xl mx-auto px-6 pb-20 grid gap-10 md:grid-cols-2 relative z-10">

      {/* YouTube Card */}
      <div className="rounded-2xl p-8 shadow-2xl bg-blue-200 flex flex-col items-center text-center hover:scale-105 hover:ring-4 hover:ring-cyan-400 transition">
        <FaYoutube className="text-5xl text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-gray-900">Qubit Lab YouTube Channel</h2>
        <p className="text-gray-900 mb-6">All the videos, explained clearly.</p>
        <a
          href="https://www.youtube.com/@qubit-lab"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition"
        >
          Watch Videos
        </a>
      </div>

      {/* LinkedIn Card */}
      <div className="rounded-2xl p-8 shadow-2xl bg-blue-200 flex flex-col items-center text-center hover:scale-105 hover:ring-4 hover:ring-cyan-400 transition">
        <FaLinkedin className="text-5xl text-blue-600 mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-gray-900">LinkedIn Profile</h2>
        <p className="text-gray-900 mb-6">Stay in touch and connect professionally.</p>
        <a
          href="https://linkedin.com/in/danielhug"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition"
        >
          Connect on LinkedIn
        </a>
      </div>

      {/* HiHello Card */}
      <div className="rounded-2xl p-8 shadow-2xl bg-blue-200 flex flex-col items-center text-center hover:scale-105 hover:ring-4 hover:ring-cyan-400 transition">
        <FaAddressCard className="text-5xl text-indigo-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-gray-900">HiHello Profile</h2>
        <p className="text-gray-900 mb-6">Find all my links and contact info at one place.</p>
        <a
          href="https://hihello.me/p/952356c5-423a-4aee-b1ae-05973a468ac6"
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-semibold hover:bg-indigo-600 transition"
        >
          Visit HiHello
        </a>
      </div>

      {/* GitHub Card */}
      <div className="rounded-2xl p-8 shadow-2xl bg-blue-200 flex flex-col items-center text-center hover:scale-105 hover:ring-4 hover:ring-cyan-400 transition">
        <FaGithub className="text-5xl text-gray-700 mb-4" />
        <h2 className="text-2xl font-bold mb-2 text-gray-900">GitHub Repository</h2>
        <p className="text-gray-900 mb-6">Soon: all Jupyter notebooks and quantum demos!</p>
        <span className="px-6 py-3 bg-gray-600 text-white rounded-xl font-semibold">
          Coming Soon
        </span>
      </div>

    </main>

      {/* Footer */}
      <footer className="text-center text-gray-400 text-sm pb-10 relative z-10">
        &copy; 2025 Qubit Lab. All rights reserved.
      </footer>

    </div>
  );
}