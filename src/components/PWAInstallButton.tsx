import { AnimatePresence, motion } from 'motion/react';
import { Download, Share, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

const SPRING_BUTTON = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30,
};

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

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
        className="liquid-glass flex min-h-[44px] items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium text-white active:bg-white/[0.12] whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5 text-[#30D158]" />
        <span>Install</span>
      </motion.button>
    );
  }

  if (isIOS) {
    return (
      <>
        <motion.button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          whileTap={{ scale: 0.97 }}
          transition={SPRING_BUTTON}
          className="liquid-glass flex min-h-[44px] items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium text-white active:bg-white/[0.12] whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5 text-[#30D158]" />
          <span>Add App</span>
        </motion.button>

        <AnimatePresence>
          {showIOSGuide && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
              role="dialog"
              aria-modal="true"
              aria-label="Add TrackCode to Home Screen"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowIOSGuide(false)}
                className="fixed inset-0 bg-black/65"
              />
              <motion.div
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.96 }}
                transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                className="relative z-10 m-4 w-full max-w-[360px] rounded-[24px] border border-white/10 bg-[#1C1C1E] p-5 shadow-2xl"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-[17px] font-semibold text-white">
                    Add to Home Screen
                  </h3>
                  <motion.button
                    type="button"
                    onClick={() => setShowIOSGuide(false)}
                    whileTap={{ scale: 0.97 }}
                    transition={SPRING_BUTTON}
                    aria-label="Close install guide"
                    className="flex h-11 w-11 items-center justify-center rounded-full text-[#8E8E93] active:bg-[#2C2C2E]"
                  >
                    <X className="h-4 w-4" />
                  </motion.button>
                </div>

                <ol className="mt-3 space-y-3 text-[14px] leading-relaxed text-[#D1D1D6]">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2C2C2E] text-[11px] font-semibold text-white">
                      1
                    </span>
                    <span>
                      Tap the <Share className="inline h-3.5 w-3.5 text-[#0A84FF]" /> <strong className="font-semibold text-white">Share</strong> button in Safari&apos;s toolbar.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2C2C2E] text-[11px] font-semibold text-white">
                      2
                    </span>
                    <span>
                      Scroll down and tap <strong className="font-semibold text-white">Add to Home Screen</strong>.
                    </span>
                  </li>
                </ol>

                <motion.button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING_BUTTON}
                  className="mt-5 flex min-h-[46px] w-full items-center justify-center rounded-[14px] bg-[#2C2C2E] text-[15px] font-semibold text-white active:bg-[#3A3A3C]"
                >
                  Done
                </motion.button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return null;
}
