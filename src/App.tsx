import { Analytics } from '@vercel/analytics/react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  ClipboardPaste,
  Copy,
  Link2,
  RotateCcw,
  Search,
  Share,
  WifiOff,
  X,
} from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { BottomSheet } from './components/BottomSheet';
import { DynamicIslandToast, type ToastState } from './components/DynamicIslandToast';
import { EmptySearchView } from './components/EmptySearchView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SkeletonRows } from './components/SkeletonRows';
import { TrackRow } from './components/TrackRow';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import type { SearchApiResponse, TrackApiResponse, TrackItem } from './types/track';
import {
  clearRecentTracksStorage,
  formatIsrcCode,
  getCachedSearchResults,
  isSpotifyTrackLink,
  loadRecentTracks,
  saveRecentTrack,
  setCachedSearchResults,
  syncCopyIsrc,
} from './utils/spotifyInput';

const SPRING_BUTTON = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30,
};

const IOS_CUBIC = [0.22, 1, 0.36, 1] as const;

const PLACEHOLDER_MESSAGES = [
  'Search song, artist, or Spotify link',
  'Paste open.spotify.com or spotify.link',
] as const;

interface TrackListSectionProps {
  title: string;
  ariaLabel: string;
  tracks: TrackItem[];
  isLoading?: boolean;
  skeletonCount?: number;
  onSelect: (track: TrackItem, copiedSync: boolean) => void;
  onClear?: () => void;
}

