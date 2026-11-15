import { ChevronRight, Loader2, Music, Pause, Play } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { TrackItem } from '../types/track';
import { copyIsrcVerified, getCachedTrackIsrc } from '../utils/spotifyInput';

const CAPSULE_RING_RADIUS = 11.1;
const CAPSULE_RING_CIRCUMFERENCE = 2 * Math.PI * CAPSULE_RING_RADIUS;

export function deduplicateArtists(rawArtists: string): string {
  if (!rawArtists) return '';
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const part of rawArtists.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(trimmed);
  }

  return unique.join(', ');
}

export interface TrackCapsuleProps {
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

export const TrackCapsule = memo(function TrackCapsule({
  track,
  isSelected = false,
  showRank = false,
  isPreviewPlaying = false,
  isPreviewLoading = false,
  previewProgress = 0,
  onTogglePreview,
  onSelect,
}: TrackCapsuleProps) {
  const artSrc = track.albumArt.medium || track.albumArt.large || null;
  const imgRef = useRef<HTMLImageElement>(null);
  const [loadedArtSrc, setLoadedArtSrc] = useState<string | null>(null);
  const [failedArtSrc, setFailedArtSrc] = useState<string | null>(null);
  const imgLoaded = Boolean(artSrc && loadedArtSrc === artSrc);
  const imgError = Boolean(artSrc && failedArtSrc === artSrc);

  useEffect(() => {
    const img = imgRef.current;
    if (artSrc && img && img.complete && img.naturalWidth > 0) {
      setLoadedArtSrc(artSrc);
    }
  }, [artSrc]);

  const cleanArtists = useMemo(() => deduplicateArtists(track.artists), [track.artists]);
  const subtitleText = track.releaseYear ? `${cleanArtists} · ${track.releaseYear}` : cleanArtists;

  const handleTap = async () => {
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
      className={`group relative flex w-full touch-pan-y cursor-pointer items-center gap-3.5 px-3.5 py-2.5 text-left transition-[transform,background-color] duration-150 ease-out hover:bg-white/[0.03] active:scale-[0.99] active:bg-[#2A2A2E] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/30 ${
        isSelected ? 'bg-white/[0.05]' : ''
      }`}
    >
      {/* Refined 52x52px album artwork with 1px inner glass hairline + borderless frosted play pill */}
      <div className="relative z-10 h-[52px] w-[52px] shrink-0 overflow-hidden rounded-[11px] bg-[#2C2C2E] after:pointer-events-none after:absolute after:inset-0 after:rounded-[11px] after:ring-1 after:ring-inset after:ring-white/[0.12] after:content-['']">
        {artSrc && !imgLoaded && !imgError && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden bg-[#2C2C2E]"
          >
            <div
              className="animate-skeleton-sweep h-full w-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.08) 50%, transparent 100%)',
              }}
            />
          </div>
        )}

        {artSrc && !imgError ? (
          <img
            ref={imgRef}
            src={artSrc}
            alt=""
            width={52}
            height={52}
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            onLoad={() => setLoadedArtSrc(artSrc)}
            onError={() => setFailedArtSrc(artSrc)}
            className={`h-full w-full object-cover transition-[opacity,transform] duration-200 ease-out group-hover:scale-[1.03] ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#2C2C2E] text-white/30">
            <Music className="h-5 w-5" aria-hidden="true" />
          </div>
        )}

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
                className={`relative flex h-6 w-6 items-center justify-center rounded-full bg-white/22 text-white shadow-[0_2px_6px_rgba(0,0,0,0.35)] transition-[transform,opacity,background-color] duration-150 hover:bg-white/34 group-hover/preview:bg-white/34 group-focus-visible/preview:ring-2 group-focus-visible/preview:ring-white/70 active:scale-90 ${
                  isActivePreview
                    ? 'scale-105 opacity-100'
                    : 'opacity-85 group-hover:opacity-100'
                }`}
              >
                {isActivePreview && (
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
                    {isPreviewPlaying && (
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
                    )}
                  </svg>
                )}
                <span className="relative flex h-3 w-3 items-center justify-center">
                  <Loader2
                    className={`absolute h-3 w-3 animate-spin text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-150 ease-out ${
                      isPreviewLoading ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                    }`}
                  />
                  <Pause
                    className={`absolute h-2.5 w-2.5 fill-white text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-150 ease-out ${
                      !isPreviewLoading && isPreviewPlaying
                        ? 'scale-100 opacity-100'
                        : 'scale-75 opacity-0'
                    }`}
                  />
                  <Play
                    className={`absolute ml-[1px] h-2.5 w-2.5 fill-white text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] transition-[opacity,transform] duration-150 ease-out ${
                      !isPreviewLoading && !isPreviewPlaying
                        ? 'scale-100 opacity-100'
                        : 'scale-75 opacity-0'
                    }`}
                  />
                </span>
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Crisp 2-line Apple Music typography */}
      <div className="relative z-10 min-w-0 flex-1">
        <div className="flex min-w-0 items-center">
          <span className="truncate text-[15px] font-semibold leading-snug tracking-[-0.015em] text-white">
            {track.name}
          </span>
          {track.explicit && (
            <span
              className="ml-1.5 inline-flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[3px] bg-white/[0.14] text-[9px] font-bold leading-none text-white/75"
              title="Explicit"
            >
              E
            </span>
          )}
        </div>

        <p className="mt-0.5 truncate text-[13px] leading-snug tracking-[-0.005em] text-white/50">
          {subtitleText}
        </p>
      </div>

      {/* Compact right accessory: rank movement + crisp disclosure chevron */}
      <div className="relative z-10 flex shrink-0 items-center gap-2">
        {showRank && (
          <span className="tabular-nums text-[11px] font-medium">
            {rankChange === 'NEW' ? (
              <span className="tracking-wide text-white/75">NEW</span>
            ) : rankChange > 0 ? (
              <span className="text-[#30D158]/90">▲ {rankChange}</span>
            ) : rankChange < 0 ? (
              <span className="text-[#FF453A]/85">▼ {Math.abs(rankChange)}</span>
            ) : (
              <span className="text-white/30">—</span>
            )}
          </span>
        )}

        <ChevronRight
          strokeWidth={2.4}
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ease-out group-hover:translate-x-[2px] ${
            isSelected ? 'text-white/75' : 'text-white/28'
          }`}
        />
      </div>
    </div>
  );
});

export default TrackCapsule;
