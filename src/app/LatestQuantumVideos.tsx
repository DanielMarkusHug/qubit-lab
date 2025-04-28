'use client';

import { useEffect, useState } from 'react';

export default function LatestQuantumVideos() {
  const [videos, setVideos] = useState([]);

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
      {videos.map((video: any) => (
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
}