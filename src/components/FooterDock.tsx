import { motion } from 'motion/react';
import { memo } from 'react';

const SPRING_BUTTON = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30,
};

export const FooterDock = memo(function FooterDock() {
  return (
    <footer
      className="fixed bottom-0 inset-x-0 z-20 flex justify-center pointer-events-none px-3 pt-6 pb-[max(14px,env(safe-area-inset-bottom))]"
      style={{
        contain: 'layout style',
        background:
          'linear-gradient(to top, rgba(0, 0, 0, 0.94) 40%, rgba(0, 0, 0, 0.6) 72%, rgba(0, 0, 0, 0) 100%)',
      }}
    >
      <div className="flex max-w-full items-center justify-center gap-2">
        <motion.a
          href="https://instagram.com/enjay404"
          target="_blank"
          rel="noopener noreferrer"
          whileTap={{ scale: 0.96 }}
          transition={SPRING_BUTTON}
          className="pointer-events-auto inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] text-[#AEAEB2] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
          style={{
            background:
              'linear-gradient(180deg, rgba(36, 36, 40, 0.94) 0%, rgba(24, 24, 28, 0.96) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            boxShadow:
              'inset 0 1px 0.5px rgba(255, 255, 255, 0.18), 0 8px 24px rgba(0, 0, 0, 0.6)',
          }}
        >
          <span>Made with ❤️ by</span>
          <span className="font-medium text-white">@enjay404</span>
        </motion.a>

        <motion.a
          href="https://ko-fi.com/enjay404"
          target="_blank"
          rel="noopener noreferrer"
          whileTap={{ scale: 0.96 }}
          transition={SPRING_BUTTON}
          className="group pointer-events-auto inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] font-medium text-[#AEAEB2] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
          style={{
            background:
              'linear-gradient(180deg, rgba(36, 36, 40, 0.94) 0%, rgba(24, 24, 28, 0.96) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            boxShadow:
              'inset 0 1px 0.5px rgba(255, 255, 255, 0.18), 0 8px 24px rgba(0, 0, 0, 0.6)',
          }}
        >
          <span
            aria-hidden="true"
            className="drop-shadow-[0_0_6px_rgba(255,159,10,0.35)] transition-all duration-150 group-hover:drop-shadow-[0_0_8px_rgba(48,209,88,0.5)]"
          >
            ☕
          </span>
          <span>Support</span>
        </motion.a>
      </div>
    </footer>
  );
});
