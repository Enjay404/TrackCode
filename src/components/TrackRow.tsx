import { motion } from 'motion/react';
import { ChevronRight, Disc3 } from 'lucide-react';
import { useState } from 'react';
import type { TrackItem } from '../types/track';
import { formatIsrcCode, syncCopyIsrc } from '../utils/spotifyInput';

interface TrackRowProps {
  track: TrackItem;
  index: number;
  onSelect: (track: TrackItem, copiedSync: boolean) => void;
}

const ALBUM_TYPE_LABEL: Record<TrackItem['albumType'], string> = {
  album: 'ALBUM',
  single: 'SINGLE',
  compilation: 'COMP',
};

export function TrackRow({ track, index, onSelect }: TrackRowProps) {
  const [imgError, setImgError] = useState(false);

  const handleTap = () => {
    // Synchronous clipboard write MUST execute before any async work or state updates
    let copiedSync = false;
    if (track.isrc) {
      copiedSync = syncCopyIsrc(track.isrc);
      if (copiedSync && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
    onSelect(track, copiedSync);
  };

  return (
    <motion.button
      type="button"
      onClick={handleTap}
      initial={{ opacity: 0, y: 8 }}
      animate={{
        opacity: 1,
        y: 0,
        transition: {
          duration: 0.22,
          delay: Math.min(index, 10) * 0.02,
          ease: [0.32, 0.72, 0, 1],
        },
      }}
      whileTap={{
        scale: 0.97,
        transition: { type: 'spring', stiffness: 500, damping: 30, delay: 0 },
      }}
      className="group flex min-h-[68px] w-full items-center gap-3 border-b border-white/[0.08] px-3.5 py-3 text-left transition-colors duration-100 last:border-b-0 hover:bg-white/[0.04] active:bg-[#2C2C2E]/85 focus-visible:bg-white/[0.06] focus-visible:outline-none"
      style={{ willChange: 'transform, opacity' }}
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-[#2C2C2E] ring-1 ring-white/10">
        {track.albumArt.medium && !imgError ? (
          <img
            src={track.albumArt.medium}
            alt={`${track.albumName || track.name} cover`}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#2C2C2E] text-[#8E8E93]">
            <Disc3 className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[15px] font-semibold leading-snug tracking-[-0.01em] text-white">
            {track.name}
          </span>
        </div>

        <p className="mt-0.5 truncate text-[13px] leading-snug text-[#8E8E93]">
          {track.artists}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {track.explicit && (
            <span
              className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-[4px] bg-white/15 px-1 text-[10px] font-bold leading-none text-[#E5E5EA]"
              title="Explicit"
            >
              E
            </span>
          )}
          <span className="inline-flex h-[16px] items-center rounded-[4px] bg-white/[0.08] px-1.5 text-[10px] font-semibold tracking-wider text-[#AEAEB2]">
            {ALBUM_TYPE_LABEL[track.albumType]}
          </span>
          {track.releaseYear && (
            <span className="text-[11px] font-medium tabular-nums text-[#8E8E93]">
              {track.releaseYear}
            </span>
          )}
          {track.isrc ? (
            <span className="font-mono-isrc ml-auto text-[11px] tracking-[0.01em] text-[#8E8E93]">
              {formatIsrcCode(track.isrc)}
            </span>
          ) : (
            <span className="ml-auto text-[11px] font-medium text-[#FF9F0A]">
              No ISRC
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-[#48484A] transition-transform duration-150 group-active:translate-x-0.5" />
    </motion.button>
  );
}
