import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

const SHEET_OPEN_MS = 280;
const SHEET_CLOSE_MS = 250;
const SHEET_CLOSE_FALLBACK_MS = 260;
const SHEET_SNAP_MS = 360;

interface BottomSheetPanelProps extends Omit<BottomSheetProps, 'track'> {
  track: TrackItem;
}

const BottomSheetPanel = memo(function BottomSheetPanel({
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
}: BottomSheetPanelProps) {
  const [glowRgb, setGlowRgb] = useState<string>('110, 110, 128');
  const [glowReady, setGlowReady] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLDivElement>(null);
  const grabHandleRef = useRef<HTMLDivElement>(null);
  const grabPillRef = useRef<HTMLDivElement>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isClosingRef = useRef(false);
  const closeCleanupRef = useRef<(() => void) | null>(null);
  const snapCleanupRef = useRef<(() => void) | null>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  const gestureRef = useRef<{
    startY: number;
    lastY: number;
    lastTime: number;
    latestY: number;
    latestTime: number;
    currentTranslateY: number;
    isDragging: boolean;
    hasMoved: boolean;
    startedOnGrabHandle: boolean;
    rafId: number | null;
  }>({
    startY: 0,
    lastY: 0,
    lastTime: 0,
    latestY: 0,
    latestTime: 0,
    currentTranslateY: 0,
    isDragging: false,
    hasMoved: false,
    startedOnGrabHandle: false,
    rafId: null,
  });

  const clearPendingRaf = useCallback(() => {
    const g = gestureRef.current;
    if (g.rafId !== null) {
      window.cancelAnimationFrame(g.rafId);
      g.rafId = null;
    }
  }, []);

  const dismissWithAnimation = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    gestureRef.current.isDragging = false;
    clearPendingRaf();
    snapCleanupRef.current?.();
    snapCleanupRef.current = null;

    if (grabPillRef.current) {
      grabPillRef.current.style.backgroundColor = '';
    }

    const sheetEl = sheetRef.current;
    const backdropEl = backdropRef.current;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!sheetEl || prefersReducedMotion) {
      onCloseRef.current();
      return;
    }

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      closeCleanupRef.current?.();
      closeCleanupRef.current = null;
      onCloseRef.current();
    };

    const handleTransitionEnd = (e: TransitionEvent) => {
      if (e.target === sheetEl && e.propertyName === 'transform') {
        finish();
      }
    };

    sheetEl.addEventListener('transitionend', handleTransitionEnd);
    const fallbackTimer = window.setTimeout(finish, SHEET_CLOSE_FALLBACK_MS);

    closeCleanupRef.current = () => {
      sheetEl.removeEventListener('transitionend', handleTransitionEnd);
      window.clearTimeout(fallbackTimer);
    };

    if (backdropEl) {
      backdropEl.style.transition = 'opacity 220ms ease-out';
      backdropEl.style.opacity = '0';
    }
    sheetEl.style.transition = `transform ${SHEET_CLOSE_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`;
    sheetEl.style.transform = 'translate3d(0, 100%, 0)';
  }, [clearPendingRaf]);

  const snapBackWithSpring = useCallback(() => {
    const sheetEl = sheetRef.current;
    const backdropEl = backdropRef.current;
    if (!sheetEl) return;

    snapCleanupRef.current?.();
    snapCleanupRef.current = null;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      sheetEl.style.transition = 'none';
      sheetEl.style.transform = 'translate3d(0, 0, 0)';
      if (backdropEl) {
        backdropEl.style.transition = 'none';
        backdropEl.style.opacity = '1';
      }
      gestureRef.current.currentTranslateY = 0;
      return;
    }

    let settled = false;
    const clearTransitions = () => {
      if (settled) return;
      settled = true;
      snapCleanupRef.current?.();
      snapCleanupRef.current = null;
      if (sheetRef.current && !gestureRef.current.isDragging && !isClosingRef.current) {
        sheetRef.current.style.transition = '';
      }
      if (backdropRef.current && !gestureRef.current.isDragging && !isClosingRef.current) {
        backdropRef.current.style.transition = '';
      }
    };

    const handleTransitionEnd = (e: TransitionEvent) => {
      if (e.target === sheetEl && e.propertyName === 'transform') {
        clearTransitions();
      }
    };

    sheetEl.addEventListener('transitionend', handleTransitionEnd);
    const fallbackTimer = window.setTimeout(clearTransitions, SHEET_SNAP_MS + 20);

    snapCleanupRef.current = () => {
      sheetEl.removeEventListener('transitionend', handleTransitionEnd);
      window.clearTimeout(fallbackTimer);
    };

    sheetEl.style.transition = `transform ${SHEET_SNAP_MS}ms cubic-bezier(0.22, 1.18, 0.36, 1)`;
    sheetEl.style.transform = 'translate3d(0, 0, 0)';
    if (backdropEl) {
      backdropEl.style.transition = 'opacity 240ms ease-out';
      backdropEl.style.opacity = '1';
    }
    gestureRef.current.currentTranslateY = 0;
  }, []);

  // Mount at translate3d(0, 100%, 0) + opacity: 0, then glide up on next animation frame
  useLayoutEffect(() => {
    const sheetEl = sheetRef.current;
    const backdropEl = backdropRef.current;
    if (!sheetEl) return;

    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl && activeEl.tagName !== 'INPUT' && activeEl.tagName !== 'TEXTAREA') {
      triggerElementRef.current = activeEl;
    } else {
      triggerElementRef.current = null;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      sheetEl.style.transition = 'none';
      sheetEl.style.transform = 'translate3d(0, 0, 0)';
      if (backdropEl) {
        backdropEl.style.transition = 'none';
        backdropEl.style.opacity = '1';
      }
      return;
    }

    sheetEl.style.transition = 'none';
    sheetEl.style.transform = 'translate3d(0, 100%, 0)';
    if (backdropEl) {
      backdropEl.style.transition = 'none';
      backdropEl.style.opacity = '0';
    }

    let raf2: number | null = null;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        if (isClosingRef.current) return;
        if (backdropRef.current) {
          backdropRef.current.style.transition = 'opacity 240ms ease-out';
          backdropRef.current.style.opacity = '1';
        }
        if (sheetRef.current) {
          sheetRef.current.style.transition = `transform ${SHEET_OPEN_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
          sheetRef.current.style.transform = 'translate3d(0, 0, 0)';
        }
      });
    });

    const settleTimer = window.setTimeout(() => {
      if (!gestureRef.current.isDragging && !isClosingRef.current) {
        if (sheetRef.current) sheetRef.current.style.transition = '';
        if (backdropRef.current) backdropRef.current.style.transition = '';
      }
    }, SHEET_OPEN_MS + 30);

    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2 !== null) window.cancelAnimationFrame(raf2);
      window.clearTimeout(settleTimer);
    };
  }, []);

  // Body scroll lock, Escape dismiss, and focus restoration
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissWithAnimation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      clearPendingRaf();
      closeCleanupRef.current?.();
      snapCleanupRef.current?.();

      const prevTrigger = triggerElementRef.current;
      triggerElementRef.current = null;
      if (prevTrigger && typeof prevTrigger.focus === 'function' && document.contains(prevTrigger)) {
        window.setTimeout(() => {
          prevTrigger.focus({ preventScroll: true });
        }, 20);
      }
    };
  }, [clearPendingRaf, dismissWithAnimation]);

  // Extract album art dominant glow after sheet slide-up completes
  useEffect(() => {
    let cancelled = false;
    setGlowReady(false);
    const targetArtUrl = track.albumArt.medium || track.albumArt.large;
    const deferTimer = window.setTimeout(() => {
      void extractDominantColorRgb(targetArtUrl).then((rgb) => {
        if (!cancelled) {
          setGlowRgb(rgb);
          setGlowReady(true);
        }
      });
    }, SHEET_OPEN_MS + 20);

    return () => {
      cancelled = true;
      window.clearTimeout(deferTimer);
    };
  }, [track.albumArt.medium, track.albumArt.large]);

  // Zero-re-render 1:1 GPU touch gesture recognizer (with non-passive touchmove)
  useEffect(() => {
    const sheetEl = sheetRef.current;
    if (!sheetEl) return;

    const startDragAt = (clientY: number, target: EventTarget | null) => {
      if (isClosingRef.current) return;
      if (target instanceof HTMLElement && target.closest('[data-sheet-close="true"]')) {
        return;
      }

      clearPendingRaf();
      snapCleanupRef.current?.();
      snapCleanupRef.current = null;

      let initialOffsetY = 0;
      const computedTransform = window.getComputedStyle(sheetEl).transform;
      if (computedTransform && computedTransform !== 'none') {
        const matrix = new DOMMatrixReadOnly(computedTransform);
        if (Number.isFinite(matrix.m42)) {
          initialOffsetY = matrix.m42;
        }
      }

      sheetEl.style.transition = 'none';
      sheetEl.style.transform = `translate3d(0, ${initialOffsetY}px, 0)`;

      const backdropEl = backdropRef.current;
      if (backdropEl) {
        const computedOpacity = window.getComputedStyle(backdropEl).opacity;
        backdropEl.style.transition = 'none';
        backdropEl.style.opacity = computedOpacity || '1';
      }

      const now = performance.now();
      const g = gestureRef.current;
      g.startY = clientY - initialOffsetY;
      g.lastY = clientY;
      g.lastTime = now;
      g.latestY = clientY;
      g.latestTime = now;
      g.currentTranslateY = initialOffsetY;
      g.isDragging = true;
      g.hasMoved = Math.abs(initialOffsetY) > 1;
      g.startedOnGrabHandle = Boolean(
        grabHandleRef.current && target instanceof Node && grabHandleRef.current.contains(target)
      );

      if (g.startedOnGrabHandle && grabPillRef.current) {
        grabPillRef.current.style.backgroundColor = 'rgba(255, 255, 255, 0.45)';
      }
    };

    const scheduleFrame = (translateY: number) => {
      clearPendingRaf();
      gestureRef.current.rafId = window.requestAnimationFrame(() => {
        gestureRef.current.rafId = null;
        if (!sheetRef.current || isClosingRef.current) return;
        sheetRef.current.style.transform = `translate3d(0, ${translateY}px, 0)`;
        if (backdropRef.current) {
          backdropRef.current.style.opacity =
            translateY >= 0 ? String(Math.max(0.2, 1 - translateY / 380)) : '1';
        }
      });
    };

    const finishDrag = () => {
      if (grabPillRef.current) {
        grabPillRef.current.style.backgroundColor = '';
      }

      const g = gestureRef.current;
      if (!g.isDragging) return;
      g.isDragging = false;
      clearPendingRaf();

      if (isClosingRef.current) return;

      if (!g.hasMoved) {
        sheetEl.style.transition = '';
        if (backdropRef.current) {
          backdropRef.current.style.transition = '';
        }
        return;
      }

      const now = performance.now();
      const timeSinceLastMove = now - g.latestTime;
      const vy =
        timeSinceLastMove > 80
          ? 0
          : (g.latestY - g.lastY) / Math.max(now - g.lastTime, 1);

      if (g.currentTranslateY > 110 || (g.currentTranslateY > 36 && vy > 0.45)) {
        dismissWithAnimation();
      } else {
        snapBackWithSpring();
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startDragAt(e.touches[0].clientY, e.target);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (!g.isDragging || isClosingRef.current || e.touches.length !== 1) return;

      const touchY = e.touches[0].clientY;
      const deltaY = touchY - g.startY;
      const scrollEl = scrollContentRef.current;
      const scrollTop = scrollEl ? scrollEl.scrollTop : 0;
      const hasInnerScroll = scrollEl
        ? scrollEl.scrollHeight > scrollEl.clientHeight + 1
        : false;

      if (scrollTop > 0 && !g.startedOnGrabHandle && !g.hasMoved) {
        g.isDragging = false;
        return;
      }

      // Let overflowing inner content scroll naturally on very short viewports when dragging up from inside
      if (deltaY < 0 && hasInnerScroll && !g.startedOnGrabHandle && !g.hasMoved) {
        g.isDragging = false;
        return;
      }

      if ((deltaY > 0 || deltaY < 0) && (scrollTop <= 0 || g.startedOnGrabHandle)) {
        e.preventDefault();
      }

      // Keep small tap jitter (< 3px) from cancelling button taps
      if (!g.hasMoved && Math.abs(deltaY) < 3) {
        return;
      }

      const now = performance.now();
      if (now - g.latestTime >= 16) {
        g.lastY = g.latestY;
        g.lastTime = g.latestTime;
      }
      g.latestY = touchY;
      g.latestTime = now;
      g.hasMoved = true;

      const translateY = deltaY >= 0 ? deltaY : -Math.pow(Math.abs(deltaY), 0.72);
      g.currentTranslateY = translateY;
      scheduleFrame(translateY);
    };

    const handleTouchEnd = () => {
      finishDrag();
    };

    // Mouse-only pointer fallback for desktop narrow-window testing
    let mousePointerId: number | null = null;
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      if (e.target instanceof HTMLElement && e.target.closest('button, a')) return;
      mousePointerId = e.pointerId;
      startDragAt(e.clientY, e.target);
      try {
        sheetEl.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if capture is unavailable
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || mousePointerId !== e.pointerId) return;
      const g = gestureRef.current;
      if (!g.isDragging || isClosingRef.current) return;

      const deltaY = e.clientY - g.startY;
      if (!g.hasMoved && Math.abs(deltaY) < 3) return;

      const now = performance.now();
      if (now - g.latestTime >= 16) {
        g.lastY = g.latestY;
        g.lastTime = g.latestTime;
      }
      g.latestY = e.clientY;
      g.latestTime = now;
      g.hasMoved = true;

      const translateY = deltaY >= 0 ? deltaY : -Math.pow(Math.abs(deltaY), 0.72);
      g.currentTranslateY = translateY;
      scheduleFrame(translateY);
    };

    const handlePointerEnd = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || mousePointerId !== e.pointerId) return;
      mousePointerId = null;
      if (sheetEl.hasPointerCapture(e.pointerId)) {
        sheetEl.releasePointerCapture(e.pointerId);
      }
      finishDrag();
    };

    sheetEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    sheetEl.addEventListener('touchmove', handleTouchMove, { passive: false });
    sheetEl.addEventListener('touchend', handleTouchEnd, { passive: true });
    sheetEl.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    sheetEl.addEventListener('pointerdown', handlePointerDown);
    sheetEl.addEventListener('pointermove', handlePointerMove);
    sheetEl.addEventListener('pointerup', handlePointerEnd);
    sheetEl.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      sheetEl.removeEventListener('touchstart', handleTouchStart);
      sheetEl.removeEventListener('touchmove', handleTouchMove);
      sheetEl.removeEventListener('touchend', handleTouchEnd);
      sheetEl.removeEventListener('touchcancel', handleTouchEnd);
      sheetEl.removeEventListener('pointerdown', handlePointerDown);
      sheetEl.removeEventListener('pointermove', handlePointerMove);
      sheetEl.removeEventListener('pointerup', handlePointerEnd);
      sheetEl.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [clearPendingRaf, dismissWithAnimation, snapBackWithSpring]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={track.name || 'Track details'}
    >
      {/* Translucent modal backdrop (zero backdrop-filter) */}
      <div
        ref={backdropRef}
        onClick={dismissWithAnimation}
        className="fixed inset-0 bg-black/75"
      />

      {/* GPU-composited #1C1C1E bottom sheet */}
      <div
        ref={sheetRef}
        style={{
          backfaceVisibility: 'hidden',
          paddingBottom: 'calc(max(24px, env(safe-area-inset-bottom)) + 48px)',
          marginBottom: '-48px',
          backgroundColor: '#1C1C1E',
          backgroundImage:
            'linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, rgba(28, 28, 30, 0) 32%)',
          borderTop: '1px solid rgba(255, 255, 255, 0.14)',
        }}
        className="relative z-10 w-full max-w-[480px] will-change-transform overflow-hidden rounded-t-[28px] px-5 pt-0 shadow-[0_-16px_48px_rgba(0,0,0,0.75)]"
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

        {/* Tactile grab handle + dismiss icon */}
        <div className="relative z-20 flex items-center justify-center pb-1.5">
          <div
            ref={grabHandleRef}
            className="group flex w-32 touch-none cursor-grab justify-center pt-3 pb-2.5 active:cursor-grabbing"
          >
            <div
              ref={grabPillRef}
              className="h-1 w-9 rounded-full bg-white/25 transition-colors duration-150 group-active:bg-white/45"
            />
          </div>
          <motion.button
            type="button"
            data-sheet-close="true"
            onClick={(e) => {
              e.stopPropagation();
              dismissWithAnimation();
            }}
            whileTap={{ scale: 0.94 }}
            transition={SPRING_BUTTON}
            aria-label="Close track details"
            className="absolute right-0 top-1.5 z-20 flex h-11 w-11 touch-manipulation cursor-pointer items-center justify-center rounded-full text-[#8E8E93] active:bg-[#2C2C2E] focus-visible:outline-none"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2C2C2E] text-[#AEAEB2]">
              <X className="h-4 w-4" />
            </span>
          </motion.button>
        </div>

        <div
          ref={scrollContentRef}
          className="max-h-[calc(88dvh-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain"
        >
          <IsrcInspector
            variant="mobile"
            track={track}
            copiedSignal={autoCopiedSignal}
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

          {/* Matching Creator Footer inside Bottom Sheet */}
          <div className="mt-4 flex justify-center">
            <a
              href="https://instagram.com/enjay404"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] touch-manipulation items-center gap-1.5 rounded-full border border-white/10 bg-[#2C2C2E]/65 px-3.5 py-1.5 text-[12px] text-[#AEAEB2] transition-[transform,color,background-color] duration-150 hover:bg-[#2C2C2E] hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
            >
              <span>Made with ❤️ by</span>
              <span className="font-medium text-white">@enjay404</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
});

export const BottomSheet = memo(function BottomSheet({
  track,
  ...rest
}: BottomSheetProps) {
  if (!track) {
    return null;
  }

  return <BottomSheetPanel track={track} {...rest} />;
});

export default BottomSheet;
