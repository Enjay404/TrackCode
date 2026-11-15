import { memo, useEffect, useState } from 'react';
import type { TrackItem } from '../types/track';
import { extractDominantColorRgb } from '../utils/dominantColor';
import { IsrcInspector } from './IsrcInspector';

interface DesktopInspectorCardProps {
  track: TrackItem | null;
  copiedSignal: number;
  isLoadingInitial?: boolean;
  isFetchingIsrc?: boolean;
  previewUrl?: string | null;
  isAudioPlaying?: boolean;
  isAudioLoading?: boolean;
  audioProgress?: number;
  getAudioGainMultiplier?: () => number;
  onTogglePreview?: () => void;
  onCopied: (isrc: string, copiedTrack?: TrackItem) => void;
  onCopyFailed?: () => void;
  onSearchOtherVersions: (track: TrackItem) => void;
}

export const DesktopInspectorCard = memo(function DesktopInspectorCard({
  track,
  copiedSignal,
  isLoadingInitial = false,
  isFetchingIsrc = false,
  previewUrl = null,
  isAudioPlaying = false,
  isAudioLoading = false,
  audioProgress = 0,
  getAudioGainMultiplier,
  onTogglePreview,
  onCopied,
  onCopyFailed,
  onSearchOtherVersions,
}: DesktopInspectorCardProps) {
  const [glowRgb, setGlowRgb] = useState<string>('110, 110, 128');
  const [glowReady, setGlowReady] = useState(false);

  useEffect(() => {
    if (!track) {
      setGlowReady(false);
      return;
    }

    let cancelled = false;
    const targetArtUrl = track.albumArt.medium || track.albumArt.large;
    void extractDominantColorRgb(targetArtUrl).then((rgb) => {
      if (!cancelled) {
        setGlowRgb(rgb);
        setGlowReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [track]);

  if (!track) {
    return (
      <aside
        aria-label="ISRC inspector"
        className="sticky top-8 overflow-hidden rounded-[32px] border border-white/[0.12] bg-gradient-to-b from-[#232326] to-[#151517] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
      >
        <div className="flex items-center gap-4">
          <div className="skeleton-shimmer h-24 w-24 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2.5">
            <div className="skeleton-shimmer h-5 w-3/4 rounded-md" />
            <div className="skeleton-shimmer h-4 w-1/2 rounded-md" />
            <div className="skeleton-shimmer h-4 w-1/3 rounded-md" />
          </div>
        </div>
        <div className="skeleton-shimmer mt-5 h-16 w-full rounded-[14px]" />
        <div className="skeleton-shimmer mt-3 h-[50px] w-full rounded-[14px]" />
        {!isLoadingInitial && (
          <p className="mt-4 text-center text-[13px] text-[#8E8E93]">
            Select any track on the left to inspect and copy its ISRC.
          </p>
        )}
      </aside>
    );
  }

  return (
    <aside
      aria-label={`ISRC inspector for ${track.name}`}
      className="sticky top-8 overflow-hidden rounded-[32px] border border-white/[0.12] bg-gradient-to-b from-[#232326] to-[#151517] p-6 shadow-[0_20px_50px_rgba(0,0,0,0.65)]"
    >
      {/* Top specular highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_70%)]"
      />

      {/* Ambient radial glow tinted with album cover dominant color */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full transition-opacity duration-300 ease-out"
        style={{
          opacity: glowReady ? 0.28 : 0.12,
          background: `radial-gradient(circle, rgba(${glowRgb}, 0.85) 0%, rgba(${glowRgb}, 0.24) 45%, transparent 72%)`,
        }}
      />

      <div key={track.id} className="animate-inspector-settle">
        <IsrcInspector
          variant="desktop"
          track={track}
          copiedSignal={copiedSignal}
          isActive={true}
          isFetchingIsrc={isFetchingIsrc}
          previewUrl={previewUrl}
          isAudioPlaying={isAudioPlaying}
          isAudioLoading={isAudioLoading}
          audioProgress={audioProgress}
          getAudioGainMultiplier={getAudioGainMultiplier}
          onTogglePreview={onTogglePreview}
          onCopied={onCopied}
          onCopyFailed={onCopyFailed}
          onSearchOtherVersions={onSearchOtherVersions}
        />
      </div>
    </aside>
  );
});

export default DesktopInspectorCard;
