import {
  ArrowDown,
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Disc3,
  Eye,
  EyeOff,
  Maximize2,
  Music2,
  Play,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { type MouseEvent, type ReactNode, memo, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ALBUM_TYPE_BADGE_STYLE, ALBUM_TYPE_LABEL } from '../utils/badgeStyles';
import { FooterDock } from './FooterDock';

const ABOUT_YOU_ARTWORK =
  'https://cdn-images.dzcdn.net/images/cover/792fa7a01b6f80fe45733c6442c1781d/250x250-000000-80-0-0.jpg';
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
  sizeClass,
  roundedClass,
  children,
}: {
  sizeClass: string;
  roundedClass: string;
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-[#2C2C2E] ring-1 ring-white/10 ${sizeClass} ${roundedClass}`}
    >
      {!failed ? (
        <img
          src={ABOUT_YOU_ARTWORK}
          alt="About You by The 1975 album artwork"
          referrerPolicy="no-referrer"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#8E8E93]">
          <Disc3 className="h-5 w-5" />
        </div>
      )}
      {children}
    </div>
  );
});

interface StorySlideCardProps {
  id: string;
  badge: string;
  headline: string;
  subtext: string;
  subtextItalic?: boolean;
  glowStyle: string;
  bottomSlot?: ReactNode;
  children: ReactNode;
  isFullscreen?: boolean;
}

const StorySlideCard = memo(function StorySlideCard({
  id,
  badge,
  headline,
  subtext,
  subtextItalic = false,
  glowStyle,
  bottomSlot,
  children,
  isFullscreen = false,
}: StorySlideCardProps) {
  return (
    <article
      id={isFullscreen ? undefined : id}
      className="relative mx-auto flex aspect-[9/16] w-full max-w-[390px] flex-col justify-between overflow-hidden rounded-[32px] border border-white/[0.12] bg-[#09090B] px-6 py-12 shadow-[0_24px_60px_rgba(0,0,0,0.85)]"
      style={
        isFullscreen
          ? {
              width: 'min(390px, calc(100vw - 1.5rem), calc((100dvh - 3rem) * 9 / 16))',
            }
          : undefined
      }
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

      {/* Top Safe-Zone Copy */}
      <div className="relative z-10">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] bg-white/[0.06] px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/85">
          <span className="h-1.5 w-1.5 rounded-full bg-[#30D158]" aria-hidden="true" />
          <span>{badge}</span>
        </span>

        <h2 className="mt-3.5 text-[24px] font-bold leading-[1.12] tracking-[-0.03em] text-white sm:text-[26px]">
          {headline}
        </h2>

        <p
          className={`mt-2 text-[13.5px] leading-relaxed text-[#98989D] ${
            subtextItalic ? 'italic text-[#AEAEB2]' : ''
          }`}
        >
          {subtext}
        </p>
      </div>

      {/* Center UI Mockup */}
      <div className="relative z-10 my-auto py-3">{children}</div>

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
    </article>
  );
});

