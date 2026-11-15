import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { memo, useEffect, useRef, useState } from 'react';
import type { TrackItem } from '../types/track';
import { extractDominantColorRgb } from '../utils/dominantColor';
import { SPRING_BUTTON } from '../utils/motionConfig';
import { IsrcInspector } from './IsrcInspector';

interface BottomSheetProps {
  track: TrackItem | null;
  autoCopiedSignal: number;
  isFetchingIsrc?: boolean;
  previewUrl?: string | null;
  isAudioPlaying?: boolean;
  isAudioLoading?: boolean;
  audioProgress?: number;
  getAudioGainMultiplier?: () => number;
  onTogglePreview?: () => void;
  onClose: () => void;
  onCopied: (isrc: string, copiedTrack?: TrackItem) => void;
  onCopyFailed?: () => void;
  onSearchOtherVersions: (track: TrackItem) => void;
}

const SHEET_DURATION_MS = 250;

export const BottomSheet = memo(function BottomSheet({
  track,
  autoCopiedSignal,
  isFetchingIsrc = false,
  previewUrl = null,
  isAudioPlaying = false,
  isAudioLoading = false,
  audioProgress = 0,
  getAudioGainMultiplier,
  onTogglePreview,
  onClose,
  onCopied,
  onCopyFailed,
  onSearchOtherVersions,
}: BottomSheetProps) {
  const [lastTrack, setLastTrack] = useState<TrackItem | null>(track);
  const isOpen = track !== null;
  const activeTrack = track ?? lastTrack;

  const [glowRgb, setGlowRgb] = useState<string>('110, 110, 128');
  const [glowReady, setGlowReady] = useState(false);

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

        {activeTrack && (
          <IsrcInspector
            variant="mobile"
            track={activeTrack}
            copiedSignal={autoCopiedSignal}
            isActive={isOpen}
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
        )}

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
