import React, { useState } from 'react';
import { Play } from 'lucide-react';

interface Props {
  videoId: string;
  title: string;
  className?: string;
}

/**
 * Lazy YouTube embed: shows the real thumbnail + a play button and only
 * loads the (heavy) YouTube iframe after a click, so the video never costs
 * page weight or third-party requests for visitors who don't watch it.
 */
export const YouTubeFacade: React.FC<Props> = ({ videoId, title, className = '' }) => {
  const [loaded, setLoaded] = useState(false);

  if (loaded) {
    return (
      <div className={`relative aspect-video w-full overflow-hidden rounded-2xl bg-black ${className}`}>
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setLoaded(true)}
      aria-label={`Play video: ${title}`}
      className={`group relative aspect-video w-full overflow-hidden rounded-2xl bg-black ${className}`}
    >
      <img
        src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`}
        alt={title}
        loading="lazy"
        className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
        onError={(e) => {
          e.currentTarget.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        }}
      />
      <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-[#00FF87] to-[#60EFFF] shadow-[0_10px_40px_-8px_rgba(0,255,135,0.6)] transition-transform group-hover:scale-110 sm:h-20 sm:w-20">
          <Play size={28} fill="#061116" className="ml-1 text-[#061116] sm:h-8 sm:w-8" />
        </span>
      </span>
    </button>
  );
};
