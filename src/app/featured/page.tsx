// app/featured/page.tsx
"use client";

import { Suspense } from "react";
import FeaturedVideoContent from "./video-content";

export default function FeaturedVideoPage() {
  return (
    <Suspense fallback={<div>Loading featured video…</div>}>
      <FeaturedVideoContent />
    </Suspense>
  );
}