import { toPng } from 'html-to-image';
import {
  ArrowDown,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardPaste,
  Copy,
  Disc3,
  Download,
  Eye,
  EyeOff,
  Globe,
  Link2,
  Loader2,
  Lock,
  Maximize2,
  Music2,
  Play,
  Search,
  Smartphone,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import {
  type MouseEvent,
  type ReactNode,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { ALBUM_TYPE_BADGE_STYLE, ALBUM_TYPE_LABEL } from '../utils/badgeStyles';
import { FooterDock } from './FooterDock';
import { SriLankaFlag } from './SriLankaFlag';

const ABOUT_YOU_ARTWORK =
  'https://cdn-images.dzcdn.net/images/cover/792fa7a01b6f80fe45733c6442c1781d/250x250-000000-80-0-0.jpg';
const BIRDS_ARTWORK =
  'https://cdn-images.dzcdn.net/images/cover/5d284b31cb9ddeb1a0c79aede5a94e1c/250x250-000000-80-0-0.jpg';
const SARAGAYE_ARTWORK =
  'https://cdn-images.dzcdn.net/images/cover/fe6c49a84905c1f61d1335bc9372462c/250x250-000000-80-0-0.jpg';
const DIE_WITH_A_SMILE_ARTWORK =
  'https://cdn-images.dzcdn.net/images/cover/4bd5903f4ce8f2601916bfadb44efe8a/250x250-000000-80-0-0.jpg';

const ABOUT_YOU_ISRC = 'ISRC:GBK3W2202321';

const GUIDE_HOWTO_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to Find Hidden Songs on Instagram Music Using TrackCode',
  description:
    'Step-by-step guide to finding songs missing from Instagram Music by searching on TrackCode, copying the universal ISRC code, and pasting it into Instagram Stories, Reels, or Notes.',
  totalTime: 'PT30S',
  supply: [
    {
      '@type': 'HowToSupply',
      name: 'TrackCode (https://trackcode.online)',
    },
    {
      '@type': 'HowToSupply',
      name: 'Instagram app',
    },
  ],
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'Search any song on TrackCode',
      text: 'Open TrackCode and type the song name or paste a Spotify link—no login required.',
      url: 'https://trackcode.online/guide#step-1',
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'Copy its universal ISRC code',
      text: 'Tap the track (for example, About You by The 1975) to copy its formatted ISRC search code such as ISRC:GBK3W2202321.',
      url: 'https://trackcode.online/guide#step-2',
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'Paste it into Instagram Music',
      text: 'Open the Music sticker on an Instagram Story, Reel, or Note, paste the ISRC code into the search bar, and tap the unlocked track.',
      url: 'https://trackcode.online/guide#step-3',
    },
  ],
};

type GuideTab = 'guide' | 'promo';

interface GuidePageProps {
  onNavigate?: (path: string) => void;
}

const VerifiedBadge = memo(function VerifiedBadge() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Verified"
      className="h-[14px] w-[14px] shrink-0"
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
  );
});

