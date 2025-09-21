function VideoItem({ video }: { video: Video }) {
  const [play, setPlay] = useState(false);

  return (
    <div className="flex flex-col md:flex-row items-start gap-6 bg-white/5 p-6 rounded-xl shadow-lg hover:scale-[1.01] transition">
      {/* Thumbnail + Badge wrapper */}
      <div className="w-full md:w-1/2 relative">
        {/* Video Number Badge (anchored to thumbnail now) */}
        <span className="absolute top-3 right-3 bg-cyan-600 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg z-10">
          #{video.number}
        </span>

        {/* Thumbnail or Video */}
        <div
          className="aspect-video rounded overflow-hidden relative cursor-pointer"
          onClick={() => setPlay(true)}
        >
          {play ? (
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${video.id}?autoplay=1`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <>
              <Image
                src={`/${video.image}`}
                alt={video.title}
                fill
                className="object-cover"
              />
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <span className="text-white text-5xl">▶</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Text Content */}
      <div className="flex-1">
        <h3 className="text-2xl font-bold text-cyan-300 mb-2">
          {video.title}
        </h3>
        <p className="text-gray-300 mb-4">{video.description}</p>

        {/* Tags */}
        {video.tags && (
          <div className="flex flex-wrap gap-2 mb-4">
            {video.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-cyan-800/70 text-cyan-200 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Multiple Link Buttons */}
        {video.links && (
          <div className="flex flex-wrap gap-3">
            {video.links.map((link, i) => (
              <Link
                key={i}
                href={link.url}
                target="_blank"
                className="inline-block px-4 py-2 bg-cyan-600 text-white rounded-lg font-semibold hover:bg-cyan-700 transition"
              >
                {link.text}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
