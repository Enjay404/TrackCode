import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { ChevronDown, Copy, Disc3, ExternalLink, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TrackItem } from '../types/track';
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
    if (!track || !track.isrc || autoCopiedSignal === 0) {
      setCopiedState(false);
      return;
    }
    setCopiedState(true);
    setPulseCount((c) => c + 1);
    const timer = window.setTimeout(() => {
      setCopiedState(false);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [track, autoCopiedSignal]);

  useEffect(() => {
    if (!track) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [track, onClose]);

  const handleManualCopy = () => {
    if (!track?.isrc) return;
    const ok = syncCopyIsrc(track.isrc);
    if (ok) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
      setCopiedState(true);
      setPulseCount((c) => c + 1);
      onCopied(track.isrc);
      window.setTimeout(() => {
        setCopiedState(false);
      }, 2200);
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
            <div className="relative flex items-center justify-center pb-4">
              <div className="h-[5px] w-9 rounded-full bg-white/25" />
              <motion.button
                type="button"
                onClick={onClose}
                whileTap={{ scale: 0.97 }}
                transition={SPRING_BUTTON}
                aria-label="Close track details"
                className="absolute right-0 top-[-2px] flex h-11 w-11 items-center justify-center rounded-full text-[#8E8E93] active:bg-[#2C2C2E] focus-visible:outline-none"
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
                <p className="mt-1 truncate text-[15px] text-[#AEAEB2]">
                  {track.artists}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px] text-[#8E8E93]">
                  <span className="uppercase tracking-wide font-semibold text-[#AEAEB2]">
                    {track.albumType}
                  </span>
                  {track.releaseYear && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{track.releaseYear}</span>
                    </>
                  )}
                  {track.explicit && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Explicit</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Monospace ISRC pill + Primary Copy Action */}
            {formattedIsrc ? (
              <div className="mt-5 space-y-3">
                <div className="relative flex items-center justify-between rounded-[14px] border border-white/10 bg-[#2C2C2E] px-4 py-3.5">
                  {/* Brief GPU-composited #30D158 border pulse overlay */}
                  <motion.div
                    key={`pulse-${pulseCount}`}
                    aria-hidden="true"
                    initial={pulseCount > 0 ? { opacity: 0.95, scale: 0.99 } : { opacity: 0 }}
                    animate={{ opacity: 0, scale: 1 }}
                    transition={{ duration: 0.65, ease: 'easeOut' }}
                    className="pointer-events-none absolute -inset-[1px] rounded-[14px] border-2 border-[#30D158]"
                  />
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium tracking-wide text-[#8E8E93]">
                      Instagram Search Code
                    </div>
                    <div className="font-mono-isrc mt-0.5 truncate text-[17px] font-semibold tracking-[0.02em] text-white">
                      {formattedIsrc}
                    </div>
                  </div>
                  <a
                    href={track.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open track in Spotify"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#8E8E93] transition-colors active:bg-white/10"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                <motion.button
                  type="button"
                  onClick={handleManualCopy}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING_BUTTON}
                  className={`flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[14px] px-5 text-[16px] font-semibold tracking-[-0.01em] transition-colors duration-150 focus-visible:outline-none ${
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
