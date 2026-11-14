import { Wrench } from 'lucide-react';
import { FooterDock } from './FooterDock';
import { SriLankaFlag } from './SriLankaFlag';

export function MaintenancePage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#09090B] text-white">
      {/* Slowly breathing top ambient radial glow (pure CSS GPU transform + opacity, zero backdrop-filter) */}
      <div
        aria-hidden="true"
        className="animate-ambient-breathe pointer-events-none absolute inset-x-0 top-0 z-0 h-[55vh]"
        style={{
          transformOrigin: '50% 0%',
          background:
            'radial-gradient(ellipse 80% 45% at 50% -10%, rgba(48, 209, 88, 0.14), rgba(255, 255, 255, 0.03) 55%, transparent 100%)',
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[480px] flex-1 flex-col px-4 pb-24 lg:pb-6">
        {/* Centered TrackCode Header */}
        <header className="flex flex-col items-center pt-[calc(env(safe-area-inset-top,0px)+14px)] pb-5 text-center">
          <img
            src="/assets/aistudio/logo_f0aa9f50.jpg"
            alt="TrackCode logo"
            width={56}
            height={56}
            className="mb-3 h-14 w-14 rounded-[14px] border border-white/[0.14] object-cover shadow-[0_8px_24px_rgba(0,0,0,0.7)]"
          />
          <h1 className="title-ambient-glow text-[34px] font-bold leading-[1.08] tracking-[-0.03em] text-white">
            TrackCode
          </h1>
          <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-[#8E8E93]">
            <span>ISRC FINDER</span>
            <SriLankaFlag />
          </p>
        </header>

        {/* Centered Apple Liquid Glass Maintenance Card */}
        <main className="flex flex-1 items-center justify-center py-2">
          <section
            aria-label="Under maintenance notice"
            className="animate-card-in relative mx-auto w-full max-w-md overflow-hidden rounded-[32px] border border-white/[0.12] bg-gradient-to-b from-[#232326] to-[#151517] p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.75)]"
          >
            {/* Subtle top radial specular highlight (zero backdrop-filter) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.09),transparent_70%)]"
            />

            {/* Centered top drag-pill accent */}
            <div aria-hidden="true" className="relative mx-auto mb-5 h-1 w-9 rounded-full bg-white/20" />

            {/* Animated Centerpiece Badge */}
            <div className="animate-badge-float relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.06]">
              <span
                aria-hidden="true"
                className="animate-ring-pulse pointer-events-none absolute inset-0 rounded-2xl border border-white/25"
              />
              <Wrench className="relative h-7 w-7 text-white" strokeWidth={1.9} />
            </div>

            {/* Status Pill & Heading */}
            <div className="relative mt-5">
              <span className="inline-flex items-center rounded-md bg-white/[0.08] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/75">
                SYSTEM TUNE-UP
              </span>

              <h2 className="mt-3 text-[22px] font-bold leading-tight tracking-[-0.025em] text-white">
                TrackCode will be right back
              </h2>

              <p className="mt-2 text-[14px] leading-relaxed text-[#98989D]">
                I&apos;m upgrading the servers and search engines to keep your Instagram music lookups fast and smooth :)
              </p>
            </div>

            {/* Inset Status Box */}
            <div className="relative mt-5 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3.5 text-left">
              <div className="min-w-0">
                <p className="text-[11.5px] font-medium uppercase tracking-[0.04em] text-[#8E8E93]">
                  Current Status
                </p>
                <p className="mt-0.5 truncate text-[14px] font-semibold text-white">
                  Upgrading APIs &amp; Cache
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="relative flex h-2 w-2 items-center justify-center" aria-hidden="true">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF9F0A] opacity-75" />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full bg-[#FF9F0A]"
                    style={{ boxShadow: '0 0 8px rgba(255, 159, 10, 0.6)' }}
                  />
                </span>
                <span className="text-[12.5px] font-medium text-[#FFB340]">
                  In Progress
                </span>
              </div>
            </div>

            {/* Full-Width White Pill Instagram CTA */}
            <a
              href="https://instagram.com/enjay404"
              target="_blank"
              rel="noopener noreferrer"
              className="relative mt-5 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-black transition-transform duration-150 hover:bg-white/90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-[18px] w-[18px] shrink-0"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
              <span>Follow updates on @enjay404</span>
            </a>

            <p className="relative mt-3 text-center text-[12px] text-[#8E8E93]">
              Live status &amp; ETA posted on Instagram Stories
            </p>
          </section>
        </main>
      </div>

      <FooterDock />
    </div>
  );
}

export default MaintenancePage;
