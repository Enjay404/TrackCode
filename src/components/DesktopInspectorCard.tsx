import { AnimatePresence, motion } from 'motion/react';
import { Copy, Disc3, Search } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import type { TrackItem } from '../types/track';
import {
  ALBUM_TYPE_BADGE_STYLE,
  ALBUM_TYPE_LABEL,
  EXPLICIT_BADGE_STYLE,
} from '../utils/badgeStyles';
import { extractDominantColorRgb } from '../utils/dominantColor';
import { IOS_EASE, SPRING_BUTTON } from '../utils/motionConfig';
import { copyIsrcVerified, formatIsrcCode } from '../utils/spotifyInput';

interface DesktopInspectorCardProps {
  track: TrackItem | null;
  copiedSignal: number;
  isLoadingInitial?: boolean;
  onCopied: (isrc: string, copiedTrack?: TrackItem) => void;
  onCopyFailed?: () => void;
  onSearchOtherVersions: (track: TrackItem) => void;
}

const AUTO_COPY_RESET_MS = 750;
const MANUAL_COPY_RESET_MS = 1000;

export const DesktopInspectorCard = memo(function DesktopInspectorCard({
  track,
  copiedSignal,
  isLoadingInitial = false,
  onCopied,
  onCopyFailed,
  onSearchOtherVersions,
}: DesktopInspectorCardProps) {
  const artSrc = track?.albumArt.medium || track?.albumArt.large || null;
  const [glowRgb, setGlowRgb] = useState<string>('110, 110, 128');
  const [glowReady, setGlowReady] = useState(false);
  const [failedArtSrc, setFailedArtSrc] = useState<string | null>(null);
  const [copiedState, setCopiedState] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);

  const copyTimerRef = useRef<number | null>(null);
  const imgError = Boolean(artSrc && failedArtSrc === artSrc);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, []);

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

  useEffect(() => {
    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = null;
    }
    if (!track || !track.isrc || copiedSignal === 0) {
      setCopiedState(false);
      setPulseCount(0);
      return;
    }
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
  }, [track, copiedSignal]);

  const handleManualCopy = async () => {
    if (!track?.isrc) return;
    const ok = await copyIsrcVerified(track.isrc);
    if (ok) {
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

  const formattedIsrc = track.isrc ? formatIsrcCode(track.isrc) : null;

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

      {/* Track Header: w-24 h-24 cover art + title + artist + badges */}
      <div className="relative flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[#2C2C2E] shadow-[0_8px_24px_rgba(0,0,0,0.5)] ring-1 ring-white/10">
          {artSrc && !imgError ? (
            <img
              src={artSrc}
              alt={`${track.albumName || track.name} artwork`}
              width={96}
              height={96}
              referrerPolicy="no-referrer"
              decoding="async"
              onError={() => setFailedArtSrc(artSrc)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[#8E8E93]">
              <Disc3 className="h-9 w-9" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[20px] font-semibold leading-tight tracking-[-0.02em] text-white">
            {track.name}
          </h2>
          <p className="mt-1.5 inline-flex max-w-full items-center gap-1.5 text-[15px] text-[#AEAEB2]">
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
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[#8E8E93]">
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

      {/* Inset Dark-Glass Instagram Search Code + White Pill CTA */}
      {formattedIsrc ? (
        <div className="relative mt-5 space-y-3">
          <motion.button
            type="button"
            onClick={() => void handleManualCopy()}
            whileTap={{ scale: 0.985 }}
            transition={SPRING_BUTTON}
            aria-label={`Copy ${formattedIsrc}`}
            className="group relative flex w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] border border-white/10 bg-[#2C2C2E] px-4 py-3.5 text-left transition-colors duration-150 hover:bg-[#323234] active:bg-[#3A3A3C] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25"
          >
            <motion.div
              key={`desktop-pulse-${pulseCount}`}
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
              <div className="font-mono-isrc mt-0.5 select-all truncate text-[17px] font-semibold tracking-[0.02em] text-white">
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
            onClick={() => void handleManualCopy()}
            whileTap={{ scale: 0.97 }}
            transition={SPRING_BUTTON}
            className={`flex min-h-[50px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-[14px] px-5 text-[16px] font-semibold tracking-[-0.01em] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none ${
              copiedState
                ? 'bg-[#30D158] text-black'
                : 'bg-white text-black hover:bg-white/95 active:bg-[#2C2C2E] active:text-white'
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
          </motion.button>
        </div>
      ) : (
        <div className="relative mt-5 space-y-3">
          <div className="rounded-[14px] border border-[#FF9F0A]/30 bg-[#FF9F0A]/10 px-4 py-3.5">
            <p className="text-[14px] font-medium text-[#FF9F0A]">
              No ISRC available on this upload
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#AEAEB2]">
              No ISRC code was returned for this release. Try another version (single, deluxe, or explicit/clean edit).
            </p>
          </div>

          <button
            type="button"
            onClick={() => onSearchOtherVersions(track)}
            className="flex min-h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-[14px] bg-[#2C2C2E] px-5 text-[15px] font-semibold text-white transition-transform duration-150 hover:bg-[#343438] active:scale-[0.98]"
          >
            <Search className="h-4 w-4" />
            <span>Search other versions</span>
          </button>
        </div>
      )}

      {/* Always-Open 3-Step Instagram Guide on Desktop */}
      <div className="relative mt-5 rounded-[16px] border border-white/10 bg-[#2C2C2E]/55 px-4 py-3.5">
        <h3 className="text-[13.5px] font-semibold text-white">
          How to use on Instagram
        </h3>
        <ol className="mt-3 space-y-2.5 border-t border-white/10 pt-3 text-[13px] leading-relaxed text-[#D1D1D6]">
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
    </aside>
  );
});

export default DesktopInspectorCard;