const SlideOneContent = memo(function SlideOneContent() {
  return (
    <div className="flex flex-col items-center">
      {/* Dark-mode Instagram Music Sticker Mockup */}
      <div className="w-full rounded-[24px] border border-white/[0.11] bg-gradient-to-b from-[#1E1E22] to-[#131316] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.65)]">
        <div className="mb-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8E8E93]">
            <Music2 className="h-3.5 w-3.5 text-white/70" />
            <span>Instagram Music</span>
          </span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-[#8E8E93]">
            Search
          </span>
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.1] bg-[#2C2C2E] px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-[#8E8E93]" />
          <span className="truncate text-[14px] font-medium text-white">
            About You The 1975
          </span>
        </div>

        <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-white/[0.06] bg-black/40 px-4 py-5 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#8E8E93]">
            <Search className="h-4 w-4 opacity-75" />
          </div>
          <p className="mt-2.5 text-[14px] font-semibold text-white/80">
            No results found
          </p>
          <p className="mt-0.5 text-[11.5px] text-[#6E6E73]">
            Hidden on Instagram Music search
          </p>
        </div>
      </div>

      {/* Glowing Liquid Glass Transition Arrow */}
      <div className="my-3.5 flex flex-col items-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#30D158]/40 bg-gradient-to-b from-[#232327] to-[#141417] text-[#30D158] shadow-[0_0_24px_rgba(48,209,88,0.28),inset_0_1px_0_rgba(255,255,255,0.2)]">
          <ArrowDown className="h-4 w-4 stroke-[2.4]" />
        </div>
      </div>

      {/* TrackCode Solution Pill */}
      <div className="liquid-glass-pill flex items-center gap-2.5 rounded-2xl border-[#30D158]/30 px-4 py-2.5">
        <Sparkles className="h-4 w-4 shrink-0 text-[#30D158]" />
        <span className="text-[13px] font-semibold text-white">
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
      <div className="liquid-glass-search flex min-h-[50px] items-center rounded-[16px] px-3.5 py-2.5">
        <Search className="h-[17px] w-[17px] shrink-0 text-white/90 drop-shadow-[0_0_8px_rgba(48,209,88,0.35)]" />
        <span className="ml-2.5 flex-1 truncate text-[14.5px] font-medium text-white">
          About You — The 1975
        </span>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 text-black">
          <X className="h-3 w-3 stroke-[2.5]" />
        </span>
      </div>

      {/* TrackCode Liquid Glass Track Capsule */}
      <div className="relative flex min-h-[74px] w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.16] border-t-white/[0.24] bg-gradient-to-b from-[#232327] to-[#151518] px-3.5 py-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_14px_30px_rgba(0,0,0,0.6)]">
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
          <div className="truncate text-[15px] font-semibold leading-snug tracking-[-0.01em] text-white">
            About You
          </div>
          <p className="mt-0.5 truncate text-[13px] leading-snug text-[#8E8E93]">
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

      <p className="pt-1 text-center text-[11.5px] font-medium text-[#8E8E93]">
        Tap any track to grab its exact studio ISRC
      </p>
    </div>
  );
});

const SlideThreeContent = memo(function SlideThreeContent() {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/[0.12] bg-gradient-to-b from-[#232326] to-[#151517] p-4 shadow-[0_20px_48px_rgba(0,0,0,0.75)]">
      {/* Top specular highlight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_70%)]"
      />

      {/* Ambient green-tinted artwork glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full opacity-25"
        style={{
          background:
            'radial-gradient(circle, rgba(160, 175, 200, 0.8) 0%, rgba(48, 209, 88, 0.25) 48%, transparent 72%)',
        }}
      />

      {/* Track Header */}
      <div className="relative flex items-center gap-3.5">
        <CoverArtwork
          sizeClass="h-16 w-16 shadow-[0_8px_20px_rgba(0,0,0,0.5)]"
          roundedClass="rounded-2xl"
        />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-semibold leading-tight tracking-[-0.02em] text-white">
            About You
          </div>
          <p className="mt-1 inline-flex max-w-full items-center gap-1.5 text-[13.5px] text-[#AEAEB2]">
            <span className="truncate">The 1975</span>
            <VerifiedBadge />
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span
              className="inline-flex h-[17px] items-center rounded-[4px] px-1.5 text-[9.5px] font-semibold leading-none tracking-[0.04em]"
              style={ALBUM_TYPE_BADGE_STYLE.album}
            >
              {ALBUM_TYPE_LABEL.album}
            </span>
            <span className="text-[11.5px] font-medium tabular-nums text-[#8E8E93]">
              2022
            </span>
          </div>
        </div>
      </div>

      {/* Inset Instagram Search Code Box */}
      <div className="relative mt-4 flex items-center justify-between gap-2.5 rounded-[14px] border border-[#30D158]/40 bg-[#2C2C2E] px-3.5 py-3 shadow-[0_0_18px_rgba(48,209,88,0.12)]">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] font-medium tracking-wide text-[#8E8E93]">
            Instagram Search Code
          </div>
          <div className="font-mono-isrc mt-0.5 truncate text-[15.5px] font-semibold tracking-[0.02em] text-white">
            {ABOUT_YOU_ISRC}
          </div>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[#30D158]">
          <Copy className="h-3.5 w-3.5" />
        </span>
      </div>

      {/* Solid Green Copied Confirmation Pill */}
      <div className="relative mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-[14px] bg-[#30D158] px-4 text-[14.5px] font-semibold tracking-[-0.01em] text-black shadow-[0_8px_20px_rgba(48,209,88,0.28)]">
        <Check className="h-4 w-4 stroke-[2.8]" />
        <span>Copied</span>
      </div>
    </div>
  );
});

const SlideFourContent = memo(function SlideFourContent() {
  return (
    <div className="w-full rounded-[24px] border border-white/[0.11] bg-gradient-to-b from-[#1E1E22] to-[#131316] p-4 shadow-[0_18px_42px_rgba(0,0,0,0.72)]">
      <div className="mb-3 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8E8E93]">
          <Music2 className="h-3.5 w-3.5 text-white/80" />
          <span>Instagram Music</span>
        </span>
        <span className="rounded-full bg-[#30D158]/15 px-2 py-0.5 text-[10px] font-semibold text-[#30D158]">
          Unlocked
        </span>
      </div>

      {/* Instagram Search Input with Pasted ISRC */}
      <div className="flex items-center gap-2.5 rounded-xl border border-white/15 bg-[#2C2C2E] px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-white/80" />
        <span className="font-mono-isrc truncate text-[14px] font-semibold text-white">
          {ABOUT_YOU_ISRC}
        </span>
      </div>

      {/* Revealed Unlocked Track Row */}
      <div className="mt-3.5 flex items-center gap-3 rounded-2xl border border-white/[0.14] bg-white/[0.06] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
        <CoverArtwork sizeClass="h-11 w-11" roundedClass="rounded-[10px]" />

        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold text-white">
            About You
          </div>
          <div className="mt-0.5 truncate text-[12px] text-[#AEAEB2]">
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

interface SlideDefinition {
  id: string;
  anchor: string;
  badge: string;
  headline: string;
  subtext: string;
  subtextItalic?: boolean;
  glowStyle: string;
  bottomSlot?: ReactNode;
  content: ReactNode;
}

const SLIDES: SlideDefinition[] = [
  {
    id: 'slide-1',
    anchor: 'the-problem',
    badge: '01 · THE PROBLEM',
    headline: 'Instagram hiding the song you want?',
    subtext: '"For when Instagram refuses to show the song you want."',
    subtextItalic: true,
    glowStyle:
      'radial-gradient(75% 80% at 50% 0%, rgba(255, 69, 58, 0.14) 0%, rgba(255, 255, 255, 0.03) 55%, transparent 100%)',
    content: <SlideOneContent />,
  },
  {
    id: 'slide-2',
    anchor: 'step-1',
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
];

export function GuidePage({ onNavigate }: GuidePageProps) {
  const [isCleanMode, setIsCleanMode] = useState(false);
  const [fullscreenSlideId, setFullscreenSlideId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const activeFullscreenSlide = fullscreenSlideId
    ? SLIDES.find((s) => s.id === fullscreenSlideId) ?? null
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

      <div onClick={(e) => e.stopPropagation()}>
        <StorySlideCard
          id={activeFullscreenSlide.id}
          badge={activeFullscreenSlide.badge}
          headline={activeFullscreenSlide.headline}
          subtext={activeFullscreenSlide.subtext}
          subtextItalic={activeFullscreenSlide.subtextItalic}
          glowStyle={activeFullscreenSlide.glowStyle}
          bottomSlot={activeFullscreenSlide.bottomSlot}
          isFullscreen={true}
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
        className={`relative z-10 mx-auto max-w-5xl px-4 sm:px-6 ${
          isCleanMode ? 'py-8 sm:py-12' : 'pt-8 pb-28 lg:pt-10 lg:pb-12'
        }`}
      >
        {/* Guide Intro Header (Hidden in Screenshot View) */}
        {!isCleanMode && (
          <section className="mx-auto mb-9 max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#AEAEB2]">
              <Sparkles className="h-3 w-3 text-[#30D158]" />
              <span>9:16 Story &amp; Reel Ready</span>
            </span>
            <h1 className="title-ambient-glow mt-3.5 text-[28px] font-bold leading-[1.12] tracking-[-0.03em] text-white sm:text-[36px]">
              How to Unlock Hidden Songs on Instagram Music
            </h1>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-[#98989D] sm:text-[15.5px]">
              Shareable step-by-step guide featuring{' '}
              <span className="font-medium text-white">About You</span> by{' '}
              <span className="font-medium text-white">The 1975</span>. Toggle{' '}
              <strong className="font-semibold text-white">Screenshot View</strong> or open any
              slide in <strong className="font-semibold text-white">Fullscreen 9:16</strong> for
              clean Story screenshots.
            </p>
          </section>
        )}

        {/* 4 Vertical 9:16 Studio Story/Reel Cards */}
        <section
          aria-label="Step-by-step Story guide slides"
          className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-10"
        >
          {SLIDES.map((slide) => (
            <div key={slide.id} id={slide.anchor} className="flex flex-col items-center">
              <StorySlideCard
                id={slide.id}
                badge={slide.badge}
                headline={slide.headline}
                subtext={slide.subtext}
                subtextItalic={slide.subtextItalic}
                glowStyle={slide.glowStyle}
                bottomSlot={slide.bottomSlot}
              >
                {slide.content}
              </StorySlideCard>

              {!isCleanMode && (
                <button
                  type="button"
                  onClick={() => setFullscreenSlideId(slide.id)}
                  className="liquid-glass mt-3 inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] font-medium text-[#D1D1D6] transition-colors hover:bg-white/[0.1] hover:text-white active:scale-[0.97] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
                >
                  <Maximize2 className="h-3.5 w-3.5 text-[#30D158]" />
                  <span>Fullscreen 9:16</span>
                </button>
              )}
            </div>
          ))}
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