const CoverArtwork = memo(function CoverArtwork({
  src = ABOUT_YOU_ARTWORK,
  alt = 'About You by The 1975 album artwork',
  sizeClass,
  roundedClass,
  sizePx = 48,
  children,
}: {
  src?: string;
  alt?: string;
  sizeClass: string;
  roundedClass: string;
  sizePx?: number;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-[#2C2C2E] ring-1 ring-white/10 ${sizeClass} ${roundedClass}`}
    >
      {!failed ? (
        <img
          src={src}
          alt={alt}
          width={sizePx}
          height={sizePx}
          crossOrigin="anonymous"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2C2C2E] to-[#18181B] text-[#8E8E93]">
          <Disc3 className="h-5 w-5" />
        </div>
      )}
      {children}
    </div>
  );
});

interface StorySlideCardProps {
  id: string;
  badge: ReactNode;
  headline: string;
  subtext?: string;
  subtextItalic?: boolean;
  glowStyle: string;
  paddingClass?: string;
  customHeader?: ReactNode;
  customLayout?: ReactNode;
  bottomSlot?: ReactNode;
  children?: ReactNode;
  cardRef?: (node: HTMLElement | null) => void;
}

const StorySlideCard = memo(function StorySlideCard({
  id,
  badge,
  headline,
  subtext,
  subtextItalic = false,
  glowStyle,
  paddingClass = 'py-12',
  customHeader,
  customLayout,
  bottomSlot,
  children,
  cardRef,
}: StorySlideCardProps) {
  return (
    <article
      ref={cardRef}
      id={id}
      className={`relative flex h-[640px] w-[360px] shrink-0 flex-col justify-between overflow-hidden rounded-[32px] border border-white/[0.12] bg-[#09090B] px-6 shadow-[0_24px_60px_rgba(0,0,0,0.85)] ${paddingClass}`}
    >
      {/* Top ambient radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[48%]"
        style={{ background: glowStyle }}
      />

      {/* Subtle top specular rim */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.07),transparent_70%)]"
      />

      {customLayout ? (
        customLayout
      ) : (
        <>
          {/* Top Safe-Zone Copy */}
          <div className="relative z-10">
            {customHeader ?? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.06] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/85">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#30D158]" aria-hidden="true" />
                  <span className="inline-flex items-center gap-1.5">{badge}</span>
                </span>

                <h2 className="mt-3 text-[22px] font-bold leading-[1.14] tracking-[-0.03em] text-white">
                  {headline}
                </h2>

                {subtext && (
                  <p
                    className={`mt-1.5 text-[13px] leading-[1.45] text-[#98989D] ${
                      subtextItalic ? 'italic text-[#AEAEB2]' : ''
                    }`}
                  >
                    {subtext}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Center UI Mockup */}
          <div className="relative z-10 my-auto py-2">{children}</div>

          {/* Bottom Safe-Zone Watermark */}
          <div className="relative z-10 flex justify-center">
            {bottomSlot ?? (
              <div className="liquid-glass-pill inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-medium tracking-[0.01em] text-white/90">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-[#30D158] shadow-[0_0_8px_rgba(48,209,88,0.8)]"
                  aria-hidden="true"
                />
                <span>trackcode.online</span>
              </div>
            )}
          </div>
        </>
      )}
    </article>
  );
});

/* ============================================================================
 * TAB 1: STEP-BY-STEP GUIDE SLIDES (About You — The 1975)
 * ========================================================================== */

const SlideOneContent = memo(function SlideOneContent() {
  return (
    <div className="flex flex-col items-center">
      {/* Dark-mode Instagram Music Sticker Mockup */}
      <div className="w-full rounded-[22px] border border-white/[0.11] bg-gradient-to-b from-[#1E1E22] to-[#131316] p-3.5 shadow-[0_14px_34px_rgba(0,0,0,0.65)]">
        <div className="mb-2.5 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8E8E93]">
            <Music2 className="h-3.5 w-3.5 text-white/70" />
            <span>Instagram Music</span>
          </span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-[#8E8E93]">
            Search
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-[#2C2C2E] px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-[#8E8E93]" />
          <span className="truncate text-[13.5px] font-medium text-white">
            About You The 1975
          </span>
        </div>

        <div className="mt-3 flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-black/40 px-3 py-4 text-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#8E8E93]">
            <Search className="h-3.5 w-3.5 opacity-75" />
          </div>
          <p className="mt-2 text-[13.5px] font-semibold text-white/80">
            No results found
          </p>
          <p className="mt-0.5 text-[11px] text-[#6E6E73]">
            Hidden on Instagram Music search
          </p>
        </div>
      </div>

      {/* Glowing Liquid Glass Transition Arrow */}
      <div className="my-3 flex flex-col items-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#30D158]/40 bg-gradient-to-b from-[#232327] to-[#141417] text-[#30D158] shadow-[0_0_24px_rgba(48,209,88,0.28),inset_0_1px_0_rgba(255,255,255,0.2)]">
          <ArrowDown className="h-4 w-4 stroke-[2.4]" />
        </div>
      </div>

      {/* TrackCode Solution Pill */}
      <div className="liquid-glass-pill flex items-center gap-2 rounded-2xl border-[#30D158]/30 px-4 py-2">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#30D158]" />
        <span className="text-[12.5px] font-semibold text-white">
          Unlock it with <span className="text-[#30D158]">trackcode.online</span>
        </span>
      </div>
    </div>
  );
});

const SlideTwoContent = memo(function SlideTwoContent() {
  return (
    <div className="space-y-3">
      {/* TrackCode Spotlight Dark-Glass Search Bar */}
      <div className="liquid-glass-search flex min-h-[48px] items-center rounded-[16px] px-3.5 py-2">
        <Search className="h-[16px] w-[16px] shrink-0 text-white/90 drop-shadow-[0_0_8px_rgba(48,209,88,0.35)]" />
        <span className="ml-2.5 flex-1 truncate text-[14px] font-medium text-white">
          About You — The 1975
        </span>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-black">
          <X className="h-3 w-3 stroke-[2.5]" />
        </span>
      </div>

      {/* TrackCode Liquid Glass Track Capsule */}
      <div className="relative flex min-h-[72px] w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.16] border-t-white/[0.24] bg-gradient-to-b from-[#232327] to-[#151518] px-3.5 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_14px_30px_rgba(0,0,0,0.6)]">
        {/* Specular top catch */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_15%_0%,rgba(255,255,255,0.11)_0%,rgba(255,255,255,0.03)_50%,transparent_100%)]"
        />

        {/* Diagonal glass sheen highlight */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              'linear-gradient(115deg, transparent 18%, rgba(255, 255, 255, 0.06) 44%, rgba(255, 255, 255, 0.13) 50%, rgba(255, 255, 255, 0.06) 56%, transparent 82%)',
          }}
        />

        <CoverArtwork sizeClass="h-12 w-12" roundedClass="rounded-[10px]">
          <span
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-white/22 text-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
              <Play className="ml-[1px] h-2.5 w-2.5 fill-white text-white" />
            </span>
          </span>
        </CoverArtwork>

        <div className="relative z-10 min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold leading-snug tracking-[-0.01em] text-white">
            About You
          </div>
          <p className="mt-0.5 truncate text-[12.5px] leading-snug text-[#8E8E93]">
            The 1975
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className="inline-flex h-[17px] items-center rounded-[4px] px-1.5 text-[9.5px] font-semibold leading-none tracking-[0.04em]"
              style={ALBUM_TYPE_BADGE_STYLE.album}
            >
              {ALBUM_TYPE_LABEL.album}
            </span>
            <span className="text-[11px] font-medium tabular-nums text-[#8E8E93]">
              2022
            </span>
          </div>
        </div>

        <ChevronRight className="relative z-10 h-4 w-4 shrink-0 text-white/80" />
      </div>

      <p className="pt-1 text-center text-[11px] font-medium text-[#8E8E93]">
        Tap any track to grab its exact studio ISRC
      </p>
    </div>
  );
});

const SlideThreeContent = memo(function SlideThreeContent() {
  return (
    <div className="relative overflow-hidden rounded-[26px] border border-white/[0.12] bg-gradient-to-b from-[#232326] to-[#151517] p-4 shadow-[0_20px_48px_rgba(0,0,0,0.75)]">
      {/* Top specular highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_70%)]"
      />

      {/* Ambient tinted artwork glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full opacity-25"
        style={{
          background:
            'radial-gradient(circle, rgba(160, 175, 200, 0.8) 0%, rgba(48, 209, 88, 0.25) 48%, transparent 72%)',
        }}
      />

      {/* Track Header */}
      <div className="relative flex items-center gap-3">
        <CoverArtwork
          sizeClass="h-14 w-14 shadow-[0_8px_20px_rgba(0,0,0,0.5)]"
          roundedClass="rounded-2xl"
          sizePx={56}
        />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-semibold leading-tight tracking-[-0.02em] text-white">
            About You
          </div>
          <p className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[13px] text-[#AEAEB2]">
            <span className="truncate">The 1975</span>
            <VerifiedBadge />
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className="inline-flex h-[16px] items-center rounded-[4px] px-1.5 text-[9px] font-semibold leading-none tracking-[0.04em]"
              style={ALBUM_TYPE_BADGE_STYLE.album}
            >
              {ALBUM_TYPE_LABEL.album}
            </span>
            <span className="text-[11px] font-medium tabular-nums text-[#8E8E93]">
              2022
            </span>
          </div>
        </div>
      </div>

      {/* Inset Instagram Search Code Box */}
      <div className="relative mt-3.5 flex items-center justify-between gap-2.5 rounded-[14px] border border-[#30D158]/40 bg-[#2C2C2E] px-3.5 py-2.5 shadow-[0_0_18px_rgba(48,209,88,0.12)]">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-medium tracking-wide text-[#8E8E93]">
            Instagram Search Code
          </div>
          <div className="font-mono-isrc mt-0.5 truncate text-[15px] font-semibold tracking-[0.02em] text-white">
            {ABOUT_YOU_ISRC}
          </div>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[#30D158]">
          <Copy className="h-3.5 w-3.5" />
        </span>
      </div>

      {/* Solid Green Copied Confirmation Pill */}
      <div className="relative mt-2.5 flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-[14px] bg-[#30D158] px-4 text-[14px] font-semibold tracking-[-0.01em] text-black shadow-[0_8px_20px_rgba(48,209,88,0.28)]">
        <Check className="h-4 w-4 stroke-[2.8]" />
        <span>Copied</span>
      </div>
    </div>
  );
});

const SlideFourContent = memo(function SlideFourContent() {
  return (
    <div className="w-full rounded-[22px] border border-white/[0.11] bg-gradient-to-b from-[#1E1E22] to-[#131316] p-3.5 shadow-[0_18px_42px_rgba(0,0,0,0.72)]">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#8E8E93]">
          <Music2 className="h-3.5 w-3.5 text-white/80" />
          <span>Instagram Music</span>
        </span>
        <span className="rounded-full bg-[#30D158]/15 px-2 py-0.5 text-[10px] font-semibold text-[#30D158]">
          Unlocked
        </span>
      </div>

      {/* Instagram Search Input with Pasted ISRC */}
      <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#2C2C2E] px-3 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-white/80" />
        <span className="font-mono-isrc truncate text-[13.5px] font-semibold text-white">
          {ABOUT_YOU_ISRC}
        </span>
      </div>

      {/* Revealed Unlocked Track Row */}
      <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-white/[0.14] bg-white/[0.06] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
        <CoverArtwork sizeClass="h-11 w-11" roundedClass="rounded-[10px]" sizePx={44} />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-white">
            About You
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-[#AEAEB2]">
            The 1975 · 5:26
          </div>
        </div>

        <span
          aria-label="Selected track"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-[0_2px_10px_rgba(255,255,255,0.28)]"
        >
          <Check className="h-3.5 w-3.5 stroke-[2.8]" />
        </span>
      </div>
    </div>
  );
});

/* ============================================================================
 * TAB 2: PROMO & MOTION SLIDES (Creative GPU-Composited 9:16 Showcase)
 * ========================================================================== */

const PromoOneContent = memo(function PromoOneContent() {
  return (
    <div className="relative flex items-center justify-center py-2">
      {/* Subtle radial glow behind floating tilted card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-4 top-1/2 h-40 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(48, 209, 88, 0.2) 0%, rgba(255, 255, 255, 0.05) 45%, transparent 72%)',
        }}
      />

      {/* Floating Tilted (-rotate-2) TrackCode ISRC Card */}
      <div className="animate-promo-float relative w-full overflow-hidden rounded-[24px] border border-white/[0.16] border-t-white/[0.28] bg-gradient-to-b from-[#252529] to-[#141417] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_22px_48px_rgba(0,0,0,0.85)]">
        {/* Continuous GPU diagonal glass light-sweep */}
        <span
          aria-hidden="true"
          className="animate-promo-sweep pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(115deg, transparent 20%, rgba(255, 255, 255, 0.08) 48%, rgba(255, 255, 255, 0.16) 50%, rgba(255, 255, 255, 0.08) 52%, transparent 80%)',
          }}
        />

        <div className="relative flex items-center gap-3">
          <CoverArtwork sizeClass="h-12 w-12" roundedClass="rounded-xl" sizePx={48} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold text-white">
              About You
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-[#AEAEB2]">
              <span className="truncate">The 1975</span>
              <VerifiedBadge />
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="inline-flex h-[16px] items-center rounded-[4px] px-1.5 text-[9px] font-semibold leading-none tracking-[0.04em]"
                style={ALBUM_TYPE_BADGE_STYLE.album}
              >
                {ALBUM_TYPE_LABEL.album}
              </span>
              <span className="text-[10.5px] font-medium tabular-nums text-[#8E8E93]">
                2022
              </span>
            </div>
          </div>
        </div>

        <div className="relative mt-3.5 flex items-center justify-between gap-2 rounded-[13px] border border-[#30D158]/35 bg-[#2C2C2E] px-3 py-2">
          <div className="min-w-0">
            <div className="text-[9.5px] font-medium tracking-wide text-[#8E8E93]">
              Instagram Search Code
            </div>
            <div className="font-mono-isrc truncate text-[14px] font-semibold tracking-[0.02em] text-white">
              {ABOUT_YOU_ISRC}
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#30D158] px-2.5 py-1 text-[11px] font-semibold text-black">
            <Check className="h-3 w-3 stroke-[2.8]" />
            <span>Copied</span>
          </span>
        </div>
      </div>
    </div>
  );
});

const PROMO_EQ_RADIUS = 10.5;
const PROMO_EQ_CIRCUMFERENCE = 2 * Math.PI * PROMO_EQ_RADIUS;

const PromoTwoContent = memo(function PromoTwoContent() {
  return (
    <div className="space-y-2.5">
      {/* #1 Global Capsule with Live Progress Ring + 3-bar GPU Equalizer */}
      <div className="relative flex translate-x-0 items-center gap-2.5 overflow-hidden rounded-2xl border border-white/[0.18] border-t-white/[0.28] bg-gradient-to-b from-[#252529] to-[#161619] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_12px_28px_rgba(0,0,0,0.6)]">
        <CoverArtwork src={BIRDS_ARTWORK} alt="BIRDS OF A FEATHER artwork" sizeClass="h-11 w-11" roundedClass="rounded-[10px]" sizePx={44}>
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="relative flex h-6 w-6 items-center justify-center rounded-full border border-white/40 bg-black/55">
              <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
                <circle
                  cx="12"
                  cy="12"
                  r={PROMO_EQ_RADIUS}
                  fill="none"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="1.8"
                />
                <circle
                  cx="12"
                  cy="12"
                  r={PROMO_EQ_RADIUS}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeDasharray={PROMO_EQ_CIRCUMFERENCE}
                  strokeDashoffset={PROMO_EQ_CIRCUMFERENCE * 0.34}
                />
              </svg>
              {/* 3-bar GPU scaleY Equalizer */}
              <span className="relative flex h-2.5 items-end gap-[2px]" aria-hidden="true">
                <span className="animate-promo-eq h-full w-[2px] rounded-full bg-white" />
                <span
                  className="animate-promo-eq h-full w-[2px] rounded-full bg-white"
                  style={{ animationDelay: '180ms' }}
                />
                <span
                  className="animate-promo-eq h-full w-[2px] rounded-full bg-white"
                  style={{ animationDelay: '340ms' }}
                />
              </span>
            </span>
          </span>
        </CoverArtwork>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white">
              #1 GLOBAL
            </span>
          </div>
          <div className="mt-0.5 truncate text-[13.5px] font-semibold text-white">
            BIRDS OF A FEATHER
          </div>
          <div className="truncate text-[11.5px] text-[#8E8E93]">Billie Eilish</div>
        </div>

        <span className="shrink-0 rounded-full bg-[#30D158]/15 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-[#30D158]">
          ▲ 2
        </span>
      </div>

      {/* #1 Sri Lanka Capsule (staggered right) */}
      <div className="relative flex translate-x-2 items-center gap-2.5 overflow-hidden rounded-2xl border border-white/[0.12] border-t-white/[0.2] bg-gradient-to-b from-[#1E1E22] to-[#131316] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_10px_24px_rgba(0,0,0,0.5)]">
        <CoverArtwork src={SARAGAYE_ARTWORK} alt="Saragaye artwork" sizeClass="h-11 w-11" roundedClass="rounded-[10px]" sizePx={44} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white">
              <SriLankaFlag />
              <span>#1 SRI LANKA</span>
            </span>
          </div>
          <div className="mt-0.5 truncate text-[13.5px] font-semibold text-white">
            Saragaye
          </div>
          <div className="truncate text-[11.5px] text-[#8E8E93]">SANUKA</div>
        </div>

        <span className="shrink-0 rounded-full bg-[#30D158]/15 px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-[#30D158]">
          ▲ 3
        </span>
      </div>

      {/* #2 Global Capsule (staggered further) */}
      <div className="relative flex translate-x-4 items-center gap-2.5 overflow-hidden rounded-2xl border border-white/[0.08] border-t-white/[0.15] bg-gradient-to-b from-[#19191C] to-[#121214] px-3 py-2.5 opacity-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <CoverArtwork src={DIE_WITH_A_SMILE_ARTWORK} alt="Die With A Smile artwork" sizeClass="h-10 w-10" roundedClass="rounded-[9px]" sizePx={40} />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-white">
            Die With A Smile
          </div>
          <div className="truncate text-[11px] text-[#8E8E93]">
            Lady Gaga, Bruno Mars
          </div>
        </div>

        <span className="shrink-0 text-[10px] font-semibold tracking-wide text-white/70">
          NEW
        </span>
      </div>
    </div>
  );
});

const PromoThreeContent = memo(function PromoThreeContent() {
  return (
    <div className="space-y-3.5">
      {/* Top 2 Kinetic Feature Pills */}
      <div className="grid grid-cols-2 gap-2">
        <div className="liquid-glass-pill flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[11.5px] font-semibold text-white">
          <Zap className="h-3.5 w-3.5 shrink-0 text-[#30D158]" />
          <span>Zero Login</span>
        </div>
        <div className="liquid-glass-pill flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[11.5px] font-semibold text-white">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-[#30D158]" />
          <span>Spotify Links</span>
        </div>
      </div>

      {/* Illuminated Spotlight Search Bar with Blinking Cursor */}
      <div className="liquid-glass-search flex min-h-[52px] items-center rounded-[18px] border-[#30D158]/45 px-3.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_0_24px_rgba(48,209,88,0.16)]">
        <Link2 className="h-4 w-4 shrink-0 text-[#30D158]" />
        <div className="ml-2.5 flex min-w-0 flex-1 items-center">
          <span className="truncate text-[13px] font-medium text-white">
            open.spotify.com/track/…
          </span>
          <span
            aria-hidden="true"
            className="animate-promo-cursor ml-0.5 inline-block h-4 w-[2px] shrink-0 rounded-full bg-[#30D158]"
          />
        </div>
        <span className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-full border border-white/20 bg-white/[0.12] px-2.5 py-1 text-[11px] font-semibold text-white">
          <ClipboardPaste className="h-3 w-3 text-[#30D158]" />
          <span>Paste</span>
        </span>
      </div>

      {/* Bottom 2 Kinetic Feature Pills */}
      <div className="grid grid-cols-2 gap-2">
        <div className="liquid-glass-pill flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[11.5px] font-semibold text-white">
          <Copy className="h-3.5 w-3.5 shrink-0 text-[#30D158]" />
          <span>1-Tap Copy</span>
        </div>
        <div className="liquid-glass-pill flex items-center gap-2 rounded-2xl px-3 py-2.5 text-[11.5px] font-semibold text-white">
          <Smartphone className="h-3.5 w-3.5 shrink-0 text-[#30D158]" />
          <span>iOS Web App</span>
        </div>
      </div>
    </div>
  );
});

const PromoFourContent = memo(function PromoFourContent() {
  return (
    <div className="flex flex-col items-center">
      {/* Top Tier: Dimmed Locked Instagram Music Search */}
      <div className="w-full rounded-[20px] border border-white/[0.08] bg-[#141416] p-3.5 opacity-65">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8E8E93]">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="h-3 w-3 text-[#FF453A]" />
            <span>Before · Instagram Search</span>
          </span>
          <span className="text-[#FF453A]">Hidden</span>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/50 px-3 py-2">
          <span className="truncate text-[12.5px] text-[#AEAEB2]">About You The 1975</span>
          <span className="shrink-0 text-[11px] font-medium text-[#6E6E73]">
            No results found
          </span>
        </div>
      </div>

      {/* Luminous Downward Glass Chevron */}
      <div className="my-2.5 flex items-center justify-center">
        <div className="animate-promo-chevron flex h-8 w-8 items-center justify-center rounded-full border border-[#30D158]/45 bg-gradient-to-b from-[#232624] to-[#141715] text-[#30D158] shadow-[0_0_20px_rgba(48,209,88,0.28)]">
          <ChevronDown className="h-4 w-4 stroke-[2.6]" />
        </div>
      </div>

      {/* Bottom Tier: Illuminated TrackCode Unlocked Card */}
      <div className="relative w-full overflow-hidden rounded-[22px] border border-[#30D158]/35 bg-gradient-to-b from-[#232527] to-[#141618] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_14px_34px_rgba(0,0,0,0.7)]">
        <div className="flex items-center gap-2.5">
          <CoverArtwork sizeClass="h-11 w-11" roundedClass="rounded-[10px]" sizePx={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[14px] font-semibold text-white">
                About You
              </span>
              <VerifiedBadge />
            </div>
            <div className="truncate text-[11.5px] text-[#AEAEB2]">The 1975</div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#30D158] px-2.5 py-1 text-[11px] font-semibold text-black">
            <Check className="h-3 w-3 stroke-[2.8]" />
            <span>Copied</span>
          </span>
        </div>

        <div className="mt-2.5 flex items-center justify-between rounded-xl border border-white/10 bg-[#2C2C2E] px-3 py-2">
          <span className="font-mono-isrc text-[12.5px] font-semibold text-white">
            {ABOUT_YOU_ISRC}
          </span>
          <span className="text-[10.5px] font-semibold text-[#30D158]">
            Paste in Instagram
          </span>
        </div>
      </div>
    </div>
  );
});

const SlideFiveContent = memo(function SlideFiveContent() {
  const steps = [
    {
      num: '1',
      label: 'Song missing on IG?',
      pillText: 'No results found',
      pillClass: 'border border-white/[0.08] bg-black/45 text-[#8E8E93]',
    },
    {
      num: '2',
      label: 'Search TrackCode',
      pillText: 'About You · The 1975',
      pillClass: 'border border-white/[0.14] bg-white/[0.08] text-white/90',
    },
    {
      num: '3',
      label: 'Copy ISRC code',
      pillText: ABOUT_YOU_ISRC,
      pillClass:
        'font-mono-isrc border border-[#30D158]/35 bg-[#30D158]/[0.1] text-[#30D158] text-[10px]',
    },
    {
      num: '4',
      label: 'Paste in IG Music',
      pillText: '✓ Track Unlocked',
      pillClass:
        'border border-white/30 bg-white/[0.12] text-white shadow-[0_0_12px_rgba(255,255,255,0.12)]',
    },
  ] as const;

  return (
    <div className="relative space-y-2.5">
      {/* Subtle vertical connecting timeline line */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-5 bottom-5 left-[23px] z-0 w-px bg-gradient-to-b from-white/[0.08] via-white/[0.18] to-[#30D158]/45"
      />

      {steps.map((step) => (
        <div
          key={step.num}
          className="relative z-10 flex items-center justify-between gap-2 rounded-2xl border border-white/[0.08] border-t-white/[0.16] bg-gradient-to-b from-[#1C1C1F] to-[#131315] px-3.5 py-2.5 shadow-[0_8px_20px_rgba(0,0,0,0.45)]"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/[0.14] bg-[#262629] text-[10.5px] font-bold tabular-nums text-white">
              {step.num}
            </span>
            <span className="truncate text-[11.5px] font-medium text-white/90">
              {step.label}
            </span>
          </div>

          <span
            className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${step.pillClass}`}
          >
            {step.pillText}
          </span>
        </div>
      ))}
    </div>
  );
});

const PromoFiveTryNowLayout = memo(function PromoFiveTryNowLayout() {
  return (
    <>
      {/* Top Section (Above Sticker Zone) */}
      <div className="relative z-10 flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85">
          <span>TrackCode · ISRC FINDER</span>
          <SriLankaFlag />
        </span>

        <h2 className="mt-3.5 text-[38px] font-bold leading-none tracking-tight text-white">
          Try Now
        </h2>

        <p className="mx-auto mt-2.5 max-w-[260px] text-[12.5px] leading-snug text-white/55">
          Paste a song or Spotify link &amp; unlock it on Instagram.
        </p>

        {/* Stacked Downward Chevrons */}
        <div
          aria-hidden="true"
          className="animate-promo-chevron mt-3 flex flex-col items-center -space-y-2.5"
        >
          <ChevronDown className="h-4 w-4 text-white/30" />
          <ChevronDown className="h-4 w-4 text-white/70" />
        </div>
      </div>

      {/* Center Dedicated Instagram Link Sticker Zone */}
      <div className="relative z-10 flex h-[168px] w-full flex-col items-center justify-center rounded-[28px] border border-dashed border-white/[0.15] bg-[#040405] shadow-[inset_0_4px_24px_rgba(0,0,0,0.95)]">
        <span className="select-none text-[10px] font-medium uppercase tracking-[0.22em] text-white/[0.16]">
          TAP STICKER · ADD LINK HERE
        </span>
      </div>

      {/* Bottom Section (Below Sticker Zone) */}
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Stacked Upward Chevrons */}
        <div
          aria-hidden="true"
          className="mb-3 flex flex-col items-center -space-y-2.5"
        >
          <ChevronUp className="h-4 w-4 text-white/70" />
          <ChevronUp className="h-4 w-4 text-white/30" />
        </div>

        <div className="w-full rounded-2xl border border-white/[0.09] border-t-white/[0.16] bg-gradient-to-b from-[#1C1C1F] to-[#131315] px-4 py-2.5 text-[11.5px] font-medium text-white/75 shadow-[0_8px_22px_rgba(0,0,0,0.5)]">
          Free · Zero Login · Works in Safari &amp; Chrome
        </div>
      </div>
    </>
  );
});

interface SlideDefinition {
  id: string;
  anchor: string;
  filename: string;
  badge: ReactNode;
  headline: string;
  subtext?: string;
  subtextItalic?: boolean;
  glowStyle: string;
  paddingClass?: string;
  customHeader?: ReactNode;
  customLayout?: ReactNode;
  bottomSlot?: ReactNode;
  content?: ReactNode;
}

const GUIDE_SLIDES: SlideDefinition[] = [
  {
    id: 'slide-1',
    anchor: 'the-problem',
    filename: 'trackcode-guide-01.png',
    badge: '01 · THE PROBLEM',
    headline: 'Instagram hiding the song you want?',
    glowStyle:
      'radial-gradient(75% 80% at 50% 0%, rgba(255, 69, 58, 0.14) 0%, rgba(255, 255, 255, 0.03) 55%, transparent 100%)',
    content: <SlideOneContent />,
  },
  {
    id: 'slide-2',
    anchor: 'step-1',
    filename: 'trackcode-guide-02.png',
    badge: '02 · STEP 1',
    headline: 'Search any song on TrackCode',
    subtext: 'Type the song name or paste a Spotify link—no login required.',
    glowStyle:
      'radial-gradient(75% 80% at 30% 0%, rgba(48, 209, 88, 0.14) 0%, rgba(58, 75, 115, 0.12) 55%, transparent 100%)',
    content: <SlideTwoContent />,
  },
  {
    id: 'slide-3',
    anchor: 'step-2',
    filename: 'trackcode-guide-03.png',
    badge: '03 · STEP 2',
    headline: 'Copy its universal ISRC code',
    subtext: 'Every track has a unique studio code that unlocks it on Instagram.',
    glowStyle:
      'radial-gradient(75% 80% at 70% 0%, rgba(48, 209, 88, 0.16) 0%, rgba(255, 255, 255, 0.04) 55%, transparent 100%)',
    content: <SlideThreeContent />,
  },
  {
    id: 'slide-4',
    anchor: 'step-3',
    filename: 'trackcode-guide-04.png',
    badge: '04 · STEP 3',
    headline: 'Paste it into Instagram Music',
    subtext: 'Open Music on your Story, Reel, or Note and paste the code.',
    glowStyle:
      'radial-gradient(75% 80% at 50% 0%, rgba(48, 209, 88, 0.18) 0%, rgba(90, 120, 180, 0.12) 55%, transparent 100%)',
    bottomSlot: (
      <div className="inline-flex items-center gap-2 rounded-full border border-[#30D158]/45 bg-gradient-to-b from-[#232624] to-[#141715] px-4 py-2 text-[12px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.65),0_0_20px_rgba(48,209,88,0.18)]">
        <span
          className="h-1.5 w-1.5 rounded-full bg-[#30D158] shadow-[0_0_8px_rgba(48,209,88,0.9)]"
          aria-hidden="true"
        />
        <span>Try it now at trackcode.online</span>
      </div>
    ),
    content: <SlideFourContent />,
  },
  {
    id: 'slide-5',
    anchor: 'all-in-one',
    filename: 'trackcode-guide-all-in-one.png',
    badge: 'ALL-IN-ONE · QUICK GUIDE',
    headline: 'Unlock any song on Instagram.',
    paddingClass: 'py-11',
    customHeader: (
      <>
        <span className="inline-block rounded-full border border-white/[0.12] bg-white/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
          ALL-IN-ONE · QUICK GUIDE
        </span>
        <h2 className="mt-2.5 text-[22px] font-bold leading-tight tracking-tight text-white">
          Unlock any song on Instagram.
        </h2>
      </>
    ),
    glowStyle:
      'radial-gradient(75% 80% at 50% 0%, rgba(48, 209, 88, 0.14) 0%, rgba(255, 255, 255, 0.04) 55%, transparent 100%)',
    content: <SlideFiveContent />,
  },
];

const PROMO_SLIDES: SlideDefinition[] = [
  {
    id: 'promo-1',
    anchor: 'promo-brand',
    filename: 'trackcode-promo-01.png',
    badge: 'TRACKCODE',
    headline: 'Stop settling for the wrong song.',
    glowStyle:
      'radial-gradient(78% 82% at 50% 0%, rgba(48, 209, 88, 0.17) 0%, rgba(255, 255, 255, 0.04) 55%, transparent 100%)',
    content: <PromoOneContent />,
  },
  {
    id: 'promo-2',
    anchor: 'promo-charts',
    filename: 'trackcode-promo-02.png',
    badge: (
      <>
        <span>GLOBAL &amp;</span>
        <SriLankaFlag />
        <span>SRI LANKA</span>
      </>
    ),
    headline: 'Preview & unlock trending tracks daily.',
    subtext: '30-second audio previews + Global & Sri Lanka charts.',
    glowStyle:
      'radial-gradient(75% 80% at 30% 0%, rgba(48, 209, 88, 0.15) 0%, rgba(58, 75, 115, 0.14) 55%, transparent 100%)',
    content: <PromoTwoContent />,
  },
  {
    id: 'promo-3',
    anchor: 'promo-speed',
    filename: 'trackcode-promo-03.png',
    badge: 'INSTANT · NO LOGIN',
    headline: 'Paste link. Copy code. Post Story.',
    subtext: 'Works directly in your browser—free forever.',
    glowStyle:
      'radial-gradient(75% 80% at 70% 0%, rgba(48, 209, 88, 0.15) 0%, rgba(255, 255, 255, 0.04) 55%, transparent 100%)',
    content: <PromoThreeContent />,
  },
  {
    id: 'promo-4',
    anchor: 'promo-unlock',
    filename: 'trackcode-promo-04.png',
    badge: 'HIDDEN MUSIC UNLOCKED',
    headline: 'Every song on Instagram, unlocked.',
    subtext: 'Turn missing tracks into instant Story soundtracks.',
    glowStyle:
      'radial-gradient(75% 80% at 50% 0%, rgba(48, 209, 88, 0.18) 0%, rgba(90, 120, 180, 0.12) 55%, transparent 100%)',
    bottomSlot: (
      <div className="inline-flex items-center gap-2 rounded-full border border-[#30D158]/45 bg-gradient-to-b from-[#232624] to-[#141715] px-4 py-2 text-[12px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.65),0_0_20px_rgba(48,209,88,0.18)]">
        <span
          className="h-1.5 w-1.5 rounded-full bg-[#30D158] shadow-[0_0_8px_rgba(48,209,88,0.9)]"
          aria-hidden="true"
        />
        <span>Try free at trackcode.online</span>
      </div>
    ),
    content: <PromoFourContent />,
  },
  {
    id: 'promo-5',
    anchor: 'promo-try-now',
    filename: 'trackcode-promo-try-now.png',
    badge: 'TRACKCODE · TRY NOW',
    headline: 'Try Now',
    paddingClass: 'py-12',
    glowStyle:
      'radial-gradient(85% 45% at 50% 0%, rgba(255, 255, 255, 0.09) 0%, rgba(48, 209, 88, 0.08) 45%, transparent 100%)',
    customLayout: <PromoFiveTryNowLayout />,
  },
];

function useFullscreenScale(active: boolean): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!active || typeof window === 'undefined') return;

    const update = () => {
      const maxW = (window.innerWidth - 24) / 360;
      const maxH = (window.innerHeight - 48) / 640;
      setScale(Math.min(maxW, maxH, 1.35));
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [active]);

  return scale;
}

export function GuidePage({ onNavigate }: GuidePageProps) {
  const [activeTab, setActiveTab] = useState<GuideTab>('guide');
  const [isCleanMode, setIsCleanMode] = useState(false);
  const [fullscreenSlideId, setFullscreenSlideId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const fullscreenScale = useFullscreenScale(Boolean(fullscreenSlideId));

  const visibleSlides = activeTab === 'guide' ? GUIDE_SLIDES : PROMO_SLIDES;
  const allSlides = [...GUIDE_SLIDES, ...PROMO_SLIDES];
  const activeFullscreenSlide = fullscreenSlideId
    ? allSlides.find((s) => s.id === fullscreenSlideId) ?? null
    : null;

  useEffect(() => {
    const prevTitle = document.title;
    const guideTitle = 'How to Find Hidden Songs on Instagram Music — TrackCode Guide';
    document.title = guideTitle;

    const canonicalEl = document.querySelector('link[rel="canonical"]');
    const prevCanonical = canonicalEl?.getAttribute('href') ?? null;
    if (canonicalEl) {
      canonicalEl.setAttribute('href', 'https://trackcode.online/guide');
    }

    const ogTitleEl = document.querySelector('meta[property="og:title"]');
    const prevOgTitle = ogTitleEl?.getAttribute('content') ?? null;
    if (ogTitleEl) {
      ogTitleEl.setAttribute('content', guideTitle);
    }

    const ogUrlEl = document.querySelector('meta[property="og:url"]');
    const prevOgUrl = ogUrlEl?.getAttribute('content') ?? null;
    if (ogUrlEl) {
      ogUrlEl.setAttribute('content', 'https://trackcode.online/guide');
    }

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-trackcode-guide-schema', 'true');
    script.text = JSON.stringify(GUIDE_HOWTO_SCHEMA);
    document.head.appendChild(script);

    return () => {
      document.title = prevTitle;
      if (canonicalEl && prevCanonical) {
        canonicalEl.setAttribute('href', prevCanonical);
      }
      if (ogTitleEl && prevOgTitle) {
        ogTitleEl.setAttribute('content', prevOgTitle);
      }
      if (ogUrlEl && prevOgUrl) {
        ogUrlEl.setAttribute('content', prevOgUrl);
      }
      script.remove();
    };
  }, []);

  useEffect(() => {
    if (!fullscreenSlideId && !isCleanMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (fullscreenSlideId) {
          setFullscreenSlideId(null);
        } else if (isCleanMode) {
          setIsCleanMode(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenSlideId, isCleanMode]);

  useEffect(() => {
    if (!fullscreenSlideId) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreenSlideId]);

  const handleBackClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      if (!onNavigate) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      onNavigate('/');
    },
    [onNavigate]
  );

  const handleCopyGuideLink = useCallback(async () => {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/guide`
        : 'https://trackcode.online/guide';
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setLinkCopied(true);
        window.setTimeout(() => setLinkCopied(false), 1800);
        return;
      }
    } catch {
      // Fallback below
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) {
        setLinkCopied(true);
        window.setTimeout(() => setLinkCopied(false), 1800);
      }
    } catch {
      // Silent fail
    }
  }, []);

  const handleDownloadSlide = useCallback(async (slide: SlideDefinition) => {
    const node = cardRefs.current[slide.id];
    if (!node) return;

    setExportingId(slide.id);
    try {
      const dataUrl = await toPng(node, {
        width: 360,
        height: 640,
        pixelRatio: 3,
        cacheBust: false,
        backgroundColor: '#09090B',
        style: {
          borderRadius: '0px',
          border: 'none',
          boxShadow: 'none',
          margin: '0px',
          transform: 'none',
        },
      });

      const link = document.createElement('a');
      link.download = slide.filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSavedId(slide.id);
      window.setTimeout(() => {
        setSavedId((curr) => (curr === slide.id ? null : curr));
      }, 2000);
    } catch {
      // Keep UI responsive on export error
    } finally {
      setExportingId((curr) => (curr === slide.id ? null : curr));
    }
  }, []);

  const fullscreenModal = activeFullscreenSlide ? (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#09090B] p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Fullscreen Story slide: ${activeFullscreenSlide.headline}`}
      onClick={() => setFullscreenSlideId(null)}
    >
      {!isCleanMode && (
        <div
          className="fixed top-4 right-4 z-20 flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setIsCleanMode(true)}
            className="liquid-glass-pill flex h-10 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[12px] font-medium text-white/85 transition-colors hover:text-white active:scale-[0.96]"
          >
            <EyeOff className="h-3.5 w-3.5 text-[#30D158]" />
            <span>Hide Controls</span>
          </button>
          <button
            type="button"
            onClick={() => setFullscreenSlideId(null)}
            aria-label="Close fullscreen slide"
            className="liquid-glass-pill flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-white/85 transition-colors hover:text-white active:scale-[0.94]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: `scale(${fullscreenScale})`,
          transformOrigin: 'center center',
        }}
      >
        <StorySlideCard
          id={`${activeFullscreenSlide.id}-fullscreen`}
          badge={activeFullscreenSlide.badge}
          headline={activeFullscreenSlide.headline}
          subtext={activeFullscreenSlide.subtext}
          subtextItalic={activeFullscreenSlide.subtextItalic}
          glowStyle={activeFullscreenSlide.glowStyle}
          paddingClass={activeFullscreenSlide.paddingClass}
          customHeader={activeFullscreenSlide.customHeader}
          customLayout={activeFullscreenSlide.customLayout}
          bottomSlot={activeFullscreenSlide.bottomSlot}
        >
          {activeFullscreenSlide.content}
        </StorySlideCard>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative min-h-[100dvh] bg-[#09090B] text-white">
      {/* Subtle Breathing Top Ambient Glow */}
      {!isCleanMode && (
        <div
          aria-hidden="true"
          className="animate-ambient-breathe pointer-events-none absolute inset-x-0 top-0 z-0 h-[40vh]"
          style={{
            transformOrigin: '50% 10%',
            background:
              'radial-gradient(70% 75% at 50% 0%, rgba(48, 209, 88, 0.1) 0%, rgba(58, 75, 115, 0.1) 52%, transparent 100%)',
          }}
        />
      )}

      {/* Top Navigation Bar (Hidden in Screenshot View) */}
      {!isCleanMode && (
        <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#09090B]/95">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2.5 px-4 py-3 sm:px-6">
            <a
              href="/"
              onClick={handleBackClick}
              className="liquid-glass inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.1] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
            >
              <ArrowLeft className="h-4 w-4 text-[#AEAEB2]" />
              <span>Back to TrackCode</span>
            </a>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopyGuideLink()}
                className="liquid-glass inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-white/[0.1] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              >
                {linkCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-[#30D158]" />
                    <span className="text-[#30D158]">Copied Link</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-[#AEAEB2]" />
                    <span className="hidden sm:inline">Copy Guide Link</span>
                    <span className="sm:hidden">Copy Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsCleanMode(true)}
                aria-pressed={isCleanMode}
                className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.16] bg-white/[0.08] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.14] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              >
                <Eye className="h-3.5 w-3.5 text-[#30D158]" />
                <span>Screenshot View</span>
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Minimal Floating Exit Pill when Screenshot View is Active */}
      {isCleanMode && !fullscreenSlideId && (
        <button
          type="button"
          onClick={() => setIsCleanMode(false)}
          className="liquid-glass-pill fixed right-4 bottom-4 z-40 inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-medium text-white/80 opacity-65 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
        >
          <EyeOff className="h-3.5 w-3.5 text-[#30D158]" />
          <span>Exit Screenshot View</span>
        </button>
      )}

      <main
        className={`relative z-10 mx-auto max-w-5xl px-2 sm:px-6 ${
          isCleanMode ? 'py-8 sm:py-12' : 'pt-8 pb-28 lg:pt-10 lg:pb-12'
        }`}
      >
        {/* Guide Intro Header & Segmented Tab Switcher (Hidden in Screenshot View) */}
        {!isCleanMode && (
          <section className="mx-auto mb-9 max-w-2xl px-2 text-center sm:px-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#AEAEB2]">
              <Sparkles className="h-3 w-3 text-[#30D158]" />
              <span>1080×1920 Story &amp; Reel Studio</span>
            </span>
            <h1 className="title-ambient-glow mt-3.5 text-[28px] font-bold leading-[1.12] tracking-[-0.03em] text-white sm:text-[36px]">
              How to Unlock Hidden Songs on Instagram Music
            </h1>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#98989D] sm:text-[15.5px]">
              Download exact <strong className="font-semibold text-white">1080×1920</strong> PNG
              Story cards or switch to <strong className="font-semibold text-white">Promo &amp; Motion</strong>{' '}
              for animated vertical promo slides.
            </p>

            {/* Monochrome Segmented Glass Tab Switcher */}
            <div
              role="tablist"
              aria-label="Guide slide collections"
              className="relative mx-auto mt-6 grid max-w-[390px] grid-cols-2 rounded-2xl border border-white/[0.08] bg-[#131315] p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]"
            >
              <span
                aria-hidden="true"
                style={{
                  transform:
                    activeTab === 'guide'
                      ? 'translate3d(0%, 0, 0)'
                      : 'translate3d(100%, 0, 0)',
                }}
                className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl border border-white/[0.15] border-t-white/[0.28] bg-gradient-to-b from-[#262629] to-[#1A1A1D] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_4px_12px_rgba(0,0,0,0.4)] transition-transform duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              />

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'guide'}
                onClick={() => setActiveTab('guide')}
                className={`relative z-10 flex min-h-[38px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-2 text-[12.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/35 ${
                  activeTab === 'guide'
                    ? 'font-semibold text-white'
                    : 'font-medium text-white/50 hover:text-white/80'
                }`}
              >
                <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Step-by-Step Guide</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'promo'}
                onClick={() => setActiveTab('promo')}
                className={`relative z-10 flex min-h-[38px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2 py-2 text-[12.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/35 ${
                  activeTab === 'promo'
                    ? 'font-semibold text-white'
                    : 'font-medium text-white/50 hover:text-white/80'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#30D158]" aria-hidden="true" />
                <span>Promo &amp; Motion</span>
              </button>
            </div>
          </section>
        )}

        {/* 4 Vertical 9:16 Studio Story/Reel Cards */}
        <section
          aria-label={
            activeTab === 'guide'
              ? 'Step-by-step Story guide slides'
              : 'Promotional motion Story slides'
          }
          className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-10"
        >
          {visibleSlides.map((slide) => {
            const isExporting = exportingId === slide.id;
            const isSaved = savedId === slide.id;

            return (
              <div
                key={slide.id}
                id={slide.anchor}
                className="flex flex-col items-center last:md:col-span-2"
              >
                <div className="flex w-full justify-center max-[375px]:-mb-8 max-[375px]:origin-top max-[375px]:scale-[0.94]">
                  <StorySlideCard
                    cardRef={(node) => {
                      cardRefs.current[slide.id] = node;
                    }}
                    id={slide.id}
                    badge={slide.badge}
                    headline={slide.headline}
                    subtext={slide.subtext}
                    subtextItalic={slide.subtextItalic}
                    glowStyle={slide.glowStyle}
                    paddingClass={slide.paddingClass}
                    customHeader={slide.customHeader}
                    customLayout={slide.customLayout}
                    bottomSlot={slide.bottomSlot}
                  >
                    {slide.content}
                  </StorySlideCard>
                </div>

                {!isCleanMode && (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={isExporting}
                      onClick={() => void handleDownloadSlide(slide)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.14] bg-gradient-to-b from-[#232326] to-[#161618] px-3.5 py-2 text-[12px] font-medium text-white transition-colors hover:border-white/[0.24] active:scale-[0.97] disabled:cursor-wait disabled:opacity-75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 cursor-pointer"
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-white/80" />
                          <span>Rendering…</span>
                        </>
                      ) : isSaved ? (
                        <span className="text-[#30D158]">✓ Saved 1080p</span>
                      ) : (
                        <>
                          <Download className="h-3.5 w-3.5 text-[#30D158]" />
                          <span>Download 1080p</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setFullscreenSlideId(slide.id)}
                      className="liquid-glass inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12px] font-medium text-[#D1D1D6] transition-colors hover:bg-white/[0.1] hover:text-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
                    >
                      <Maximize2 className="h-3.5 w-3.5 text-[#30D158]" />
                      <span>Fullscreen 9:16</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </main>

      {!isCleanMode && <FooterDock />}

      {typeof document !== 'undefined' && fullscreenModal
        ? createPortal(fullscreenModal, document.body)
        : null}
    </div>
  );
}

export default GuidePage;
