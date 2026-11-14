import { BookOpen } from 'lucide-react';
import { type MouseEvent, memo } from 'react';

interface FooterDockProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export const FooterDock = memo(function FooterDock({
  currentPath = '/',
  onNavigate,
}: FooterDockProps) {
  const isGuide = currentPath === '/guide';

  const handleLinkClick = (e: MouseEvent<HTMLAnchorElement>, path: string) => {
    if (!onNavigate) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <footer
      className="fixed bottom-0 inset-x-0 z-20 flex justify-center pointer-events-none px-3 pt-6 pb-[max(14px,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/95 via-black/60 to-transparent lg:static lg:mt-10 lg:bg-none lg:px-0 lg:pt-2 lg:pb-8 lg:pointer-events-auto"
      style={{ contain: 'layout style' }}
    >
      <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        <a
          href="https://instagram.com/enjay404"
          target="_blank"
          rel="noopener noreferrer"
          className="liquid-glass-pill pointer-events-auto inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[11.5px] text-[#AEAEB2] transition-[transform,color] duration-150 hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 sm:px-3.5 sm:text-[12px]"
        >
          <span>Made with ❤️ by</span>
          <span className="font-medium text-white">@enjay404</span>
        </a>

        <a
          href="/guide"
          aria-current={isGuide ? 'page' : undefined}
          onClick={(e) => handleLinkClick(e, '/guide')}
          className={`liquid-glass-pill pointer-events-auto inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[11.5px] font-medium transition-[transform,color] duration-150 hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 sm:px-3.5 sm:text-[12px] ${
            isGuide ? 'text-white' : 'text-[#AEAEB2]'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5 text-[#30D158]" aria-hidden="true" />
          <span>Guide</span>
        </a>

        <a
          href="https://ko-fi.com/enjay404"
          target="_blank"
          rel="noopener noreferrer"
          className="liquid-glass-pill group pointer-events-auto inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[11.5px] font-medium text-[#AEAEB2] transition-[transform,color] duration-150 hover:text-white active:scale-[0.96] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 sm:px-3.5 sm:text-[12px]"
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
