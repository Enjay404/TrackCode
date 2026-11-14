import { ChevronRight, Disc3 } from 'lucide-react';
import { memo, useState } from 'react';
import type { TrackItem } from '../types/track';
import {
  ALBUM_TYPE_BADGE_STYLE,
  ALBUM_TYPE_LABEL,
  EXPLICIT_BADGE_STYLE,
} from '../utils/badgeStyles';
import { copyIsrcVerified } from '../utils/spotifyInput';

interface TrackRowProps {
  track: TrackItem;
  isSelected?: boolean;
  onSelect: (track: TrackItem, copied: boolean) => void;
}

export const TrackRow = memo(function TrackRow({
  track,
  isSelected = false,
  onSelect,
}: TrackRowProps) {
  const artSrc = track.albumArt.medium || track.albumArt.large || null;
  const [failedArtSrc, setFailedArtSrc] = useState<string | null>(null);
  const imgError = Boolean(artSrc && failedArtSrc === artSrc);

  const handleTap = async () => {
    let copied = false;
    if (track.isrc) {
      copied = await copyIsrcVerified(track.isrc);
      if (copied && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
    onSelect(track, copied);
  };

  return (
    <button
      type="button"
      data-track-id={track.id}
      aria-current={isSelected ? 'true' : undefined}
      onClick={() => void handleTap()}
      className={`group flex min-h-[70px] w-full cursor-pointer items-center gap-2.5 border-b border-white/[0.08] px-3 py-3 text-left transition-[transform,background-color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] last:border-b-0 hover:bg-white/[0.04] active:scale-[0.985] active:bg-[#2C2C2E]/85 focus-visible:bg-white/[0.06] focus-visible:outline-none ${
        isSelected
          ? 'lg:bg-white/[0.08] lg:ring-1 lg:ring-inset lg:ring-white/25'
          : ''
      }`}
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-[#2C2C2E] ring-1 ring-white/10">
        {artSrc && !imgError ? (
          <img
            src={artSrc}
            alt={`${track.albumName || track.name} cover`}
            width={48}
            height={48}
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            onError={() => setFailedArtSrc(artSrc)}
            className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.04] group-active:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#2C2C2E] text-[#8E8E93] transition-transform duration-200 ease-out group-hover:scale-[1.04] group-active:scale-[1.04]">
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

        <div className="mt-1.5 flex flex-nowrap items-center gap-1.5 overflow-hidden">
          {track.explicit && (
            <span
              className="inline-flex h-[17px] min-w-[17px] shrink-0 items-center justify-center rounded-[4px] px-1 text-[9.5px] font-bold leading-none"
              style={EXPLICIT_BADGE_STYLE}
              title="Explicit"
            >
              E
            </span>
          )}
          <span
            className="inline-flex h-[17px] shrink-0 items-center whitespace-nowrap rounded-[4px] px-1.5 text-[9.5px] font-semibold leading-none tracking-[0.04em]"
            style={ALBUM_TYPE_BADGE_STYLE[track.albumType]}
          >
            {ALBUM_TYPE_LABEL[track.albumType]}
          </span>
          {track.releaseYear && (
            <span className="shrink-0 whitespace-nowrap text-[11px] font-medium tabular-nums text-[#8E8E93]">
              {track.releaseYear}
            </span>
          )}
        </div>
      </div>

      <ChevronRight
        className={`h-4 w-4 shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-[3px] group-active:translate-x-[3px] ${
          isSelected ? 'text-[#48484A] lg:text-[#30D158]' : 'text-[#48484A]'
        }`}
      />
    </button>
  );
});
