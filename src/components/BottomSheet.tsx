import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Copy, Disc3, Loader2, Pause, Play, Search, X } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import type { TrackItem } from '../types/track';
import {
  ALBUM_TYPE_BADGE_STYLE,
  ALBUM_TYPE_LABEL,
  EXPLICIT_BADGE_STYLE,
} from '../utils/badgeStyles';
import { extractDominantColorRgb } from '../utils/dominantColor';
import { IOS_EASE, SPRING_BUTTON } from '../utils/motionConfig';
import {
  copyIsrcVerified,
  formatIsrcCode,
  loadGuideExpandedPreference,
  saveGuideExpandedPreference,
} from '../utils/spotifyInput';

const PREVIEW_RING_RADIUS = 18.9;
const PREVIEW_RING_CIRCUMFERENCE = 2 * Math.PI * PREVIEW_RING_RADIUS;

interface BottomSheetProps {
  track: TrackItem | null;
  autoCopiedSignal: number;
  isFetchingIsrc?: boolean;
  previewUrl?: string | null;
  isAudioPlaying?: boolean;
  isAudioLoading?: boolean;
  audioProgress?: number;
  onTogglePreview?: () => void;
  onClose: () => void;
  onCopied: (isrc: string, copiedTrack?: TrackItem) => void;
  onCopyFailed?: () => void;
  onSearchOtherVersions: (track: TrackItem) => void;
}

const SHEET_DURATION_MS = 250;
const AUTO_COPY_RESET_MS = 750;
const MANUAL_COPY_RESET_MS = 1000;

