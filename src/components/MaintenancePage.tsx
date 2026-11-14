import { Wrench } from 'lucide-react';
import { motion } from 'motion/react';
import { FooterDock } from './FooterDock';

const IOS_CUBIC = [0.22, 1, 0.36, 1] as const;

export function MaintenancePage() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[#09090B] text-white">
      {/* Slowly breathing top ambient radial glow (GPU transform + opacity only, zero backdrop-filter) */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[55vh]"
        animate={{
          scale: [1, 1.06, 1],
          opacity: [0.82, 1, 0.82],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          transformOrigin: '50% 0%',
          background:
            'radial-gradient(ellipse 80% 45% at 50% -10%, rgba(48, 209, 88, 0.14), rgba(255, 255, 255, 0.03) 55%, transparent 100%)',
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[480px] flex-1 flex-col px-4 pb-24">
        {/* Centered TrackCode Header */}
        <header
          className="flex flex-col items-center pb-5 text-center"
          style={{ paddingTop: 'max(26px, env(safe-area-inset-top))' }}
        >
          <h1 className="title-ambient-glow text-[34px] font-bold leading-[1.08] tracking-[-0.03em] text-white">
            TrackCode
          </h1>
          <p className="mt-1.5 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-[#8E8E93]">
            <span>ISRC FINDER</span>
            <svg
              width="14"
              height="9"
              viewBox="0 0 32 20"
              fill="none"
              aria-label="Sri Lanka"
              role="img"
              className="h-[9px] w-[14px] shrink-0 rounded-[2px] opacity-85 ring-1 ring-white/15"
            >
              <rect width="32" height="20" fill="#E5AE2B" />
              <rect x="1.5" y="1.5" width="4.4" height="17" fill="#00534E" />
              <rect x="5.9" y="1.5" width="4.4" height="17" fill="#D96B08" />
              <rect x="11.8" y="1.5" width="18.7" height="17" fill="#821536" />
              <circle cx="13.2" cy="2.9" r="0.8" fill="#E5AE2B" />
              <circle cx="29.1" cy="2.9" r="0.8" fill="#E5AE2B" />
              <circle cx="13.2" cy="17.1" r="0.8" fill="#E5AE2B" />
              <circle cx="29.1" cy="17.1" r="0.8" fill="#E5AE2B" />
              <path
                d="M16.2 5.3v6.1M15.4 10.6h1.6"
                stroke="#E5AE2B"
                strokeWidth="0.95"
                strokeLinecap="round"
              />
              <path
                d="M16.9 9.1c1-.7 2.4-.8 3.6-.3.8-1 2.2-1.2 3.3-.6.9.5 1.5 1.4 1.4 2.4.7-.3 1.4.1 1.6.8.2.8-.3 1.6-1 1.9l.8 1.5h-1.3l-.8-1.5c-.7.1-1.4-.1-1.9-.5l-.4 2h-1.2l.2-2.1c-.7-.1-1.4-.3-2-.7l-.9 2.8h-1.2l.8-3c-.6-.2-1.1-.6-1.4-1.1-.3-.5-.1-1.2.4-1.6z"
                fill="#E5AE2B"
              />
            </svg>
          </p>
        </header>

        {/* Centered Apple Liquid Glass Maintenance Card */}
        <main className="flex flex-1 items-center justify-center py-2">
          <motion.section
            aria-label="Under maintenance notice"
            initial={{ opacity: 0, transform: 'translate3d(0, 18px, 0)' }}
            animate={{ opacity: 1, transform: 'translate3d(0, 0, 0)' }}
            transition={{ duration: 0.45, ease: IOS_CUBIC }}
            className="relative mx-auto w-full max-w-md overflow-hidden rounded-[32px] border border-white/[0.12] bg-gradient-to-b from-[#232326] to-[#151517] p-6 text-center shadow-[0_20px_50px_rgba(0,0,0,0.75)]"
          >
            {/* Subtle top radial specular highlight (zero backdrop-filter) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.09),transparent_70%)]"
            />

            {/* Centered top drag-pill accent */}
            <div aria-hidden="true" className="relative mx-auto mb-5 h-1 w-9 rounded-full bg-white/20" />

            {/* Animated Centerpiece Badge */}
            <motion.div
              animate={{
                transform: [
                  'translate3d(0, 0px, 0)',
                  'translate3d(0, -3px, 0)',
                  'translate3d(0, 0px, 0)',
                ],
              }}
              transition={{
                duration: 3.6,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.12] bg-white/[0.06]"
            >
              <motion.span
                aria-hidden="true"
                animate={{
                  scale: [1, 1.18, 1],
                  opacity: [0.45, 0, 0.45],
                }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="pointer-events-none absolute inset-0 rounded-2xl border border-white/25"
              />
              <Wrench className="relative h-7 w-7 text-white" strokeWidth={1.9} />
            </motion.div>

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
          </motion.section>
        </main>
      </div>

      {/* Shared Footer Pills */}
      <FooterDock />
    </div>
  );
}
