import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Copy, Disc3, Search, X } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import type { TrackItem } from '../types/track';
import {
  ALBUM_TYPE_BADGE_STYLE,
  ALBUM_TYPE_LABEL,
  EXPLICIT_BADGE_STYLE,
} from '../utils/badgeStyles';
import { extractDominantColorRgb } from '../utils/dominantColor';
import {
  formatIsrcCode,
  loadGuideExpandedPreference,
  saveGuideExpandedPreference,
  syncCopyIsrc,
} from '../utils/spotifyInput';

interface BottomSheetProps {
  track: TrackItem | null;
  autoCopiedSignal: number;
  onClose: () => void;
  onCopied: (isrc: string) => void;
  onSearchOtherVersions: (track: TrackItem) => void;
}

const SPRING_BUTTON = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30,
};

const IOS_EASE = [0.22, 1, 0.36, 1] as const;
const SHEET_DURATION_MS = 280;
const AUTO_COPY_RESET_MS = 950;
const MANUAL_COPY_RESET_MS = 1000;

export const BottomSheet = memo(function BottomSheet({
  track,
  autoCopiedSignal,
  onClose,
  onCopied,
  onSearchOtherVersions,
}: BottomSheetProps) {
  const [lastTrack, setLastTrack] = useState<TrackItem | null>(track);
  if (track && track !== lastTrack) {
    setLastTrack(track);
  }

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
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

  // Defer dominant color extraction until after the 280ms GPU slide-up finishes
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

  const handleManualCopy = () => {
    if (!activeTrack?.isrc) return;
    const ok = syncCopyIsrc(activeTrack.isrc);
    if (ok) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      setCopiedState(true);
      setPulseCount((c) => c + 1);
      onCopied(activeTrack.isrc);
      copyTimerRef.current = window.setTimeout(() => {
        copyTimerRef.current = null;
        setCopiedState(false);
      }, MANUAL_COPY_RESET_MS);
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

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center"
      role="dialog"
      aria-modal={isOpen}
      aria-hidden={!isOpen}
      aria-label={activeTrack?.name || 'Track details'}
      style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
    >
      {/* Pre-mounted modal dimming overlay (zero backdrop-filter) */}
      <div
        onClick={isOpen ? onClose : undefined}
        className="fixed inset-0 bg-black/65"
        style={{
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden',
          pointerEvents: isOpen ? 'auto' : 'none',
          willChange: 'opacity',
          backfaceVisibility: 'hidden',
          contain: 'strict',
          transition: isOpen
            ? `opacity ${SHEET_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), visibility 0s linear 0ms`
            : `opacity ${SHEET_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), visibility 0s linear ${SHEET_DURATION_MS}ms`,
        }}
      />

      {/* Permanently mounted warm GPU bottom sheet */}
      <div
        ref={sheetRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{
          transform: isOpen ? 'translate3d(0, 0, 0)' : 'translate3d(0, 105%, 0)',
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden',
          pointerEvents: isOpen ? 'auto' : 'none',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          background: 'rgba(28, 28, 30, 0.88)',
          backdropFilter: 'blur(12px) saturate(180%)',
          WebkitBackdropFilter: 'blur(12px) saturate(180%)',
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden',
          contain: 'layout style paint',
          touchAction: 'pan-x',
          transition: isOpen
            ? `transform ${SHEET_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms cubic-bezier(0.22, 1, 0.36, 1), visibility 0s linear 0ms`
            : `transform ${SHEET_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms cubic-bezier(0.22, 1, 0.36, 1), visibility 0s linear ${SHEET_DURATION_MS}ms`,
        }}
        className="relative z-10 w-full max-w-[480px] overflow-hidden rounded-t-[28px] border-t border-white/10 px-5 pt-2.5 shadow-[0_-16px_48px_rgba(0,0,0,0.75)]"
      >
        {/* Ambient radial glow tinted with album cover dominant color */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full transition-opacity duration-400 ease-out"
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
        {formattedIsrc ? (
          <div className="mt-5 space-y-3">
            <motion.button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleManualCopy}
              whileTap={{ scale: 0.985 }}
              transition={SPRING_BUTTON}
              tabIndex={isOpen ? 0 : -1}
              aria-label={`Copy ${formattedIsrc}`}
              className="group relative flex w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-white/10 bg-[#2C2C2E] px-4 py-3.5 text-left transition-colors duration-150 hover:bg-[#323234] active:bg-[#3A3A3C] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25"
            >
              {/* Subtle GPU-composited #30D158 emerald border glow overlay */}
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
              <div className="min-w-0">
                <div className="text-[11px] font-medium tracking-wide text-[#8E8E93]">
                  Instagram Search Code
                </div>
                <div className="font-mono-isrc mt-0.5 truncate text-[17px] font-semibold tracking-[0.02em] text-white">
                  {formattedIsrc}
                </div>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[#8E8E93] transition-colors duration-150 group-hover:text-white">
                <Copy
                  className={`h-4 w-4 transition-colors duration-150 ${
                    copiedState ? 'text-[#30D158]' : ''
                  }`}
                />
              </span>
            </motion.button>

            <motion.button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleManualCopy}
              whileTap={{ scale: 0.97 }}
              transition={SPRING_BUTTON}
              tabIndex={isOpen ? 0 : -1}
              className={`flex min-h-[50px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-[14px] px-5 text-[16px] font-semibold tracking-[-0.01em] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none ${
                copiedState
                  ? 'bg-[#30D158] text-black'
                  : 'bg-white text-black active:bg-[#2C2C2E] active:text-white'
              }`}
            >
              <AnimatePresence mode="wait" initial={false}>
                {copiedState ? (
                  <motion.span
                    key="copied"
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ duration: 0.16, ease: IOS_EASE }}
                    style={{ willChange: 'transform, opacity' }}
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
                    style={{ willChange: 'transform, opacity' }}
                    className="inline-flex items-center justify-center gap-2"
                  >
                    <Copy className="h-4 w-4 stroke-[2.2]" />
                    <span>Copy ISRC</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <div className="rounded-[14px] border border-[#FF9F0A]/30 bg-[#FF9F0A]/10 px-4 py-3.5">
              <p className="text-[14px] font-medium text-[#FF9F0A]">
                No ISRC available on this upload
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#AEAEB2]">
                Spotify did not return an ISRC code for this release. Try another version (single, deluxe, or explicit/clean edit).
              </p>
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

        {/* Collapsible "How to use on Instagram" card */}
        <div className="mt-4 rounded-[16px] border border-white/10 bg-[#2C2C2E]/65">
          <motion.button
            type="button"
            onClick={handleToggleGuide}
            whileTap={{ scale: 0.97 }}
            transition={SPRING_BUTTON}
            tabIndex={isOpen ? 0 : -1}
            aria-expanded={guideOpen}
            className="flex min-h-[46px] w-full items-center justify-between rounded-[16px] px-4 py-2.5 text-left active:bg-[#2C2C2E]"
          >
            <span className="text-[14px] font-semibold text-white">
              How to use on Instagram
            </span>
            <motion.span
              animate={{ rotate: guideOpen ? 180 : 0 }}
              transition={{ duration: 0.22, ease: IOS_EASE }}
              className="text-[#8E8E93]"
            >
              <ChevronDown className="h-4 w-4" />
            </motion.span>
          </motion.button>

          <div
            aria-hidden={!guideOpen}
            className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              guideOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr] pointer-events-none'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div
                className={`transition-[opacity,transform] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  guideOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1.5'
                }`}
                style={{ willChange: 'transform, opacity' }}
              >
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
            </div>
          </div>
        </div>

        {/* Matching Creator Footer inside Bottom Sheet */}
        <div className="mt-4 flex justify-center">
          <motion.a
            href="https://instagram.com/enjay404"
            target="_blank"
            rel="noopener noreferrer"
            whileTap={{ scale: 0.96 }}
            transition={SPRING_BUTTON}
            tabIndex={isOpen ? 0 : -1}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/10 bg-[#2C2C2E]/65 px-3.5 py-1.5 text-[12px] text-[#AEAEB2] transition-colors hover:bg-[#2C2C2E] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
          >
            <span>Made with ❤️ by</span>
            <span className="font-medium text-white">@enjay404</span>
          </motion.a>
        </div>
      </div>
    </div>
  );
});