export const BottomSheet = memo(function BottomSheet({
  track,
  autoCopiedSignal,
  isFetchingIsrc = false,
  previewUrl = null,
  isAudioPlaying = false,
  isAudioLoading = false,
  audioProgress = 0,
  onTogglePreview,
  onClose,
  onCopied,
  onCopyFailed,
  onSearchOtherVersions,
}: BottomSheetProps) {
  const [lastTrack, setLastTrack] = useState<TrackItem | null>(track);
  const isOpen = track !== null;
  const activeTrack = track ?? lastTrack;
  const artSrc = activeTrack?.albumArt.medium || activeTrack?.albumArt.large || null;

  const [glowRgb, setGlowRgb] = useState<string>('110, 110, 128');
  const [glowReady, setGlowReady] = useState(false);
  const [failedArtSrc, setFailedArtSrc] = useState<string | null>(null);
  const [copiedState, setCopiedState] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);
  const [guideOpen, setGuideOpen] = useState<boolean>(() => loadGuideExpandedPreference());

  const copyTimerRef = useRef<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startY: number;
    startTime: number;
    lastY: number;
  }>({
    active: false,
    pointerId: null,
    startY: 0,
    startTime: 0,
    lastY: 0,
  });

  const imgError = Boolean(artSrc && failedArtSrc === artSrc);

  useEffect(() => {
    if (track) {
      setLastTrack(track);
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA') {
        triggerElementRef.current = activeEl;
      } else {
        triggerElementRef.current = null;
      }
      return;
    }

    const resetGlowTimer = window.setTimeout(() => {
      setGlowReady(false);
    }, SHEET_DURATION_MS + 20);

    const prevTrigger = triggerElementRef.current;
    triggerElementRef.current = null;
    if (prevTrigger && typeof prevTrigger.focus === 'function' && document.contains(prevTrigger)) {
      window.setTimeout(() => {
        prevTrigger.focus({ preventScroll: true });
      }, SHEET_DURATION_MS);
    }

    return () => {
      window.clearTimeout(resetGlowTimer);
    };
  }, [track]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!track) return;

    let cancelled = false;
    const targetArtUrl = track.albumArt.medium || track.albumArt.large;
    const deferTimer = window.setTimeout(() => {
      void extractDominantColorRgb(targetArtUrl).then((rgb) => {
        if (!cancelled) {
          setGlowRgb(rgb);
          setGlowReady(true);
        }
      });
    }, SHEET_DURATION_MS + 20);

    return () => {
      cancelled = true;
      window.clearTimeout(deferTimer);
    };
  }, [track]);

  useEffect(() => {
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    if (!track || !track.isrc || autoCopiedSignal === 0) {
      setCopiedState(false);
      setPulseCount(0);
      return;
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
  }, [track, autoCopiedSignal]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleManualCopy = async () => {
    if (!activeTrack?.isrc) return;
    const ok = await copyIsrcVerified(activeTrack.isrc);
    if (ok) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      setCopiedState(true);
      setPulseCount((c) => c + 1);
      onCopied(activeTrack.isrc, activeTrack);
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

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isOpen) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, a')) return;

    dragStateRef.current = {
      active: true,
      pointerId: e.pointerId,
      startY: e.clientY,
      startTime: performance.now(),
      lastY: 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;

    const rawDy = e.clientY - drag.startY;
    const dy = rawDy > 0 ? rawDy * 0.85 : 0;
    drag.lastY = dy;

    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
      sheetRef.current.style.transform = `translate3d(0, ${dy}px, 0)`;
    }
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;

    const elapsed = Math.max(1, performance.now() - drag.startTime);
    const velocity = drag.lastY / elapsed;
    const shouldClose = drag.lastY > 88 || velocity > 0.45;

    dragStateRef.current.active = false;
    dragStateRef.current.pointerId = null;

    if (sheetRef.current) {
      sheetRef.current.style.transition = '';
      sheetRef.current.style.transform = '';
    }

    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    if (shouldClose) {
      onClose();
    }
  };

  const formattedIsrc = activeTrack?.isrc ? formatIsrcCode(activeTrack.isrc) : null;
  const visibilityTransition = isOpen ? '0ms linear 0ms' : `0ms linear ${SHEET_DURATION_MS}ms`;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center"
      role="dialog"
      aria-modal={isOpen}
      aria-hidden={!isOpen}
      aria-label={activeTrack?.name || 'Track details'}
      style={{
        visibility: isOpen ? 'visible' : 'hidden',
        pointerEvents: isOpen ? 'auto' : 'none',
        transition: `visibility ${visibilityTransition}`,
      }}
    >
      {/* Translucent modal backdrop (zero backdrop-filter) */}
      <div
        onClick={isOpen ? onClose : undefined}
        className="fixed inset-0 bg-black/72"
        style={{
          opacity: isOpen ? 1 : 0,
          transition: `opacity ${SHEET_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
      />

      {/* Warm GPU-composited bottom sheet */}
      <div
        ref={sheetRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{
          transform: isOpen ? 'translate3d(0, 0, 0)' : 'translate3d(0, 105%, 0)',
          opacity: isOpen ? 1 : 0,
          backfaceVisibility: 'hidden',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          background:
            'linear-gradient(180deg, rgba(34, 34, 38, 0.98) 0%, rgba(24, 24, 28, 0.96) 100%)',
          borderTop: '1px solid rgba(255, 255, 255, 0.14)',
          touchAction: 'pan-x',
          transition: `transform ${SHEET_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${SHEET_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
        className="relative z-10 w-full max-w-[480px] overflow-hidden rounded-t-[28px] px-5 pt-2.5 shadow-[0_-16px_48px_rgba(0,0,0,0.75)]"
      >
        {/* Ambient radial glow tinted with album cover dominant color */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full transition-opacity duration-300 ease-out"
          style={{
            opacity: glowReady ? 0.3 : 0.12,
            background: `radial-gradient(circle, rgba(${glowRgb}, 0.85) 0%, rgba(${glowRgb}, 0.24) 45%, transparent 72%)`,
          }}
        />

        {/* Top grabber pill + dismiss icon */}
        <div className="relative z-20 flex items-center justify-center pb-4">
          <div className="h-[5px] w-9 rounded-full bg-white/25" />
          <motion.button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            whileTap={{ scale: 0.94 }}
            transition={SPRING_BUTTON}
            tabIndex={isOpen ? 0 : -1}
            aria-label="Close track details"
            className="absolute right-0 top-[-2px] z-20 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[#8E8E93] active:bg-[#2C2C2E] focus-visible:outline-none"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2C2C2E] text-[#AEAEB2]">
              <X className="h-4 w-4" />
            </span>
          </motion.button>
        </div>

        {/* Track header: 88x88 cover art (reusing decoded medium URL) + title + artist */}
        <div className="relative flex items-center gap-4">
          <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[14px] bg-[#2C2C2E] shadow-[0_8px_24px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
            {artSrc && !imgError ? (
              <img
                src={artSrc}
                alt={activeTrack ? `${activeTrack.albumName || activeTrack.name} artwork` : ''}
                width={88}
                height={88}
                referrerPolicy="no-referrer"
                decoding="async"
                onError={() => setFailedArtSrc(artSrc)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[#8E8E93]">
                <Disc3 className="h-8 w-8" />
              </div>
            )}

            {isOpen && previewUrl && onTogglePreview && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePreview();
                }}
                tabIndex={0}
                aria-label={isAudioPlaying ? 'Pause preview' : 'Play 30-second preview'}
                className="absolute left-1/2 top-1/2 z-10 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-black/70 text-white shadow-[0_4px_16px_rgba(0,0,0,0.75)] transition-transform duration-150 hover:scale-105 hover:bg-black/85 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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
            <h2 className="line-clamp-2 text-[19px] font-semibold leading-tight tracking-[-0.02em] text-white">
              {activeTrack?.name ?? ''}
            </h2>
            <p className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[15px] text-[#AEAEB2]">
              <span className="truncate">{activeTrack?.artists ?? ''}</span>
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
            {activeTrack && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-[#8E8E93]">
                <span
                  className="inline-flex h-[18px] items-center rounded-[4px] px-1.5 text-[10px] font-semibold leading-none tracking-[0.04em]"
                  style={ALBUM_TYPE_BADGE_STYLE[activeTrack.albumType]}
                >
                  {ALBUM_TYPE_LABEL[activeTrack.albumType]}
                </span>
                {activeTrack.releaseYear && (
                  <span className="tabular-nums font-medium text-[#8E8E93]">
                    {activeTrack.releaseYear}
                  </span>
                )}
                {activeTrack.explicit && (
                  <span
                    className="inline-flex h-[18px] items-center rounded-[4px] px-1.5 text-[10px] font-semibold leading-none tracking-[0.02em]"
                    style={EXPLICIT_BADGE_STYLE}
                  >
                    Explicit
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Monospace ISRC pill + Primary Copy Action */}
        {isFetchingIsrc || formattedIsrc ? (
          <div className="mt-5 space-y-3">
            <motion.button
              type="button"
              disabled={isFetchingIsrc}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => void handleManualCopy()}
              whileTap={isFetchingIsrc ? undefined : { scale: 0.985 }}
              transition={SPRING_BUTTON}
              tabIndex={isOpen ? 0 : -1}
              aria-label={
                isFetchingIsrc
                  ? 'Fetching ISRC'
                  : formattedIsrc
                    ? `Copy ${formattedIsrc}`
                    : undefined
              }
              className={`group relative flex w-full items-center justify-between gap-3 rounded-[14px] border border-white/10 bg-[#2C2C2E] px-4 py-3.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25 ${
                isFetchingIsrc
                  ? 'cursor-wait'
                  : 'cursor-pointer hover:bg-[#323234] active:bg-[#3A3A3C]'
              }`}
            >
              {/* Subtle #30D158 emerald border glow overlay */}
              <motion.div
                key={`pulse-${pulseCount}`}
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
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => void handleManualCopy()}
              whileTap={isFetchingIsrc ? undefined : { scale: 0.97 }}
              transition={SPRING_BUTTON}
              tabIndex={isOpen ? 0 : -1}
              className={`flex min-h-[50px] w-full items-center justify-center overflow-hidden rounded-[14px] px-5 text-[16px] font-semibold tracking-[-0.01em] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none ${
                isFetchingIsrc
                  ? 'cursor-wait bg-white text-black opacity-60'
                  : copiedState
                    ? 'cursor-pointer bg-[#30D158] text-black'
                    : 'cursor-pointer bg-white text-black active:bg-[#2C2C2E] active:text-white'
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
          <div className="mt-5 space-y-3">
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
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => activeTrack && onSearchOtherVersions(activeTrack)}
              whileTap={{ scale: 0.97 }}
              transition={SPRING_BUTTON}
              tabIndex={isOpen ? 0 : -1}
              className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#2C2C2E] px-5 text-[15px] font-semibold text-white active:bg-[#3A3A3C]"
            >
              <Search className="h-4 w-4" />
              <span>Search other versions</span>
            </motion.button>
          </div>
        )}

        {/* Collapsible "How to use on Instagram" card (zero layout-thrashing grid transitions) */}
        <div className="mt-4 rounded-[16px] border border-white/10 bg-[#2C2C2E]/65">
          <button
            type="button"
            onClick={handleToggleGuide}
            tabIndex={isOpen ? 0 : -1}
            aria-expanded={guideOpen}
            className="flex min-h-[46px] w-full cursor-pointer items-center justify-between rounded-[16px] px-4 py-2.5 text-left transition-transform duration-150 active:scale-[0.985] active:bg-[#2C2C2E]"
          >
            <span className="text-[14px] font-semibold text-white">
              How to use on Instagram
            </span>
            <ChevronDown
              className={`h-4 w-4 text-[#8E8E93] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                guideOpen ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>

          {guideOpen && (
            <div className="animate-card-in">
              <ol className="space-y-2.5 border-t border-white/10 px-4 pb-4 pt-3 text-[13px] leading-relaxed text-[#D1D1D6]">
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold tabular-nums text-white">
                    1
                  </span>
                  <span>
                    Open Instagram and tap the <strong className="font-semibold text-white">Music</strong> sticker on a Story, Reel, or Note.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold tabular-nums text-white">
                    2
                  </span>
                  <span>
                    Paste <span className="font-mono-isrc text-white">{formattedIsrc || 'ISRC:XXXXXXXXXXXX'}</span> directly into the search bar.
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
          )}
        </div>

        {/* Matching Creator Footer inside Bottom Sheet */}
        <div className="mt-4 flex justify-center">
          <a
            href="https://instagram.com/enjay404"
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={isOpen ? 0 : -1}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-white/10 bg-[#2C2C2E]/65 px-3.5 py-1.5 text-[12px] text-[#AEAEB2] transition-[transform,color,background-color] duration-150 hover:bg-[#2C2C2E] hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
          >
            <span>Made with ❤️ by</span>
            <span className="font-medium text-white">@enjay404</span>
          </a>
        </div>
      </div>
    </div>
  );
});

export default BottomSheet;
