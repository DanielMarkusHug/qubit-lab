"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 bg-black/70 backdrop-blur-md border-b border-white/10 z-30">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Qubit-Lab Logo"
            width={40}
            height={40}
            className="rounded-full object-cover"
          />
          <span className="font-bold text-xl tracking-wide">Qubit-Lab.ch</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex gap-4 text-sm">
          <Link href="/all">All Videos</Link>
          <Link href="/strategy">Quantum Strategy</Link>
          <Link href="/finance">Quantum Finance</Link>
          <Link href="/deepdive">Tech Deep Dive</Link>
          <Link href="/intro">Intro Videos</Link>
        </nav>


        {/* Desktop Right Menu */}
        <div className="ml-auto hidden md:flex gap-4 text-sm">
          <Link href="/about">About</Link>
          <Link href="/resources">Resources</Link>
          <Link href="/contact">Contact</Link>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="ml-auto md:hidden">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 rounded bg-cyan-600 text-white focus:outline-none"
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile Menu (Slide Down) */}
      {menuOpen && (
        <div className="md:hidden bg-black/90 border-t border-white/10 px-4 py-4 space-y-3">
          <Link href="/all" className="block text-white hover:text-cyan-400" onClick={() => setMenuOpen(false)}>All Videos</Link>
          <Link href="/strategy" className="block text-white hover:text-cyan-400" onClick={() => setMenuOpen(false)}>Quantum Strategy</Link>
          <Link href="/finance" className="block text-white hover:text-cyan-400" onClick={() => setMenuOpen(false)}>Quantum Finance</Link>
          <Link href="/deepdive" className="block text-white hover:text-cyan-400" onClick={() => setMenuOpen(false)}>Tech Deep Dive</Link>
          <Link href="/intro" className="block text-white hover:text-cyan-400" onClick={() => setMenuOpen(false)}>Intro Videos</Link>
          <hr className="border-white/20" />
          <Link href="/about" className="block text-white hover:text-cyan-400" onClick={() => setMenuOpen(false)}>About</Link>
          <Link href="/resources" className="block text-white hover:text-cyan-400" onClick={() => setMenuOpen(false)}>Resources</Link>
          <Link href="/contact" className="block text-white hover:text-cyan-400" onClick={() => setMenuOpen(false)}>Contact</Link>
        </div>
      )}
    </header>
  );
}
