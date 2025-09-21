"use client";
import { useState } from "react";
import { Resource } from "@/data/resources";
import Image from "next/image";
import Link from "next/link";

export default function ResourceList({ resources }: { resources: Resource[] }) {
  const [filter, setFilter] = useState<string | null>(null);

  const filteredResources = filter
    ? resources.filter((r) => r.tags.includes(filter))
    : resources;

  const allTags = Array.from(new Set(resources.flatMap((r) => r.tags)));

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          onClick={() => setFilter(null)}
          className={`px-3 py-1 rounded-full text-sm font-semibold ${
            filter === null
              ? "bg-cyan-600 text-white"
              : "bg-white/10 text-gray-300 hover:bg-white/20"
          }`}
        >
          All
        </button>
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => setFilter(tag)}
            className={`px-3 py-1 rounded-full text-sm font-semibold ${
              filter === tag
                ? "bg-cyan-600 text-white"
                : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Resource Items */}
      <div className="space-y-6">
        {filteredResources.map((res) => (
          <div
            key={res.id}
            className="flex flex-col md:flex-row items-start gap-4 bg-white/5 p-4 rounded-lg shadow hover:scale-[1.01] transition"
          >
  
            {/* Clickable Image */}
            <Link
              href={res.url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-40 h-30 relative flex-shrink-0"
            >
              <Image
                src={`/${res.image}`}
                alt={res.title}
                fill
                className="object-contain rounded bg-white/10 hover:scale-105 transition"
              />
            </Link>

            {/* Text Content */}
            <div className="flex-1">
              <h3 className="text-xl font-bold text-cyan-300">
                <Link
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {res.title}
                </Link>
              </h3>
              <p className="text-gray-300 text-sm mb-3">{res.description}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {res.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-cyan-800/70 text-cyan-200 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
