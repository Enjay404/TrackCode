import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Copy, Loader2, Music, Pause, Play, Search } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import type { TrackItem } from '../types/track';
import {
  ALBUM_TYPE_BADGE_STYLE,
  ALBUM_TYPE_LABEL,
  EXPLICIT_BADGE_STYLE,
} from '../utils/badgeStyles';
import { IOS_EASE, SPRING_BUTTON } from '../utils/motionConfig';
import {
  copyIsrcVerified,
  formatIsrcCode,
  loadGuideExpandedPreference,
  saveGuideExpandedPreference,
} from '../utils/spotifyInput';
import { AcousticWaveform } from './AcousticWaveform';

const PREVIEW_RING_RADIUS = 18.9;
const PREVIEW_RING_CIRCUMFERENCE = 2 * Math.PI * PREVIEW_RING_RADIUS;

const AUTO_COPY_RESET_MS = 1600;
const MANUAL_COPY_RESET_MS = 2000;
const SHEET_DURATION_MS = 280;

export interface IsrcInspectorProps {
  variant: 'desktop' | 'mobile';
  track: TrackItem;
  copiedSignal: number;
  isActive?: boolean;
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

export const IsrcInspector = memo(function IsrcInspector({
  variant,
  track,
  copiedSignal,
  isActive = true,
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
}: IsrcInspectorProps) {
  const isDesktop = variant === 'desktop';
  const artSrc = track.albumArt.medium || track.albumArt.large || null;
  const imgRef = useRef<HTMLImageElement>(null);
  const [loadedArtSrc, setLoadedArtSrc] = useState<string | null>(null);
  const [failedArtSrc, setFailedArtSrc] = useState<string | null>(null);
  const [copiedState, setCopiedState] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);
  const [guideOpen, setGuideOpen] = useState<boolean>(() =>
    isDesktop ? true : loadGuideExpandedPreference()
  );

  const copyTimerRef = useRef<number | null>(null);
  const imgLoaded = Boolean(artSrc && loadedArtSrc === artSrc);
  const imgError = Boolean(artSrc && failedArtSrc === artSrc);

  useEffect(() => {
    const img = imgRef.current;
    if (artSrc && img && img.complete && img.naturalWidth > 0) {
      setLoadedArtSrc(artSrc);
    }
  }, [artSrc]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    if (!track.isrc || copiedSignal === 0) {
      setCopiedState(false);
      setPulseCount(0);
      return;
    }

    if (isDesktop) {
      setCopiedState(true);
      setPulseCount((c) => c + 1);
      copyTimerRef.current = window.setTimeout(() => {
        copyTimerRef.current = null;
        setCopiedState(false);
      }, AUTO_COPY_RESET_MS);
      return () => {
        if (copyTimerRef.current) {
          window.clearTimeout(copyTimerRef.current);
          copyTimerRef.current = null;
        }
      };
    }

    setPulseCount(0);
    setCopiedState(true);
    const glowDelayTimer = window.setTimeout(() => {
      setPulseCount((c) => c + 1);
    }, SHEET_DURATION_MS + 10);
    copyTimerRef.current = window.setTimeout(() => {
      copyTimerRef.current = null;
      setCopiedState(false);
    }, AUTO_COPY_RESET_MS);

    return () => {
      window.clearTimeout(glowDelayTimer);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, [track, copiedSignal, isDesktop]);

  const handleManualCopy = async () => {
    if (!track.isrc) return;
    const ok = await copyIsrcVerified(track.isrc);
    if (ok) {
      if (!isDesktop && typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      setCopiedState(true);
      setPulseCount((c) => c + 1);
      onCopied(track.isrc, track);
      copyTimerRef.current = window.setTimeout(() => {
        copyTimerRef.current = null;
        setCopiedState(false);
      }, MANUAL_COPY_RESET_MS);
    } else {
      onCopyFailed?.();
    }
  };

  const handleToggleGuide = () => {
    setGuideOpen((prev) => {
      const next = !prev;
      saveGuideExpandedPreference(next);
      return next;
    });
  };

  const stopSheetPointerDown = isDesktop
    ? undefined
    : (e: React.PointerEvent<HTMLElement>) => e.stopPropagation();

  const interactiveTabIndex = isActive ? 0 : -1;
  const formattedIsrc = track.isrc ? formatIsrcCode(track.isrc) : null;
  const showPreviewControls = isActive && Boolean(previewUrl) && Boolean(onTogglePreview);
  const showWaveform =
    isActive && (Boolean(previewUrl) || isAudioPlaying || isAudioLoading || audioProgress > 0);

  return (
    <>
      {/* Track Header: Cover art + Preview Play/Pause Ring + Title + Artist + Badges + 16-bar Waveform */}
      <div className="relative flex items-center gap-4">
        <div
          className={`relative shrink-0 overflow-hidden bg-[#2C2C2E] shadow-[0_8px_24px_rgba(0,0,0,0.5)] ring-1 ring-white/10 ${
            isDesktop ? 'h-24 w-24 rounded-2xl' : 'h-[88px] w-[88px] rounded-[14px]'
          }`}
        >
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
              width={isDesktop ? 96 : 88}
              height={isDesktop ? 96 : 88}
              referrerPolicy="no-referrer"
              decoding="async"
              onLoad={() => setLoadedArtSrc(artSrc)}
              onError={() => setFailedArtSrc(artSrc)}
              className={`h-full w-full object-cover transition-opacity duration-200 ease-out ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#2C2C2E] text-white/30">
              <Music className={isDesktop ? 'h-6 w-6' : 'h-5 w-5'} aria-hidden="true" />
            </div>
          )}

          {showPreviewControls && onTogglePreview && (
            <button
              type="button"
              onPointerDown={stopSheetPointerDown}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePreview();
              }}
              tabIndex={0}
              aria-label={isAudioPlaying ? 'Pause preview' : 'Play 30-second preview'}
              className="absolute left-1/2 top-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 touch-manipulation cursor-pointer items-center justify-center rounded-full border border-white/25 bg-black/70 text-white shadow-[0_4px_16px_rgba(0,0,0,0.75)] transition-transform duration-150 hover:scale-105 hover:bg-black/85 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <svg
                viewBox="0 0 40 40"
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
              >
                <circle
                  cx="20"
                  cy="20"
                  r={PREVIEW_RING_RADIUS}
                  fill="none"
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="2.2"
                />
                {(isAudioPlaying || audioProgress > 0) && (
                  <circle
                    cx="20"
                    cy="20"
                    r={PREVIEW_RING_RADIUS}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeDasharray={PREVIEW_RING_CIRCUMFERENCE}
                    strokeDashoffset={
                      PREVIEW_RING_CIRCUMFERENCE * (1 - Math.min(1, Math.max(0, audioProgress)))
                    }
                  />
                )}
              </svg>
              {isAudioLoading ? (
                <Loader2 className="relative h-4 w-4 animate-spin text-white" />
              ) : isAudioPlaying ? (
                <Pause className="relative h-4 w-4 fill-white text-white" />
              ) : (
                <Play className="relative ml-0.5 h-4 w-4 fill-white text-white" />
              )}
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2
            className={`line-clamp-2 font-semibold leading-tight tracking-[-0.02em] text-white ${
              isDesktop ? 'text-[20px]' : 'text-[19px]'
            }`}
          >
            {track.name}
          </h2>
          <p
            className={`inline-flex max-w-full items-center gap-1.5 text-[15px] text-[#AEAEB2] ${
              isDesktop ? 'mt-1.5' : 'mt-1'
            }`}
          >
            <span className="truncate">{track.artists}</span>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              aria-label="Verified"
              className="h-[15px] w-[15px] shrink-0"
            >
              <rect x="3" y="3" width="18" height="18" rx="4.2" fill="#0095F6" />
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="4.2"
                transform="rotate(45 12 12)"
                fill="#0095F6"
              />
              <path
                d="M8.4 12.3l2.3 2.4 4.9-5.2"
                stroke="#FFFFFF"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </p>
          <div
            className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 text-[12px] text-[#8E8E93] ${
              isDesktop ? 'mt-2.5' : 'mt-2'
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex h-[18px] items-center rounded-[4px] px-1.5 text-[10px] font-semibold leading-none tracking-[0.04em]"
                style={ALBUM_TYPE_BADGE_STYLE[track.albumType]}
              >
                {ALBUM_TYPE_LABEL[track.albumType]}
              </span>
              {track.releaseYear && (
                <span className="tabular-nums font-medium text-[#8E8E93]">
                  {track.releaseYear}
                </span>
              )}
              {track.explicit && (
                <span
                  className="inline-flex h-[18px] items-center rounded-[4px] px-1.5 text-[10px] font-semibold leading-none tracking-[0.02em]"
                  style={EXPLICIT_BADGE_STYLE}
                >
                  Explicit
                </span>
              )}
            </div>
            {showWaveform && (
              <AcousticWaveform
                isPlaying={isAudioPlaying}
                isLoading={isAudioLoading}
                hasProgress={audioProgress > 0}
                getGainMultiplier={getAudioGainMultiplier}
              />
            )}
          </div>
        </div>
      </div>

      {/* Inset Dark-Glass Instagram Search Code + White Pill CTA */}
      {isFetchingIsrc || formattedIsrc ? (
        <div className="relative mt-5 space-y-3">
          <motion.button
            type="button"
            disabled={isFetchingIsrc}
            onPointerDown={stopSheetPointerDown}
            onClick={() => void handleManualCopy()}
            whileTap={isFetchingIsrc ? undefined : { scale: 0.985 }}
            transition={SPRING_BUTTON}
            tabIndex={interactiveTabIndex}
            aria-label={
              isFetchingIsrc
                ? 'Fetching ISRC'
                : formattedIsrc
                  ? `Copy ${formattedIsrc}`
                  : undefined
            }
            className={`group relative flex w-full touch-manipulation items-center justify-between gap-3 rounded-[14px] border border-white/10 bg-[#2C2C2E] px-4 py-3.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25 ${
              isFetchingIsrc
                ? 'cursor-wait'
                : 'cursor-pointer hover:bg-[#323234] active:bg-[#3A3A3C]'
            }`}
          >
            <motion.div
              key={`${variant}-pulse-${pulseCount}`}
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.995 }}
              animate={
                pulseCount > 0
                  ? { opacity: [0, 0.85, 0.7, 0], scale: [0.995, 1, 1, 1] }
                  : { opacity: 0 }
              }
              transition={{
                duration: 0.65,
                times: [0, 0.15, 0.55, 1],
                ease: 'easeOut',
              }}
              className="pointer-events-none absolute -inset-[1px] rounded-[14px] border-2 border-[#30D158]/85 shadow-[0_0_12px_rgba(48,209,88,0.16)]"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-medium tracking-wide text-[#8E8E93]">
                Instagram Search Code
              </div>
              {isFetchingIsrc ? (
                <div className="relative mt-0.5 flex h-7 items-center gap-2.5 overflow-hidden rounded-lg">
                  <span aria-hidden="true" className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.95)]" />
                  </span>
                  <span className="text-[15px] font-medium tracking-[-0.01em] text-white/80">
                    Fetching ISRC…
                  </span>
                  <span
                    aria-hidden="true"
                    className="trackcode-isrc-shimmer pointer-events-none absolute inset-0"
                  />
                </div>
              ) : (
                <div className="mt-0.5 flex h-7 items-center">
                  <span className="font-mono-isrc select-all truncate text-[17px] font-semibold tracking-[0.02em] text-white">
                    {formattedIsrc}
                  </span>
                </div>
              )}
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[#8E8E93] transition-colors duration-150 group-hover:text-white">
              {isFetchingIsrc ? (
                <Loader2 className="h-4 w-4 animate-spin text-white/60" />
              ) : (
                <Copy
                  className={`h-4 w-4 transition-colors duration-150 ${
                    copiedState ? 'text-[#30D158]' : ''
                  }`}
                />
              )}
            </span>
          </motion.button>

          <motion.button
            type="button"
            disabled={isFetchingIsrc}
            onPointerDown={stopSheetPointerDown}
            onClick={() => void handleManualCopy()}
            whileTap={isFetchingIsrc ? undefined : { scale: 0.97 }}
            transition={SPRING_BUTTON}
            tabIndex={interactiveTabIndex}
            className={`flex min-h-[50px] w-full touch-manipulation items-center justify-center overflow-hidden rounded-[14px] px-5 text-[16px] font-semibold tracking-[-0.01em] transition-[transform,background-color,color] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.97] focus-visible:outline-none ${
              isFetchingIsrc
                ? 'cursor-wait bg-white text-black opacity-60'
                : copiedState
                  ? 'cursor-pointer bg-[#30D158] text-black'
                  : 'cursor-pointer bg-white text-black hover:bg-white/95 active:bg-[#2C2C2E] active:text-white'
            }`}
          >
            {isFetchingIsrc ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin stroke-[2.2]" />
                <span>Fetching ISRC…</span>
              </span>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                {copiedState ? (
                  <motion.span
                    key="copied"
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: IOS_EASE }}
                    className="inline-flex items-center justify-center gap-2"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5 stroke-current"
                      strokeWidth={2.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <motion.path
                        d="M5 13l4 4L19 7"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                      />
                    </svg>
                    <span>Copied</span>
                  </motion.span>
                ) : (
                  <motion.span
                    key="copy"
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.18, ease: IOS_EASE }}
                    className="inline-flex items-center justify-center gap-2"
                  >
                    <Copy className="h-4 w-4 stroke-[2.2]" />
                    <span>Copy ISRC</span>
                  </motion.span>
                )}
              </AnimatePresence>
            )}
          </motion.button>
        </div>
      ) : (
        <div className="relative mt-5 space-y-3">
          <div className="rounded-[14px] border border-white/10 bg-[#2C2C2E] px-4 py-3.5">
            <div className="text-[11px] font-medium tracking-wide text-[#8E8E93]">
              Instagram Search Code
            </div>
            <div className="mt-0.5 flex h-7 items-center">
              <span className="text-[14px] font-medium text-[#98989D]">
                ISRC unavailable for this track
              </span>
            </div>
          </div>

          <motion.button
            type="button"
            onPointerDown={stopSheetPointerDown}
            onClick={() => onSearchOtherVersions(track)}
            whileTap={{ scale: 0.97 }}
            transition={SPRING_BUTTON}
            tabIndex={interactiveTabIndex}
            className="flex min-h-[50px] w-full touch-manipulation cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-[#2C2C2E] px-5 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-[#343438] active:bg-[#3A3A3C]"
          >
            <Search className="h-4 w-4" />
            <span>Search other versions</span>
          </motion.button>
        </div>
      )}

      {/* How to use on Instagram: Always Open on Desktop, Collapsible Accordion on Mobile */}
      {isDesktop ? (
        <div className="relative mt-5 rounded-[16px] border border-white/10 bg-[#2C2C2E]/55 px-4 py-3.5">
          <h3 className="text-[13.5px] font-semibold text-white">How to use on Instagram</h3>
          <ol className="mt-3 space-y-2.5 border-t border-white/10 pt-3 text-[13px] leading-relaxed text-[#D1D1D6]">
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold tabular-nums text-white">
                1
              </span>
              <span>
                Open Instagram and tap the{' '}
                <strong className="font-semibold text-white">Music</strong> sticker on a Story,
                Reel, or Note.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold tabular-nums text-white">
                2
              </span>
              <span>
                Paste{' '}
                <span className="font-mono-isrc text-white">
                  {formattedIsrc || 'ISRC:XXXXXXXXXXXX'}
                </span>{' '}
                directly into the search bar.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold tabular-nums text-white">
                3
              </span>
              <span>Tap the hidden track when it pops up.</span>
            </li>
          </ol>
        </div>
      ) : (
        <div className="mt-4 rounded-[16px] border border-white/10 bg-[#2C2C2E]/65">
          <button
            type="button"
            onClick={handleToggleGuide}
            tabIndex={interactiveTabIndex}
            aria-expanded={guideOpen}
            className="flex min-h-[46px] w-full touch-manipulation cursor-pointer items-center justify-between rounded-[16px] px-4 py-2.5 text-left transition-transform duration-150 active:scale-[0.985] active:bg-[#2C2C2E]"
          >
            <span className="text-[14px] font-semibold text-white">How to use on Instagram</span>
            <ChevronDown
              className={`h-4 w-4 text-[#8E8E93] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                guideOpen ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>

          <div
            aria-hidden={!guideOpen}
            className={`grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              guideOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <ol className="space-y-2.5 border-t border-white/10 px-4 pb-4 pt-3 text-[13px] leading-relaxed text-[#D1D1D6]">
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold tabular-nums text-white">
                    1
                  </span>
                  <span>
                    Open Instagram and tap the{' '}
                    <strong className="font-semibold text-white">Music</strong> sticker on a Story,
                    Reel, or Note.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold tabular-nums text-white">
                    2
                  </span>
                  <span>
                    Paste{' '}
                    <span className="font-mono-isrc text-white">
                      {formattedIsrc || 'ISRC:XXXXXXXXXXXX'}
                    </span>{' '}
                    directly into the search bar.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold tabular-nums text-white">
                    3
                  </span>
                  <span>Tap the hidden track when it pops up.</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default IsrcInspector;
