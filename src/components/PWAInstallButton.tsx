import { AnimatePresence, motion } from 'motion/react';
import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { SPRING_BUTTON } from '../utils/motionConfig';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    if (!showIOSGuide) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowIOSGuide(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showIOSGuide]);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <motion.button
        type="button"
        onClick={() => void install()}
        whileTap={{ scale: 0.97 }}
        transition={SPRING_BUTTON}
        className="liquid-glass flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium text-white active:bg-white/[0.12] whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5 text-[#30D158]" />
        <span>Install</span>
      </motion.button>
    );
  }

  if (isIOS) {
    const modalContent = (
      <AnimatePresence>
        {showIOSGuide && (
          <div
            className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Add TrackCode to Home Screen"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => setShowIOSGuide(false)}
              className="fixed inset-0 bg-black/80"
            />
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 28, scale: 0.98 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-w-[480px] rounded-t-[32px] border-t border-white/[0.14] bg-gradient-to-b from-[#232326] to-[#151517] px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-[0_-20px_50px_rgba(0,0,0,0.85)] sm:max-w-[400px] sm:rounded-[32px] sm:border sm:border-white/[0.14] sm:pt-5 sm:pb-6 sm:shadow-[0_20px_50px_rgba(0,0,0,0.85)]"
            >
              <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/20 sm:hidden" />

              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-white">
                  Add to Home Screen
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close"
                  className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/[0.08] text-[#AEAEB2] transition-[transform,background-color,color] duration-150 hover:bg-white/[0.14] hover:text-white active:scale-[0.94] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ol className="mt-4 space-y-3 text-[14px] leading-relaxed text-[#D1D1D6]">
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold tabular-nums text-white">
                    1
                  </span>
                  <span>
                    Tap the <Share className="inline h-3.5 w-3.5 text-[#0A84FF]" />{' '}
                    <strong className="font-semibold text-white">Share</strong> button in Safari&apos;s toolbar.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold tabular-nums text-white">
                    2
                  </span>
                  <span>
                    Scroll down and tap{' '}
                    <strong className="font-semibold text-white">Add to Home Screen</strong>.
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full cursor-pointer rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-black transition-transform duration-150 hover:bg-white/95 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );

    return (
      <>
        <motion.button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          whileTap={{ scale: 0.97 }}
          transition={SPRING_BUTTON}
          className="liquid-glass flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium text-white active:bg-white/[0.12] whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5 text-[#30D158]" />
          <span>Add App</span>
        </motion.button>

        {typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null}
      </>
    );
  }

  return null;
}
