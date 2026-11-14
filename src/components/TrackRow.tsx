import { ChevronRight, Disc3, Loader2, Pause, Play } from 'lucide-react';
import { memo, useState } from 'react';
import type { TrackItem } from '../types/track';
import {
  ALBUM_TYPE_BADGE_STYLE,
  ALBUM_TYPE_LABEL,
  EXPLICIT_BADGE_STYLE,
} from '../utils/badgeStyles';
import { copyIsrcVerified, getCachedTrackIsrc } from '../utils/spotifyInput';

const CAPSULE_RING_RADIUS = 11.1;
const CAPSULE_RING_CIRCUMFERENCE = 2 * Math.PI * CAPSULE_RING_RADIUS;

interface TrackRowProps {
  track: TrackItem;
  index?: number;
  isSelected?: boolean;
  showRank?: boolean;
  isPreviewPlaying?: boolean;
  isPreviewLoading?: boolean;
  previewProgress?: number;
  onTogglePreview?: (track: TrackItem) => void;
  onSelect: (track: TrackItem, copied: boolean) => void;
}

export const TrackRow = memo(function TrackRow({
  track,
  index = 0,
  isSelected = false,
  showRank = false,
  isPreviewPlaying = false,
  isPreviewLoading = false,
  previewProgress = 0,
  onTogglePreview,
  onSelect,
}: TrackRowProps) {
  const artSrc = track.albumArt.medium || track.albumArt.large || null;
  const [failedArtSrc, setFailedArtSrc] = useState<string | null>(null);
  const [tapSweepCount, setTapSweepCount] = useState(0);
  const imgError = Boolean(artSrc && failedArtSrc === artSrc);

  const handleTap = async () => {
    setTapSweepCount((prev) => prev + 1);
    const knownIsrc = track.isrc ?? getCachedTrackIsrc(track.id) ?? null;
    let copied = false;
    if (knownIsrc) {
      copied = await copyIsrcVerified(knownIsrc);
      if (copied && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
    onSelect(knownIsrc && !track.isrc ? { ...track, isrc: knownIsrc } : track, copied);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void handleTap();
    }
  };

  const entranceDelayMs = Math.min(index, 12) * 45;
  const rankChange = track.rankChange ?? 0;
  const isActivePreview = isPreviewPlaying || isPreviewLoading;

  return (
    <div
      role="button"
      tabIndex={0}
      data-track-id={track.id}
      aria-current={isSelected ? 'true' : undefined}
      onClick={() => void handleTap()}
      onKeyDown={handleRowKeyDown}
      className={`group relative flex min-h-[70px] w-full touch-pan-y cursor-pointer items-center gap-2.5 overflow-hidden rounded-2xl border px-3.5 py-3 text-left transition-transform duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 ${
        isSelected
          ? 'border-white/[0.18] border-t-white/[0.32] bg-gradient-to-b from-[#262629] to-[#18181B] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_8px_24px_rgba(0,0,0,0.45)]'
          : 'border-white/[0.08] border-t-white/[0.14] bg-gradient-to-b from-[#1C1C1F] to-[#131315] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] hover:border-t-white/[0.24] active:border-t-white/[0.24]'
      }`}
    >
      {/* Subtle monochrome top specular catch for active/selected capsule */}
      {isSelected && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_15%_0%,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.03)_50%,transparent_100%)]"
        />
      )}

      {/* Staggered entrance light sweep (index * 45ms) & full 600ms tap reflection */}
      <span
        key={tapSweepCount}
        aria-hidden="true"
        className={`trackcode-light-beam pointer-events-none absolute inset-0 ${
          tapSweepCount === 0 ? 'animate-sweep-enter' : 'animate-sweep-tap'
        }`}
        style={tapSweepCount === 0 ? { animationDelay: `${entranceDelayMs}ms` } : undefined}
      />

      {/* Pointer hover light reflection (GPU translate3d only) */}
      <span
        aria-hidden="true"
        className="trackcode-light-beam trackcode-sweep-hover pointer-events-none absolute inset-0"
      />

      <div className="relative z-10 h-12 w-12 shrink-0">
        <div className="h-full w-full overflow-hidden rounded-[10px] bg-[#2C2C2E] ring-1 ring-white/10">
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

        {onTogglePreview && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePreview(track);
              }}
              aria-label={isPreviewPlaying ? 'Pause preview' : 'Play 30-second preview'}
              className="group/preview pointer-events-auto relative z-10 -m-2 flex cursor-pointer items-center justify-center p-2 focus-visible:outline-none"
            >
              <span
                className={`relative flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-white/22 text-white shadow-[0_2px_8px_rgba(0,0,0,0.28)] transition-all duration-150 hover:bg-white/35 group-hover/preview:bg-white/35 group-focus-visible/preview:ring-2 group-focus-visible/preview:ring-white/70 active:scale-90 ${
                  isActivePreview
                    ? 'scale-105 opacity-100'
                    : 'opacity-80 group-hover:opacity-100'
                }`}
              >
                {isPreviewPlaying && (
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r={CAPSULE_RING_RADIUS}
                      fill="none"
                      stroke="rgba(255,255,255,0.25)"
                      strokeWidth="1.75"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r={CAPSULE_RING_RADIUS}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeDasharray={CAPSULE_RING_CIRCUMFERENCE}
                      strokeDashoffset={
                        CAPSULE_RING_CIRCUMFERENCE *
                        (1 - Math.min(1, Math.max(0, previewProgress)))
                      }
                    />
                  </svg>
                )}
                {isPreviewLoading ? (
                  <Loader2 className="relative h-3 w-3 animate-spin text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" />
                ) : isPreviewPlaying ? (
                  <Pause className="relative h-2.5 w-2.5 fill-white text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" />
                ) : (
                  <Play className="relative ml-[1px] h-2.5 w-2.5 fill-white text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" />
                )}
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="relative z-10 min-w-0 flex-1">
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

      {showRank && (
        <span className="relative z-10 shrink-0 tabular-nums">
          {rankChange === 'NEW' ? (
            <span className="text-[10px] font-semibold tracking-wide text-white/75">
              NEW
            </span>
          ) : rankChange > 0 ? (
            <span className="text-[11px] font-semibold text-[#30D158]/90">
              ▲ {rankChange}
            </span>
          ) : rankChange < 0 ? (
            <span className="text-[11px] font-semibold text-[#FF453A]/85">
              ▼ {Math.abs(rankChange)}
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-white/30">—</span>
          )}
        </span>
      )}

      <ChevronRight
        className={`relative z-10 h-4 w-4 shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-[3px] group-active:translate-x-[3px] ${
          isSelected ? 'text-white/90' : 'text-white/30'
        }`}
      />
    </div>
  );
});