const TrackListSection = memo(function TrackListSection({
  title,
  ariaLabel,
  tracks,
  isLoading = false,
  skeletonCount = 4,
  onSelect,
  onClear,
}: TrackListSectionProps) {
  return (
    <section aria-label={ariaLabel}>
      <div className="flex items-center justify-between px-1 pb-1.5">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#8E8E93]">
          {title}
        </h2>
        {onClear && (
          <motion.button
            type="button"
            onClick={onClear}
            whileTap={{ scale: 0.97 }}
            transition={SPRING_BUTTON}
            className="flex min-h-[36px] items-center rounded-lg px-2 text-[13px] font-medium text-[#30D158] active:bg-white/10"
          >
            Clear
          </motion.button>
        )}
      </div>
      <div className="liquid-glass overflow-hidden rounded-[20px]">
        {isLoading ? (
          <SkeletonRows count={skeletonCount} />
        ) : (
          tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </section>
  );
});

const FooterDock = memo(function FooterDock() {
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

export default function App() {
  const [query, setQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [results, setResults] = useState<TrackItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [quickTryTracks, setQuickTryTracks] = useState<TrackItem[]>([]);
  const [isQuickTryLoading, setIsQuickTryLoading] = useState(true);

  const [recentTracks, setRecentTracks] = useState<TrackItem[]>(() => loadRecentTracks());
  const [selectedTrack, setSelectedTrack] = useState<TrackItem | null>(null);
  const [autoCopiedSignal, setAutoCopiedSignal] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const skipNextAutoLookupRef = useRef<string | null>(null);
  const isOnline = useOnlineStatus();

  const trimmedQuery = query.trim();
  const isLinkMode = isSpotifyTrackLink(trimmedQuery);
  const lastCopiedTrack = recentTracks.find((item) => Boolean(item.isrc)) ?? null;
  const isSheetOpen = selectedTrack !== null;

  const showToast = useCallback((message: string, tone: ToastState['tone'] = 'success') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), message, tone });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 2600);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsQuickTryLoading(true);

    fetch('/api/quick-try')
      .then((res) => (res.ok ? res.json() : { tracks: [] }))
      .then((data: { tracks?: TrackItem[] }) => {
        if (!cancelled && Array.isArray(data.tracks)) {
          setQuickTryTracks(data.tracks);
        }
      })
      .catch(() => {
        // Silent fallback if offline on cold load
      })
      .finally(() => {
        if (!cancelled) {
          setIsQuickTryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (query.length > 0 || isSearchFocused) {
      return;
    }
    const interval = window.setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_MESSAGES.length);
    }, 3500);
    return () => window.clearInterval(interval);
  }, [query.length, isSearchFocused]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const executeLookup = useCallback(
    async (rawInput: string, mode: 'link' | 'search') => {
      if (mode === 'search') {
        const cached = getCachedSearchResults(rawInput);
        if (cached) {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
          setResults(cached);
          setErrorMessage(null);
          setIsRateLimited(false);
          setHasSearched(true);
          setIsLoading(false);
          return;
        }
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setErrorMessage(null);
      setIsRateLimited(false);

      try {
        if (mode === 'link') {
          const res = await fetch(`/api/track?input=${encodeURIComponent(rawInput)}`, {
            signal: controller.signal,
          });
          const payload = (await res.json()) as TrackApiResponse & { error?: string };
          if (!res.ok) {
            if (res.status === 429 || res.status >= 500) {
              setIsRateLimited(true);
            }
            throw new Error(payload.error || 'Could not load that Spotify track.');
          }

          const track = payload.track;
          (document.activeElement as HTMLElement | null)?.blur();
          setResults([track]);
          setHasSearched(true);
          setSelectedTrack(track);

          if (track.isrc) {
            const copied = syncCopyIsrc(track.isrc);
            setRecentTracks(saveRecentTrack(track));
            if (copied) {
              setAutoCopiedSignal((s) => s + 1);
              showToast(`Copied ${formatIsrcCode(track.isrc)}`, 'success');
            }
          } else {
            showToast('No ISRC found for this upload', 'info');
          }
        } else {
          const res = await fetch(`/api/search?q=${encodeURIComponent(rawInput)}`, {
            signal: controller.signal,
          });
          const payload = (await res.json()) as SearchApiResponse & { error?: string };
          if (!res.ok) {
            if (res.status === 429 || res.status >= 500) {
              setIsRateLimited(true);
            }
            throw new Error(payload.error || 'Unable to search Spotify right now.');
          }

          setCachedSearchResults(rawInput, payload.tracks);
          setResults(payload.tracks);
          setHasSearched(true);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const isOfflineError =
          (typeof navigator !== 'undefined' && !navigator.onLine) || err instanceof TypeError;
        const message = isOfflineError
          ? 'You appear to be offline. Reconnect to search Spotify, or browse your Recent tracks.'
          : err instanceof Error
            ? err.message
            : 'Something went wrong. Please try again.';
        setErrorMessage(message);
        setResults([]);
        setHasSearched(true);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (!trimmedQuery) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      skipNextAutoLookupRef.current = null;
      setResults([]);
      setIsLoading(false);
      setErrorMessage(null);
      setIsRateLimited(false);
      setHasSearched(false);
      return;
    }

    if (skipNextAutoLookupRef.current === trimmedQuery) {
      skipNextAutoLookupRef.current = null;
      return;
    }

    if (isLinkMode) {
      void executeLookup(trimmedQuery, 'link');
      return () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    }

    const cached = getCachedSearchResults(trimmedQuery);
    if (cached) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setResults(cached);
      setIsLoading(false);
      setErrorMessage(null);
      setIsRateLimited(false);
      setHasSearched(true);
      return;
    }

    if (trimmedQuery.length < 3) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setResults([]);
      setIsLoading(false);
      setErrorMessage(null);
      setIsRateLimited(false);
      setHasSearched(false);
      return;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void executeLookup(trimmedQuery, 'search');
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [trimmedQuery, isLinkMode, executeLookup]);

  const handleSelectTrack = useCallback(
    (track: TrackItem, copiedSync: boolean) => {
      (document.activeElement as HTMLElement | null)?.blur();
      setSelectedTrack(track);
      if (track.isrc) {
        setRecentTracks(saveRecentTrack(track));
        if (copiedSync) {
          setAutoCopiedSignal((s) => s + 1);
          showToast(`Copied ${formatIsrcCode(track.isrc)}`, 'success');
        }
      } else {
        setAutoCopiedSignal(0);
      }
    },
    [showToast]
  );

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      if (!navigator.clipboard?.readText) {
        inputRef.current?.focus();
        showToast('Long-press the search bar to paste', 'info');
        return;
      }
      const clipText = (await navigator.clipboard.readText()).trim();
      if (!clipText) {
        showToast('Clipboard is empty', 'info');
        inputRef.current?.focus();
        return;
      }
      setQuery(clipText);
    } catch {
      inputRef.current?.focus();
      showToast('Allow paste or long-press input', 'info');
    }
  }, [showToast]);

  const handleClearInput = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
    setQuery('');
    setResults([]);
    setErrorMessage(null);
    setIsRateLimited(false);
    setHasSearched(false);
    inputRef.current?.focus();
  }, []);

  const handleClearRecent = useCallback(() => {
    clearRecentTracksStorage();
    setRecentTracks([]);
    showToast('Recent history cleared', 'info');
  }, [showToast]);

  const handleSearchOtherVersions = useCallback((track: TrackItem) => {
    setSelectedTrack(null);
    const nextQuery = `${track.name} ${track.primaryArtist}`.trim();
    setQuery(nextQuery);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSelectedTrack(null);
  }, []);

  const handleBottomSheetCopied = useCallback(
    (isrc: string) => {
      if (selectedTrack) {
        setRecentTracks(saveRecentTrack(selectedTrack));
      }
      showToast(`Copied ${formatIsrcCode(isrc)}`, 'success');
    },
    [selectedTrack, showToast]
  );

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!trimmedQuery) {
      inputRef.current?.focus();
      return;
    }
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    skipNextAutoLookupRef.current = trimmedQuery;
    void executeLookup(trimmedQuery, isLinkMode ? 'link' : 'search');
  };

  const handleRetry = () => {
    if (!trimmedQuery) return;
    void executeLookup(trimmedQuery, isLinkMode ? 'link' : 'search');
  };

  const handleQuickCopyLast = () => {
    if (!lastCopiedTrack?.isrc) return;
    const copiedSync = syncCopyIsrc(lastCopiedTrack.isrc);
    if (copiedSync && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    handleSelectTrack(lastCopiedTrack, copiedSync);
  };

  const handleShareApp = async () => {
    const shareUrl = window.location.origin;
    const shareData = {
      title: 'TrackCode — ISRC Finder',
      text: 'Find hidden songs on Instagram Stories using ISRC codes — built by @enjay404',
      url: shareUrl,
    };

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share(shareData);
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Link copied to clipboard', 'success');
        return;
      }
    } catch {
      // Fallback below
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = shareUrl;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) {
        showToast('Link copied to clipboard', 'success');
        return;
      }
    } catch {
      // Silent fail
    }
    showToast('Copy the URL from your browser bar', 'info');
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-[100dvh] bg-black text-white">
        <DynamicIslandToast toast={toast} />

        <motion.div
          animate={{
            scale: isSheetOpen ? 0.96 : 1,
            opacity: isSheetOpen ? 0.68 : 1,
          }}
          transition={{
            duration: 0.25,
            ease: IOS_CUBIC,
          }}
          className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-black"
          style={{
            overflow: 'clip',
            paddingBottom: 'max(20px, env(safe-area-inset-bottom))',
            transformOrigin: 'center top',
          }}
        >
          {/* Breathing Ambient Background Glow behind top ~35% */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[42vh]"
            animate={{
              scale: [1, 1.08, 1],
              opacity: [0.85, 1, 0.85],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{
              transformOrigin: '50% 18%',
              background:
                'radial-gradient(68% 72% at 22% 14%, rgba(48, 209, 88, 0.11) 0%, transparent 72%), radial-gradient(75% 78% at 78% 18%, rgba(58, 75, 115, 0.14) 0%, transparent 75%)',
            }}
          />

          {/* Native iOS Large Title Header */}
          <header
            className="relative z-10 flex items-start justify-between px-4 pb-3"
            style={{ paddingTop: 'max(18px, env(safe-area-inset-top))' }}
          >
            <div className="flex flex-col items-start">
              <h1 className="title-ambient-glow text-[34px] font-bold leading-[1.08] tracking-[-0.03em] text-white">
                TrackCode
              </h1>
              <p className="mt-1 flex items-center gap-1.5 pl-[1.5px] text-[11px] font-semibold leading-none uppercase tracking-[0.14em] text-[#8E8E93]">
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
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              <motion.button
                type="button"
                onClick={() => void handleShareApp()}
                whileTap={{ scale: 0.95 }}
                transition={SPRING_BUTTON}
                aria-label="Share TrackCode"
                className="liquid-glass flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/[0.1] active:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              >
                <Share className="h-[17px] w-[17px] text-[#AEAEB2]" />
              </motion.button>
              <PWAInstallButton />
            </div>
          </header>

          {/* Floating Sticky Hero Liquid Glass Search Bar */}
          <div className="sticky top-0 z-20 px-4 py-2">
            <form
              onSubmit={handleSearchSubmit}
              className="liquid-glass-search relative flex min-h-[56px] items-center rounded-[18px]"
            >
              <span className="pointer-events-none flex pl-4">
                {isLinkMode ? (
                  <Link2 className="h-[19px] w-[19px] text-[#30D158]" />
                ) : (
                  <Search className="h-[19px] w-[19px] text-white/90 drop-shadow-[0_0_8px_rgba(48,209,88,0.35)]" />
                )}
              </span>

              <div className="relative flex min-w-0 flex-1 items-center">
                <input
                  ref={inputRef}
                  type="search"
                  inputMode="search"
                  enterKeyHint="search"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={query}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={isSearchFocused ? PLACEHOLDER_MESSAGES[0] : ''}
                  aria-label="Search song, artist, or paste Spotify link"
                  className="min-h-[56px] w-full bg-transparent px-3 py-3 text-[16px] text-white placeholder:text-white/[0.58] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                />

                {query.length === 0 && !isSearchFocused && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-3 right-2 flex items-center overflow-hidden"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={placeholderIndex}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.28, ease: 'easeOut' }}
                        className="truncate text-[16px] text-white/[0.58]"
                      >
                        {PLACEHOLDER_MESSAGES[placeholderIndex]}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {query.length === 0 ? (
                <motion.button
                  type="button"
                  onClick={() => void handlePasteFromClipboard()}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING_BUTTON}
                  className="mr-2 flex min-h-[36px] min-w-[44px] shrink-0 items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.12] px-3.5 text-[13px] font-semibold text-white active:bg-white/[0.2]"
                >
                  <ClipboardPaste className="h-3.5 w-3.5 text-[#30D158]" />
                  <span>Paste</span>
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearInput();
                  }}
                  whileTap={{ scale: 0.94 }}
                  transition={SPRING_BUTTON}
                  aria-label="Clear search"
                  className="relative z-20 mr-0.5 flex h-[44px] w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full text-[#8E8E93] active:bg-white/10 focus-visible:outline-none"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-black">
                    <X className="h-3.5 w-3.5 stroke-[2.6]" />
                  </span>
                </motion.button>
              )}
            </form>
          </div>

          {/* Main Content Area */}
          <main className="relative z-10 flex-1 px-4 pt-2 pb-24">
            {trimmedQuery ? (
              <>
                {isLoading && (
                  <div className="liquid-glass overflow-hidden rounded-[20px]">
                    <SkeletonRows count={6} />
                  </div>
                )}

                {!isLoading && !errorMessage && !hasSearched && !isLinkMode && trimmedQuery.length < 3 && (
                  <div className="liquid-glass rounded-[20px] px-4 py-4 text-center">
                    <p className="text-[13px] text-[#8E8E93]">
                      Type at least <span className="font-medium text-white">3 characters</span> to search, or press <span className="font-medium text-white">Search</span>.
                    </p>
                  </div>
                )}

                {!isLoading && errorMessage && (
                  <div className="relative overflow-hidden rounded-[32px] border border-white/[0.12] bg-gradient-to-b from-[#232326] to-[#151517] px-5 pt-3 pb-5 text-center shadow-[0_18px_48px_rgba(0,0,0,0.65)]">
                    {/* Subtle top radial specular glow (zero backdrop-filter) */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-0 h-32"
                      style={{
                        background:
                          'radial-gradient(75% 85% at 50% 0%, rgba(255, 255, 255, 0.08) 0%, rgba(255, 159, 10, 0.05) 48%, transparent 100%)',
                      }}
                    />

                    {/* Centered top pill handle */}
                    <div className="relative mx-auto mb-4 h-1 w-9 rounded-full bg-white/20" />

                    <h3 className="relative text-[18px] font-semibold tracking-[-0.02em] text-white">
                      {isRateLimited
                        ? "oh- well that didn't work 🙁"
                        : "Lookup didn't complete"}
                    </h3>

                    <p className="relative mx-auto mt-1.5 max-w-[320px] text-[13.5px] leading-relaxed text-[#98989D]">
                      {isRateLimited
                        ? "Too many people are searching at once! I'm working to get it fixed"
                        : errorMessage}
                    </p>

                    {/* Report issue button with GPU-composited pulsing red border glow */}
                    <motion.a
                      href="https://instagram.com/enjay404"
                      target="_blank"
                      rel="noopener noreferrer"
                      whileTap={{ scale: 0.97 }}
                      transition={SPRING_BUTTON}
                      className="relative mt-4 flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-2xl border border-[#FF453A]/45 bg-[#FF453A]/[0.08] px-4 py-3 text-[14px] font-semibold text-white transition-colors duration-150 hover:bg-[#FF453A]/[0.14] active:bg-[#FF453A]/[0.2] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF453A]"
                    >
                      <motion.span
                        aria-hidden="true"
                        animate={{ opacity: [0.35, 1, 0.35] }}
                        transition={{
                          duration: 2.2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                        className="pointer-events-none absolute -inset-[1px] rounded-2xl border border-[#FF453A] shadow-[0_0_16px_rgba(255,69,58,0.45)]"
                      />
                      <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF453A] opacity-65" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF453A]" />
                      </span>
                      <span className="relative">Report it&apos;s not working</span>
                    </motion.a>

                    {/* Full-width solid white rounded-2xl pill CTA */}
                    <motion.button
                      type="button"
                      onClick={handleRetry}
                      whileTap={{ scale: 0.97 }}
                      transition={SPRING_BUTTON}
                      className="relative mt-4 flex min-h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-5 text-[16px] font-semibold tracking-[-0.01em] text-black transition-colors duration-150 active:bg-[#2C2C2E] active:text-white focus-visible:outline-none"
                    >
                      <RotateCcw className="h-4 w-4 stroke-[2.2]" />
                      <span>Try again</span>
                    </motion.button>
                  </div>
                )}

                {!isLoading && !errorMessage && hasSearched && results.length === 0 && (
                  <EmptySearchView
                    query={trimmedQuery}
                    onClearSearch={handleClearInput}
                    onPasteLink={() => void handlePasteFromClipboard()}
                  />
                )}

                {!isLoading && !errorMessage && results.length > 0 && (
                  <section aria-label="Search results" className="pt-1">
                    <div className="flex items-center justify-between px-1 pb-2">
                      <h2 className="text-[13px] font-semibold tracking-wide text-[#8E8E93]">
                        {isLinkMode ? 'Matched Track' : 'Results · Tap to Copy ISRC'}
                      </h2>
                    </div>
                    <div className="liquid-glass overflow-hidden rounded-[20px]">
                      {results.map((track, index) => (
                        <TrackRow
                          key={track.id}
                          track={track}
                          index={index}
                          onSelect={handleSelectTrack}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            ) : (
              <div className="space-y-5 pt-1">
                {/* Last Copied Quick-Grab Strip (slimmer secondary hierarchy under hero search bar) */}
                {lastCopiedTrack?.isrc && (
                  <section aria-label="Last copied ISRC">
                    <motion.button
                      type="button"
                      onClick={handleQuickCopyLast}
                      whileTap={{ scale: 0.97 }}
                      transition={SPRING_BUTTON}
                      style={{
                        background: 'rgba(28, 28, 30, 0.78)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                      }}
                      className="group flex w-full items-center justify-between gap-3 rounded-[12px] px-3.5 py-2.5 text-left text-xs transition-colors duration-100 hover:bg-white/[0.04] active:bg-[#2C2C2E]/75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25"
                    >
                      <span className="text-xs font-medium text-[#8E8E93]">
                        Last copied
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="font-mono-isrc whitespace-nowrap text-xs font-medium tracking-[0.02em] text-[#D1D1D6]">
                          {formatIsrcCode(lastCopiedTrack.isrc)}
                        </span>
                        <Copy className="h-3.5 w-3.5 shrink-0 text-[#30D158] transition-transform duration-150 group-hover:scale-105" />
                      </span>
                    </motion.button>
                  </section>
                )}

                {/* Recent History Inset Grouped Liquid Glass Card */}
                {recentTracks.length > 0 && (
                  <TrackListSection
                    title="Recent"
                    ariaLabel="Recent copied tracks"
                    tracks={recentTracks}
                    onSelect={handleSelectTrack}
                    onClear={handleClearRecent}
                  />
                )}

                {/* Popular Hits Inset Grouped Liquid Glass Card */}
                {(isQuickTryLoading || quickTryTracks.length > 0) && (
                  <TrackListSection
                    title="POPULAR HITS"
                    ariaLabel="Popular Hits"
                    tracks={quickTryTracks}
                    isLoading={isQuickTryLoading}
                    skeletonCount={5}
                    onSelect={handleSelectTrack}
                  />
                )}
              </div>
            )}
          </main>

        </motion.div>

        {/* Pinned Floating Creator Footer Dock (z-20: above content, covered by BottomSheet z-40) */}
        <FooterDock />

        {/* Offline Status Indicator */}
        {!isOnline && (
          <div className="fixed bottom-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-[#FF9F0A]/40 bg-[#1C1C1E]/95 px-3.5 py-2 text-[12px] font-medium text-[#FF9F0A] shadow-lg">
            <WifiOff className="h-3.5 w-3.5" />
            <span>Offline — Recent tracks still available</span>
          </div>
        )}

        <BottomSheet
          track={selectedTrack}
          autoCopiedSignal={autoCopiedSignal}
          onClose={handleCloseSheet}
          onCopied={handleBottomSheetCopied}
          onSearchOtherVersions={handleSearchOtherVersions}
        />
        <Analytics />
      </div>
    </MotionConfig>
  );
}
