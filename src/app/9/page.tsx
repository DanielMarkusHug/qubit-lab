"use client";

import { Suspense } from "react";
import FeaturedVideoContent from "./video-content";

export default function FeaturedVideoPage() {
  return (
    <Suspense fallback={<div className="text-white p-8">Loading featured video…</div>}>
      <FeaturedVideoContent />
    </Suspense>
  );
}