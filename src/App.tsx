import { MotionConfig, motion } from 'motion/react';
import {
  ClipboardPaste,
  Link2,
  Music2,
  RotateCcw,
  Search,
  WifiOff,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomSheet } from './components/BottomSheet';
import { DynamicIslandToast, type ToastState } from './components/DynamicIslandToast';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SkeletonRows } from './components/SkeletonRows';
import { TrackRow } from './components/TrackRow';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import type { SearchApiResponse, TrackApiResponse, TrackItem } from './types/track';
import {
  clearRecentTracksStorage,
  formatIsrcCode,
  isSpotifyTrackLink,
  loadRecentTracks,
  saveRecentTrack,
  syncCopyIsrc,
} from './utils/spotifyInput';

const SPRING_BUTTON = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 30,
};

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
  const isOnline = useOnlineStatus();

  const trimmedQuery = query.trim();
  const isLinkMode = isSpotifyTrackLink(trimmedQuery);

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
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setErrorMessage(null);

      try {
        if (mode === 'link') {
          const res = await fetch(`/api/track?input=${encodeURIComponent(rawInput)}`, {
            signal: controller.signal,
          });
          const payload = (await res.json()) as TrackApiResponse & { error?: string };
          if (!res.ok) {
            throw new Error(payload.error || 'Could not load that Spotify track.');
          }

          const track = payload.track;
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
            throw new Error(payload.error || 'Unable to search Spotify right now.');
          }

          setResults(payload.tracks);
          setHasSearched(true);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Something went wrong. Please try again.';
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
      setResults([]);
      setIsLoading(false);
      setErrorMessage(null);
      setHasSearched(false);
      return;
    }

    if (isLinkMode) {
      void executeLookup(trimmedQuery, 'link');
      return;
    }

    const timer = window.setTimeout(() => {
      void executeLookup(trimmedQuery, 'search');
    }, 300);

    return () => window.clearTimeout(timer);
  }, [trimmedQuery, isLinkMode, executeLookup]);

  const handleSelectTrack = useCallback(
    (track: TrackItem, copiedSync: boolean) => {
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

  const handlePasteFromClipboard = async () => {
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
  };

  const handleClearInput = () => {
    setQuery('');
    setResults([]);
    setErrorMessage(null);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  const handleClearRecent = () => {
    clearRecentTracksStorage();
    setRecentTracks([]);
    showToast('Recent history cleared', 'info');
  };

  const handleSearchOtherVersions = (track: TrackItem) => {
    setSelectedTrack(null);
    const nextQuery = `${track.name} ${track.primaryArtist}`.trim();
    setQuery(nextQuery);
  };

  const handleRetry = () => {
    if (!trimmedQuery) return;
    void executeLookup(trimmedQuery, isLinkMode ? 'link' : 'search');
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-dvh bg-black text-white">
        {/* Fixed Ambient Background Glow behind top 35% so Liquid Glass surfaces refract real depth */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[42vh]"
          style={{
            background:
              'radial-gradient(68% 72% at 22% 14%, rgba(48, 209, 88, 0.11) 0%, transparent 72%), radial-gradient(75% 78% at 78% 18%, rgba(58, 75, 115, 0.14) 0%, transparent 75%)',
          }}
        />

        <DynamicIslandToast toast={toast} />

        <div
          className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[480px] flex-col"
          style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
        >
          {/* Native iOS Large Title Header */}
          <header
            className="flex items-end justify-between px-4 pb-3"
            style={{ paddingTop: 'max(18px, env(safe-area-inset-top))' }}
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8E8E93]">
                SPOTIFY → INSTAGRAM ISRC
              </p>
              <h1 className="mt-1 text-[34px] font-bold leading-[1.08] tracking-[-0.03em] text-white">
                TrackCode
              </h1>
            </div>

            <div className="pb-0.5">
              <PWAInstallButton />
            </div>
          </header>

          {/* Floating Sticky Liquid Glass Search Bar */}
          <div className="sticky top-0 z-20 px-4 py-2">
            <div className="liquid-glass relative flex items-center rounded-[16px] shadow-[0_10px_28px_rgba(0,0,0,0.45)] focus-within:ring-1 focus-within:ring-white/25 transition-shadow">
              <span className="pointer-events-none flex pl-3.5 text-[#8E8E93]">
                {isLinkMode ? (
                  <Link2 className="h-[18px] w-[18px] text-[#30D158]" />
                ) : (
                  <Search className="h-[18px] w-[18px]" />
                )}
              </span>

              <input
                ref={inputRef}
                type="search"
                inputMode="search"
                enterKeyHint="search"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Song, artist, or Spotify link"
                aria-label="Search song, artist, or paste Spotify link"
                className="min-h-[46px] w-full bg-transparent px-2.5 py-2.5 text-[16px] text-white placeholder:text-[#8E8E93] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              />

              {query.length === 0 ? (
                <motion.button
                  type="button"
                  onClick={() => void handlePasteFromClipboard()}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING_BUTTON}
                  className="mr-1.5 flex min-h-[34px] min-w-[44px] shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.1] px-3 text-[13px] font-semibold text-white active:bg-white/[0.18]"
                >
                  <ClipboardPaste className="h-3.5 w-3.5 text-[#30D158]" />
                  <span>Paste</span>
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  onClick={handleClearInput}
                  whileTap={{ scale: 0.97 }}
                  transition={SPRING_BUTTON}
                  aria-label="Clear search"
                  className="flex h-[44px] w-[44px] shrink-0 items-center justify-center text-[#8E8E93]"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-black">
                    <X className="h-3.5 w-3.5 stroke-[2.6]" />
                  </span>
                </motion.button>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          <main className="flex-1 px-4 pt-2 pb-6">
            {trimmedQuery ? (
              <>
                {isLoading && (
                  <div className="liquid-glass overflow-hidden rounded-[20px]">
                    <SkeletonRows count={6} />
                  </div>
                )}

                {!isLoading && errorMessage && (
                  <div className="liquid-glass rounded-[20px] p-5 text-center">
                    <p className="text-[15px] font-semibold text-white">
                      Lookup didn&apos;t complete
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[#8E8E93]">
                      {errorMessage}
                    </p>
                    <motion.button
                      type="button"
                      onClick={handleRetry}
                      whileTap={{ scale: 0.97 }}
                      transition={SPRING_BUTTON}
                      className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-[14px] font-semibold text-white active:bg-white/20"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Try again</span>
                    </motion.button>
                  </div>
                )}

                {!isLoading && !errorMessage && hasSearched && results.length === 0 && (
                  <div className="liquid-glass rounded-[20px] px-5 py-10 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-[#8E8E93]">
                      <Music2 className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-[15px] font-semibold text-white">
                      No matching tracks
                    </p>
                    <p className="mt-1 text-[13px] text-[#8E8E93]">
                      Try adding the artist name or pasting a Spotify share link.
                    </p>
                  </div>
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
                {/* Visual Output Preview Banner */}
                <section aria-label="Instagram Music Search Preview">
                  <div className="liquid-glass rounded-[20px] p-4 shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
                    <div className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-black/55 px-3.5 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Search className="h-4 w-4 shrink-0 text-[#8E8E93]" />
                        <span className="font-mono-isrc truncate text-[14px] font-semibold tracking-[0.02em] text-white">
                          ISRC:USUM71900764
                        </span>
                      </div>

                      {/* Subtle animated 3-bar audio equalizer */}
                      <div
                        aria-hidden="true"
                        className="flex h-4 shrink-0 items-end gap-[3px] pr-0.5"
                      >
                        <span className="eq-bar-1 h-3.5 w-[3px] rounded-full bg-[#30D158]" />
                        <span className="eq-bar-2 h-4 w-[3px] rounded-full bg-[#30D158]" />
                        <span className="eq-bar-3 h-3 w-[3px] rounded-full bg-[#30D158]" />
                      </div>
                    </div>

                    <p className="mt-2.5 px-1 text-[13px] leading-snug text-[#AEAEB2]">
                      Instant ISRC lookup for hidden Story &amp; Note tracks.
                    </p>
                  </div>
                </section>

                {/* Recent History Inset Grouped Liquid Glass Card */}
                {recentTracks.length > 0 && (
                  <section aria-label="Recent copied tracks">
                    <div className="flex items-center justify-between px-1 pb-1.5">
                      <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#8E8E93]">
                        Recent
                      </h2>
                      <motion.button
                        type="button"
                        onClick={handleClearRecent}
                        whileTap={{ scale: 0.97 }}
                        transition={SPRING_BUTTON}
                        className="flex min-h-[36px] items-center rounded-lg px-2 text-[13px] font-medium text-[#30D158] active:bg-white/10"
                      >
                        Clear
                      </motion.button>
                    </div>
                    <div className="liquid-glass overflow-hidden rounded-[20px]">
                      {recentTracks.map((track, index) => (
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

                {/* Quick Try Tracks Inset Grouped Liquid Glass Card */}
                {(isQuickTryLoading || quickTryTracks.length > 0) && (
                  <section aria-label="Quick Try popular tracks">
                    <div className="flex items-center justify-between px-1 pb-1.5">
                      <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[#8E8E93]">
                        Quick Try
                      </h2>
                    </div>
                    <div className="liquid-glass overflow-hidden rounded-[20px]">
                      {isQuickTryLoading ? (
                        <SkeletonRows count={4} />
                      ) : (
                        quickTryTracks.map((track, index) => (
                          <TrackRow
                            key={track.id}
                            track={track}
                            index={index}
                            onSelect={handleSelectTrack}
                          />
                        ))
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}
          </main>

          {/* Custom Creator Footer */}
          <footer className="mt-auto flex justify-center px-4 pt-2 pb-2">
            <motion.a
              href="https://instagram.com/enjay404"
              target="_blank"
              rel="noopener noreferrer"
              whileTap={{ scale: 0.96 }}
              transition={SPRING_BUTTON}
              className="liquid-glass inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-4 py-2 text-[12px] text-[#AEAEB2] transition-colors hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
            >
              <span>Made with ❤️ by</span>
              <span className="font-medium text-white">enjay404</span>
            </motion.a>
          </footer>

          {/* Offline Status Indicator */}
          {!isOnline && (
            <div className="fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[#FF9F0A]/40 bg-[#1C1C1E]/95 px-3.5 py-2 text-[12px] font-medium text-[#FF9F0A] shadow-lg">
              <WifiOff className="h-3.5 w-3.5" />
              <span>Offline — Recent tracks still available</span>
            </div>
          )}
        </div>

        <BottomSheet
          track={selectedTrack}
          autoCopiedSignal={autoCopiedSignal}
          onClose={() => setSelectedTrack(null)}
          onCopied={(isrc) => showToast(`Copied ${formatIsrcCode(isrc)}`, 'success')}
          onSearchOtherVersions={handleSearchOtherVersions}
        />
      </div>
    </MotionConfig>
  );
}
