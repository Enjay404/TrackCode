import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { ChevronDown, Copy, Disc3, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

const IOS_EASE = [0.32, 0.72, 0, 1] as const;

export function BottomSheet({
  track,
  autoCopiedSignal,
  onClose,
  onCopied,
  onSearchOtherVersions,
}: BottomSheetProps) {
  const [glowRgb, setGlowRgb] = useState<string>('110, 110, 128');
  const [glowReady, setGlowReady] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [copiedState, setCopiedState] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);
  const [guideOpen, setGuideOpen] = useState<boolean>(() => loadGuideExpandedPreference());
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!track) return;
    setImgError(false);
    setGlowReady(false);

    let cancelled = false;
    const artUrl = track.albumArt.large || track.albumArt.medium;
    void extractDominantColorRgb(artUrl).then((rgb) => {
      if (!cancelled) {
        setGlowRgb(rgb);
        setGlowReady(true);
      }
    });

    return () => {
      cancelled = true;
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
    }, 420);
    copyTimerRef.current = window.setTimeout(() => {
      setCopiedState(false);
    }, 2600);
    return () => {
      window.clearTimeout(glowDelayTimer);
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, [track, autoCopiedSignal]);

  useEffect(() => {
    if (!track) return;
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
  }, [track, onClose]);

  const handleManualCopy = () => {
    if (!track?.isrc) return;
    const ok = syncCopyIsrc(track.isrc);
    if (ok) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
      }
      setCopiedState(true);
      setPulseCount((c) => c + 1);
      onCopied(track.isrc);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedState(false);
      }, 2600);
    }
  };

  const handleToggleGuide = () => {
    setGuideOpen((prev) => {
      const next = !prev;
      saveGuideExpandedPreference(next);
      return next;
    });
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 88 || info.velocity.y > 420) {
      onClose();
    }
  };

  const formattedIsrc = track?.isrc ? formatIsrcCode(track.isrc) : null;
  const artSrc = track?.albumArt.large || track?.albumArt.medium || null;

  return (
    <AnimatePresence>
      {track && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label={track.name}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.38, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-black/65"
          />

          <motion.div
            key={track.id}
            initial={{ y: '100%' }}
            animate={{
              y: 0,
              transition: {
                type: 'spring',
                stiffness: 240,
                damping: 30,
                mass: 1.15,
              },
            }}
            exit={{
              y: '100%',
              transition: {
                duration: 0.44,
                ease: [0.22, 1, 0.36, 1],
              },
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.45 }}
            onDragEnd={handleDragEnd}
            style={{
              paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
              willChange: 'transform',
            }}
            className="relative z-10 w-full max-w-[480px] overflow-hidden rounded-t-[28px] border-t border-white/10 bg-[#1C1C1E] px-5 pt-2.5 shadow-[0_-16px_48px_rgba(0,0,0,0.75)]"
          >
            {/* Ambient radial glow tinted with album cover dominant color */}
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: glowReady ? 0.3 : 0.12 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full"
              style={{
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
                aria-label="Close track details"
                className="absolute right-0 top-[-2px] z-20 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-[#8E8E93] active:bg-[#2C2C2E] focus-visible:outline-none"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2C2C2E] text-[#AEAEB2]">
                  <X className="h-4 w-4" />
                </span>
              </motion.button>
            </div>

            {/* Track header: 88x88 cover art + title + artist */}
            <div className="relative flex items-center gap-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.28, ease: IOS_EASE }}
                className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[14px] bg-[#2C2C2E] shadow-[0_8px_24px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
              >
                {artSrc && !imgError ? (
                  <img
                    src={artSrc}
                    alt={`${track.albumName || track.name} artwork`}
                    referrerPolicy="no-referrer"
                    decoding="async"
                    fetchPriority="high"
                    onError={() => setImgError(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#8E8E93]">
                    <Disc3 className="h-8 w-8" />
                  </div>
                )}
              </motion.div>

              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-2 text-[19px] font-semibold leading-tight tracking-[-0.02em] text-white">
                  {track.name}
                </h2>
                <p className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[15px] text-[#AEAEB2]">
                  <span className="truncate">{track.artists}</span>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-label="Verified"
                    className="h-[15px] w-[15px] shrink-0"
                  >
                    <rect
                      x="3"
                      y="3"
                      width="18"
                      height="18"
                      rx="4.2"
                      fill="#0095F6"
                    />
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
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-[#8E8E93]">
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
                      duration: 1.5,
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
                  className={`flex min-h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] px-5 text-[16px] font-semibold tracking-[-0.01em] transition-colors duration-150 focus-visible:outline-none ${
                    copiedState
                      ? 'bg-[#30D158] text-black'
                      : 'bg-white text-black active:bg-[#2C2C2E] active:text-white'
                  }`}
                >
                  {copiedState ? (
                    <>
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
                          transition={{ duration: 0.24, ease: 'easeOut' }}
                        />
                      </svg>
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 stroke-[2.2]" />
                      <span>Copy ISRC</span>
                    </>
                  )}
                </motion.button>

                <AnimatePresence initial={false}>
                  {copiedState && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -4 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -4 }}
                      transition={{ duration: 0.24, ease: IOS_EASE }}
                      className="overflow-hidden"
                    >
                      <div className="flex justify-center pt-0.5">
                        <a
                          href="https://ko-fi.com/enjay404"
                          target="_blank"
                          rel="noopener noreferrer"
                          onPointerDown={(e) => e.stopPropagation()}
                          className="group inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 text-[13px] font-normal text-[#8E8E93] transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
                        >
                          <span>Posted your Story? Buy me a Ko-fi</span>
                          <span
                            aria-hidden="true"
                            className="text-[#FF9F0A] drop-shadow-[0_0_6px_rgba(255,159,10,0.38)] transition-all duration-150 group-hover:text-[#30D158] group-hover:drop-shadow-[0_0_8px_rgba(48,209,88,0.5)]"
                          >
                            ☕
                          </span>
                        </a>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
                  onClick={() => onSearchOtherVersions(track)}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING_BUTTON}
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
                aria-expanded={guideOpen}
                className="flex min-h-[46px] w-full items-center justify-between px-4 py-2.5 text-left active:bg-[#2C2C2E] rounded-[16px]"
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

              <AnimatePresence initial={false}>
                {guideOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.24, ease: IOS_EASE }}
                    className="overflow-hidden"
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Matching Creator Footer inside Bottom Sheet */}
            <div className="mt-4 flex justify-center">
              <motion.a
                href="https://instagram.com/enjay404"
                target="_blank"
                rel="noopener noreferrer"
                whileTap={{ scale: 0.96 }}
                transition={SPRING_BUTTON}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-white/10 bg-[#2C2C2E]/65 px-3.5 py-1.5 text-[12px] text-[#AEAEB2] transition-colors hover:bg-[#2C2C2E] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              >
                <span>Made with ❤️ by</span>
                <span className="font-medium text-white">@enjay404</span>
              </motion.a>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
