import { memo } from 'react';

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
        <a
          href="https://instagram.com/enjay404"
          target="_blank"
          rel="noopener noreferrer"
          className="liquid-glass-pill pointer-events-auto inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] text-[#AEAEB2] transition-[transform,color] duration-150 hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
        >
          <span>Made with ❤️ by</span>
          <span className="font-medium text-white">@enjay404</span>
        </a>

        <a
          href="https://ko-fi.com/enjay404"
          target="_blank"
          rel="noopener noreferrer"
          className="liquid-glass-pill group pointer-events-auto inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[12px] font-medium text-[#AEAEB2] transition-[transform,color] duration-150 hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
        >
          <span
            aria-hidden="true"
            className="drop-shadow-[0_0_6px_rgba(255,159,10,0.35)] transition-all duration-150 group-hover:drop-shadow-[0_0_8px_rgba(48,209,88,0.5)]"
          >
            ☕
          </span>
          <span>Support</span>
        </a>
      </div>
    </footer>
  );
});
