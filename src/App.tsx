import { Analytics } from '@vercel/analytics/react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Copy,
  Globe,
  Link2,
  RotateCcw,
  Search,
  Share,
  WifiOff,
  X,
} from 'lucide-react';
import {
  type ReactNode,
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DesktopInspectorCard } from './components/DesktopInspectorCard';
import { DynamicIslandToast, type ToastState } from './components/DynamicIslandToast';
import { FooterDock } from './components/FooterDock';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SkeletonRows } from './components/SkeletonRows';
import { SriLankaFlag } from './components/SriLankaFlag';
import { TrackRow } from './components/TrackRow';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import type {
  ApiHealthStatus,
  ApiStatusState,
  ChartRegion,
  QuickTryApiResponse,
  SearchApiResponse,
  TrackApiResponse,
  TrackItem,
} from './types/track';
import { SPRING_BUTTON } from './utils/motionConfig';
import {
  clearRecentTracksStorage,
  copyIsrcVerified,
  formatIsrcCode,
  getCachedSearchResult,
  getCachedTrackIsrc,
  hydrateTracksWithCachedIsrc,
  isSpotifyTrackLink,
  loadCachedQuickTryCharts,
  loadRecentTracks,
  saveCachedQuickTryCharts,
  saveRecentTrack,
  setCachedSearchResult,
  setCachedTrackIsrc,
  syncQuickTryChartHistory,
} from './utils/spotifyInput';

const BottomSheet = lazy(() => import('./components/BottomSheet'));
const EmptySearchView = lazy(() => import('./components/EmptySearchView'));
const MaintenancePage = lazy(() => import('./components/MaintenancePage'));

const FORCE_MAINTENANCE = false;

const PLACEHOLDER_MESSAGES = [
  'Search song, artist, or Spotify link',
  'Paste open.spotify.com or spotify.link',
] as const;

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handleChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  return isDesktop;
}

const RegionSegmentedToggle = memo(function RegionSegmentedToggle({
  region,
  onChange,
}: {
  region: ChartRegion;
  onChange: (next: ChartRegion) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Popular Hits region"
      className="relative mb-3 grid w-full grid-cols-2 rounded-2xl border border-white/[0.08] bg-[#131315] p-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]"
    >
      <span
        aria-hidden="true"
        style={{
          transform:
            region === 'global' ? 'translate3d(0%, 0, 0)' : 'translate3d(100%, 0, 0)',
        }}
        className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl border border-white/[0.15] border-t-white/[0.28] bg-gradient-to-b from-[#262629] to-[#1A1A1D] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_4px_12px_rgba(0,0,0,0.4)] transition-transform duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
      />

      <button
        type="button"
        role="tab"
        aria-selected={region === 'global'}
        onClick={() => onChange('global')}
        className={`relative z-10 flex min-h-[36px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl py-2 text-[12.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/35 ${
          region === 'global'
            ? 'font-semibold text-white'
            : 'font-medium text-white/50 hover:text-white/80'
        }`}
      >
        <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Global</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={region === 'sriLanka'}
        onClick={() => onChange('sriLanka')}
        className={`relative z-10 flex min-h-[36px] cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl py-2 text-[12.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/35 ${
          region === 'sriLanka'
            ? 'font-semibold text-white'
            : 'font-medium text-white/50 hover:text-white/80'
        }`}
      >
        <SriLankaFlag />
        <span>Sri Lanka</span>
      </button>
    </div>
  );
});

interface TrackListSectionProps {
  title: string;
  subtitle?: string;
  headerControl?: ReactNode;
  footerControl?: ReactNode;
  listKeyPrefix?: string;
  ariaLabel: string;
  tracks: TrackItem[];
  selectedTrackId?: string | null;
  showRanks?: boolean;
  isLoading?: boolean;
  skeletonCount?: number;
  onSelect: (track: TrackItem, copied: boolean) => void;
  onClear?: () => void;
}

const TrackListSection = memo(function TrackListSection({
  title,
  subtitle,
  headerControl,
  footerControl,
  listKeyPrefix,
  ariaLabel,
  tracks,
  selectedTrackId = null,
  showRanks = false,
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
        {onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="flex min-h-[36px] cursor-pointer items-center rounded-lg px-2 text-[13px] font-medium text-[#30D158] transition-transform duration-150 active:scale-[0.97] active:bg-white/10"
          >
            Clear
          </button>
        ) : subtitle ? (
          <span className="animate-updated-shimmer shrink-0 text-[10.5px] font-medium uppercase tracking-wider">
            {subtitle}
          </span>
        ) : null}
      </div>
      {headerControl}
      <div className="touch-pan-y space-y-2">
        {isLoading ? (
          <SkeletonRows count={skeletonCount} />
        ) : (
          tracks.map((track, index) => (
            <TrackRow
              key={listKeyPrefix ? `${listKeyPrefix}-${track.id}` : track.id}
              track={track}
              index={index}
              isSelected={selectedTrackId === track.id}
              showRank={showRanks}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
      {!isLoading && footerControl}
    </section>
  );
});

const STATUS_STYLES: Record<
  ApiHealthStatus,
  { color: string; glow: string; label: string }
> = {
  online: {
    color: '#30D158',
    glow: 'rgba(48, 209, 88, 0.55)',
    label: 'Online',
  },
  limited: {
    color: '#FF9F0A',
    glow: 'rgba(255, 159, 10, 0.55)',
    label: 'Limited',
  },
  down: {
    color: '#FF453A',
    glow: 'rgba(255, 69, 58, 0.55)',
    label: 'Down',
  },
};

const StatusDot = memo(function StatusDot({ color, glow }: { color: string; glow: string }) {
  return (
    <span className="relative flex h-2 w-2 shrink-0 items-center justify-center" aria-hidden="true">
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex h-2 w-2 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 8px ${glow}`,
        }}
      />
    </span>
  );
});

const ApiStatusPill = memo(function ApiStatusPill({ status }: { status: ApiStatusState }) {
  const spotifyMeta = STATUS_STYLES[status.spotify];
  const deezerMeta = STATUS_STYLES[status.deezer === 'down' ? 'down' : 'online'];

  return (
    <div className="flex justify-center pt-1 lg:pt-0" aria-label="API service status">
      <div className="inline-flex items-center gap-2.5 rounded-full border border-white/[0.09] bg-white/[0.04] px-3.5 py-1.5 text-[11.5px] leading-none lg:min-h-[38px] lg:px-4">
        <span className="inline-flex items-center gap-1.5">
          <StatusDot color={spotifyMeta.color} glow={spotifyMeta.glow} />
          <span className="font-medium text-white/85">Spotify</span>
          <span className="text-[#8E8E93]">{spotifyMeta.label}</span>
        </span>
        <span aria-hidden="true" className="h-3 w-[1px] bg-white/10" />
        <span className="inline-flex items-center gap-1.5">
          <StatusDot color={deezerMeta.color} glow={deezerMeta.glow} />
          <span className="font-medium text-white/85">Deezer</span>
          <span className="text-[#8E8E93]">{deezerMeta.label}</span>
        </span>
      </div>
    </div>
  );
});

function deriveApiStatus(meta: {
  source?: 'spotify' | 'deezer';
  spotifyHealthy?: boolean;
  deezerHealthy?: boolean;
}): ApiStatusState | null {
  if (
    typeof meta.spotifyHealthy !== 'boolean' &&
    typeof meta.deezerHealthy !== 'boolean' &&
    !meta.source
  ) {
    return null;
  }
  const deezerDown = meta.deezerHealthy === false;
  const spotifyOnline = meta.spotifyHealthy === true;
  return {
    spotify: spotifyOnline ? 'online' : deezerDown ? 'down' : 'limited',
    deezer: deezerDown ? 'down' : 'online',
  };
}

function TrackCodeWorkspace() {
  const isDesktop = useIsDesktop();
  const [query, setQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [results, setResults] = useState<TrackItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [popularRegion, setPopularRegion] = useState<ChartRegion>('global');
  const [showAllHits, setShowAllHits] = useState(false);
  const [quickTryCharts, setQuickTryCharts] = useState(() => loadCachedQuickTryCharts());
  const [isQuickTryLoading, setIsQuickTryLoading] = useState(() => {
    const cached = loadCachedQuickTryCharts();
    return cached.global.length === 0 && cached.sriLanka.length === 0;
  });
  const activeQuickTryTracks =
    popularRegion === 'global' ? quickTryCharts.global : quickTryCharts.sriLanka;
  const displayedQuickTryTracks = useMemo(
    () => (showAllHits ? activeQuickTryTracks : activeQuickTryTracks.slice(0, 5)),
    [activeQuickTryTracks, showAllHits]
  );

  const handleRegionChange = useCallback((nextRegion: ChartRegion) => {
    setPopularRegion(nextRegion);
    setShowAllHits(false);
  }, []);

  const [recentTracks, setRecentTracks] = useState<TrackItem[]>(() => loadRecentTracks());
  const [sheetTrack, setSheetTrack] = useState<TrackItem | null>(null);
  const [inspectedTrack, setInspectedTrack] = useState<TrackItem | null>(null);
  const [fetchingIsrcTrackId, setFetchingIsrcTrackId] = useState<string | null>(null);
  const [autoCopiedSignal, setAutoCopiedSignal] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatusState>({
    spotify: 'online',
    deezer: 'online',
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isrcAbortControllerRef = useRef<AbortController | null>(null);
  const fetchingTrackIdRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const skipNextAutoLookupRef = useRef<string | null>(null);
  const isDesktopRef = useRef(isDesktop);
  isDesktopRef.current = isDesktop;

  const isOnline = useOnlineStatus();
  const trimmedQuery = query.trim();
  const isLinkMode = isSpotifyTrackLink(trimmedQuery);
  const lastCopiedTrack = recentTracks.find((item) => Boolean(item.isrc)) ?? null;

  const visibleTracks = useMemo(() => {
    if (trimmedQuery) {
      return results;
    }
    const seen = new Set<string>();
    const combined: TrackItem[] = [];
    for (const item of [...recentTracks, ...displayedQuickTryTracks]) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        combined.push(item);
      }
    }
    return combined;
  }, [trimmedQuery, results, recentTracks, displayedQuickTryTracks]);

  const activeDesktopTrack = useMemo(() => {
    if (inspectedTrack && visibleTracks.some((t) => t.id === inspectedTrack.id)) {
      return inspectedTrack;
    }
    if (trimmedQuery && results.length === 0) {
      return inspectedTrack ?? recentTracks[0] ?? displayedQuickTryTracks[0] ?? null;
    }
    return visibleTracks[0] ?? inspectedTrack ?? null;
  }, [inspectedTrack, visibleTracks, trimmedQuery, results.length, recentTracks, displayedQuickTryTracks]);

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

    fetch('/api/quick-try')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: QuickTryApiResponse | null) => {
        if (!cancelled && data) {
          const rawGlobal = Array.isArray(data.global) ? data.global : [];
          const rawSriLanka = Array.isArray(data.sriLanka) ? data.sriLanka : [];
          if (rawGlobal.length > 0 || rawSriLanka.length > 0) {
            const nextCharts = {
              global: rawGlobal.length > 0 ? syncQuickTryChartHistory(rawGlobal, 'global') : [],
              sriLanka:
                rawSriLanka.length > 0 ? syncQuickTryChartHistory(rawSriLanka, 'sriLanka') : [],
            };
            setQuickTryCharts(nextCharts);
            saveCachedQuickTryCharts(nextCharts);
          }
        }
      })
      .catch(() => {
        // Offline snapshot already loaded if available
      })
      .finally(() => {
        if (!cancelled) {
          setIsQuickTryLoading(false);
        }
      });

    // Warm up lazy mobile BottomSheet chunk after initial paint on smaller viewports
    const warmTimer = window.setTimeout(() => {
      if (!isDesktopRef.current) {
        void import('./components/BottomSheet');
      }
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(warmTimer);
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
      if (isrcAbortControllerRef.current) {
        isrcAbortControllerRef.current.abort();
      }
    };
  }, []);

  // Desktop Spotlight keyboard navigation (⌘K / / to focus, ↑/↓ to navigate, Enter to copy ISRC)
  useEffect(() => {
    if (!isDesktop) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }

      if (e.key === '/' && !isInputFocused && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (visibleTracks.length === 0) return;
        e.preventDefault();
        const currentIdx = activeDesktopTrack
          ? visibleTracks.findIndex((t) => t.id === activeDesktopTrack.id)
          : -1;
        const nextIdx =
          e.key === 'ArrowDown'
            ? currentIdx < 0
              ? 0
              : Math.min(visibleTracks.length - 1, currentIdx + 1)
            : currentIdx <= 0
              ? 0
              : currentIdx - 1;
        const nextTrack = visibleTracks[nextIdx];
        if (nextTrack) {
          setInspectedTrack(nextTrack);
          setAutoCopiedSignal(0);
          const rowEl = document.querySelector<HTMLElement>(
            `[data-track-id="${CSS.escape(nextTrack.id)}"]`
          );
          rowEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (target?.closest('button, a')) {
          return;
        }
        // When typing an unsearched text query inside the input, let form submit trigger search
        if (isInputFocused && trimmedQuery.length > 0 && !hasSearched) {
          return;
        }
        if (activeDesktopTrack?.isrc) {
          e.preventDefault();
          void copyIsrcVerified(activeDesktopTrack.isrc).then((copied) => {
            if (copied) {
              setRecentTracks(saveRecentTrack(activeDesktopTrack));
              setAutoCopiedSignal((s) => s + 1);
              showToast(`Copied ${formatIsrcCode(activeDesktopTrack.isrc!)}`, 'success');
            } else {
              showToast('Press Copy ISRC in the inspector to copy', 'info');
            }
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDesktop, visibleTracks, activeDesktopTrack, trimmedQuery, hasSearched, showToast]);

  const executeLookup = useCallback(
    async (rawInput: string, mode: 'link' | 'search') => {
      if (mode === 'search') {
        const cached = getCachedSearchResult(rawInput);
        if (cached) {
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
          const nextStatus = deriveApiStatus(cached);
          if (nextStatus) {
            setApiStatus(nextStatus);
          }
          const hydratedTracks = hydrateTracksWithCachedIsrc(cached.tracks);
          setResults(hydratedTracks);
          if (hydratedTracks.length > 0) {
            setInspectedTrack(hydratedTracks[0]);
          }
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
          const payload = (await res.json().catch(() => ({}))) as TrackApiResponse & {
            error?: string;
          };

          const nextStatus = deriveApiStatus(payload);
          if (nextStatus) {
            setApiStatus(nextStatus);
          }

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
          setInspectedTrack(track);
          if (!isDesktopRef.current) {
            setSheetTrack(track);
          }

          if (track.isrc) {
            setCachedTrackIsrc(track.id, track.isrc);
            const copied = await copyIsrcVerified(track.isrc);
            setRecentTracks(saveRecentTrack(track));
            if (copied) {
              setAutoCopiedSignal((s) => s + 1);
              showToast(`Copied ${formatIsrcCode(track.isrc)}`, 'success');
            } else {
              setAutoCopiedSignal(0);
              showToast('Tap Copy ISRC to copy', 'info');
            }
          } else {
            setAutoCopiedSignal(0);
            showToast('No ISRC found for this upload', 'info');
          }
        } else {
          const res = await fetch(`/api/search?q=${encodeURIComponent(rawInput)}`, {
            signal: controller.signal,
          });
          const payload = (await res.json().catch(() => ({}))) as
            | TrackItem[]
            | (SearchApiResponse & { error?: string });

          const meta: Partial<SearchApiResponse> & { error?: string } = Array.isArray(payload)
            ? {}
            : payload;
          const nextStatus = deriveApiStatus(meta);
          if (nextStatus) {
            setApiStatus(nextStatus);
          }

          if (!res.ok) {
            if (res.status === 429 || res.status >= 500) {
              setIsRateLimited(true);
            }
            throw new Error(meta.error || 'Unable to search right now.');
          }

          const rawTracks = Array.isArray(payload)
            ? payload
            : Array.isArray(payload.tracks)
              ? payload.tracks
              : [];
          const tracks = hydrateTracksWithCachedIsrc(rawTracks);

          setCachedSearchResult(rawInput, {
            tracks,
            source: meta.source,
            spotifyHealthy: meta.spotifyHealthy,
            deezerHealthy: meta.deezerHealthy,
          });
          setResults(tracks);
          if (tracks.length > 0) {
            setInspectedTrack(tracks[0]);
            setAutoCopiedSignal(0);
          }
          setHasSearched(true);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const isOfflineError =
          (typeof navigator !== 'undefined' && !navigator.onLine) || err instanceof TypeError;
        if (isOfflineError) {
          setIsRateLimited(true);
        }
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

    const cached = getCachedSearchResult(trimmedQuery);
    if (cached) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const nextStatus = deriveApiStatus(cached);
      if (nextStatus) {
        setApiStatus(nextStatus);
      }
      const hydratedTracks = hydrateTracksWithCachedIsrc(cached.tracks);
      setResults(hydratedTracks);
      if (hydratedTracks.length > 0) {
        setInspectedTrack(hydratedTracks[0]);
        setAutoCopiedSignal(0);
      }
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

  const fetchIsrcOnDemand = useCallback((targetTrack: TrackItem) => {
    if (targetTrack.isrc) return;

    const cachedIsrc = getCachedTrackIsrc(targetTrack.id);
    if (cachedIsrc !== undefined) {
      if (cachedIsrc) {
        const patchTrack = (item: TrackItem) =>
          item.id === targetTrack.id ? { ...item, isrc: cachedIsrc } : item;
        setResults((prev) => prev.map(patchTrack));
        setInspectedTrack((prev) => (prev ? patchTrack(prev) : prev));
        setSheetTrack((prev) => (prev ? patchTrack(prev) : prev));
      }
      return;
    }

    if (fetchingTrackIdRef.current === targetTrack.id) {
      return;
    }

    if (isrcAbortControllerRef.current) {
      isrcAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    isrcAbortControllerRef.current = controller;
    fetchingTrackIdRef.current = targetTrack.id;
    setFetchingIsrcTrackId(targetTrack.id);

    const source =
      targetTrack.source ?? (targetTrack.id.startsWith('dz-') ? 'deezer' : 'spotify');

    void fetch(
      `/api/isrc?id=${encodeURIComponent(targetTrack.id)}&source=${encodeURIComponent(source)}`,
      { signal: controller.signal }
    )
      .then((res) => (res.ok ? (res.json() as Promise<{ isrc?: string | null }>) : { isrc: null }))
      .then((data) => {
        if (controller.signal.aborted) return;
        const resolvedIsrc =
          typeof data.isrc === 'string' && data.isrc.trim()
            ? data.isrc.trim().toUpperCase()
            : null;

        setCachedTrackIsrc(targetTrack.id, resolvedIsrc);
        const patchTrack = (item: TrackItem) =>
          item.id === targetTrack.id ? { ...item, isrc: resolvedIsrc } : item;

        setResults((prev) => prev.map(patchTrack));
        setInspectedTrack((prev) => (prev ? patchTrack(prev) : prev));
        setSheetTrack((prev) => (prev ? patchTrack(prev) : prev));

        if (resolvedIsrc) {
          setRecentTracks(saveRecentTrack({ ...targetTrack, isrc: resolvedIsrc }));
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
      })
      .finally(() => {
        if (fetchingTrackIdRef.current === targetTrack.id) {
          fetchingTrackIdRef.current = null;
        }
        if (!controller.signal.aborted) {
          setFetchingIsrcTrackId((curr) => (curr === targetTrack.id ? null : curr));
        }
      });
  }, []);

  useEffect(() => {
    const activeTrack = isDesktop ? activeDesktopTrack : sheetTrack;
    if (!activeTrack || activeTrack.isrc) return;
    if (getCachedTrackIsrc(activeTrack.id) !== undefined) return;
    fetchIsrcOnDemand(activeTrack);
  }, [isDesktop, activeDesktopTrack, sheetTrack, fetchIsrcOnDemand]);

  const handleSelectTrack = useCallback(
    (track: TrackItem, copied: boolean) => {
      const cachedIsrc = track.isrc ?? getCachedTrackIsrc(track.id);
      const effectiveTrack =
        typeof cachedIsrc === 'string' && cachedIsrc && !track.isrc
          ? { ...track, isrc: cachedIsrc }
          : track;

      if (!isDesktopRef.current) {
        (document.activeElement as HTMLElement | null)?.blur();
        setSheetTrack(effectiveTrack);
      }
      setInspectedTrack(effectiveTrack);

      if (effectiveTrack.isrc) {
        if (isrcAbortControllerRef.current) {
          isrcAbortControllerRef.current.abort();
        }
        fetchingTrackIdRef.current = null;
        setFetchingIsrcTrackId(null);
        setRecentTracks(saveRecentTrack(effectiveTrack));
        if (copied) {
          setAutoCopiedSignal((s) => s + 1);
          showToast(`Copied ${formatIsrcCode(effectiveTrack.isrc)}`, 'success');
        } else {
          setAutoCopiedSignal(0);
        }
      } else {
        setAutoCopiedSignal(0);
        if (cachedIsrc === undefined) {
          fetchIsrcOnDemand(effectiveTrack);
        }
      }
    },
    [showToast, fetchIsrcOnDemand]
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
    setSheetTrack(null);
    const nextQuery = `${track.name} ${track.primaryArtist}`.trim();
    setQuery(nextQuery);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSheetTrack(null);
  }, []);

  const handleInspectorCopied = useCallback(
    (isrc: string, copiedTrack?: TrackItem) => {
      if (copiedTrack) {
        setRecentTracks(saveRecentTrack(copiedTrack));
      }
      showToast(`Copied ${formatIsrcCode(isrc)}`, 'success');
    },
    [showToast]
  );

  const handleInspectorCopyFailed = useCallback(() => {
    showToast('Press and hold the code above to copy', 'info');
  }, [showToast]);

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

  const handleQuickCopyLast = async () => {
    if (!lastCopiedTrack?.isrc) return;
    const copied = await copyIsrcVerified(lastCopiedTrack.isrc);
    if (copied && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
    handleSelectTrack(lastCopiedTrack, copied);
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
    <div className="relative min-h-[100dvh] bg-black text-white">
      <DynamicIslandToast toast={toast} />

      <div
        className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-black lg:max-w-5xl lg:px-8"
        style={{
          overflow: 'clip',
        }}
      >
        {/* Breathing Ambient Background Glow behind top ~35% (pure CSS GPU animation) */}
        <div
          aria-hidden="true"
          className="animate-ambient-breathe pointer-events-none absolute inset-x-0 top-0 z-0 h-[42vh]"
          style={{
            transformOrigin: '50% 18%',
            background:
              'radial-gradient(68% 72% at 22% 14%, rgba(48, 209, 88, 0.11) 0%, transparent 72%), radial-gradient(75% 78% at 78% 18%, rgba(58, 75, 115, 0.14) 0%, transparent 75%)',
          }}
        />

        {/* Responsive Header: Mobile Large Title / Desktop Top Bar */}
        <header
          className="relative z-10 flex items-start justify-between px-4 pb-3 lg:items-center lg:px-0 lg:pt-8 lg:pb-6"
          style={{ paddingTop: isDesktop ? undefined : 'max(18px, env(safe-area-inset-top))' }}
        >
          <div className="flex flex-col items-start">
            <h1 className="title-ambient-glow text-[34px] font-bold leading-[1.08] tracking-[-0.03em] text-white">
              TrackCode
            </h1>
            <p className="mt-1 flex items-center gap-1.5 pl-[1.5px] text-[11px] font-semibold uppercase leading-none tracking-[0.14em] text-[#8E8E93]">
              <span>ISRC FINDER</span>
              <SriLankaFlag />
            </p>
          </div>

          <div className="flex items-center gap-2 pt-0.5 lg:gap-3 lg:pt-0">
            <div className="hidden lg:block">
              <ApiStatusPill status={apiStatus} />
            </div>
            <motion.button
              type="button"
              onClick={() => void handleShareApp()}
              whileTap={{ scale: 0.95 }}
              transition={SPRING_BUTTON}
              aria-label="Share TrackCode"
              className="liquid-glass flex h-[44px] w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full text-white transition-colors hover:bg-white/[0.1] active:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
            >
              <Share className="h-[17px] w-[17px] text-[#AEAEB2]" />
            </motion.button>
            <PWAInstallButton />
          </div>
        </header>

        {/* Main Content Workspace: Single-Column Mobile / 12-Col Two-Column Split Desktop */}
        <main className="relative z-10 flex-1 pb-24 lg:pb-4">
          <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-7">
            {/* Left Column (Desktop col-span-7) / Mobile Full Column */}
            <div className="lg:col-span-7">
              {/* Spotlight-Style Search Bar (Sticky on Mobile, Static inside Left Column on Desktop) */}
              <div className="sticky top-0 z-20 px-4 py-2 lg:static lg:mb-5 lg:px-0 lg:py-0">
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
                    <div className="mr-2 flex shrink-0 items-center gap-2">
                      <kbd
                        aria-hidden="true"
                        className="hidden select-none items-center rounded-md border border-white/[0.12] bg-white/[0.06] px-2 py-1 text-[11px] font-medium text-[#8E8E93] lg:inline-flex"
                      >
                        ⌘K
                      </kbd>
                      <motion.button
                        type="button"
                        onClick={() => void handlePasteFromClipboard()}
                        whileTap={{ scale: 0.97 }}
                        transition={SPRING_BUTTON}
                        className="flex min-h-[36px] min-w-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.12] px-3.5 text-[13px] font-semibold text-white active:bg-white/[0.2]"
                      >
                        <ClipboardPaste className="h-3.5 w-3.5 text-[#30D158]" />
                        <span>Paste</span>
                      </motion.button>
                    </div>
                  ) : (
                    <div className="mr-0.5 flex shrink-0 items-center gap-1 lg:mr-1.5">
                      <kbd
                        aria-hidden="true"
                        className="hidden select-none items-center rounded-md border border-white/[0.12] bg-white/[0.06] px-2 py-1 text-[11px] font-medium text-[#8E8E93] lg:inline-flex"
                      >
                        ⌘K
                      </kbd>
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
                        className="relative z-20 flex h-[44px] w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full text-[#8E8E93] active:bg-white/10 focus-visible:outline-none"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-black">
                          <X className="h-3.5 w-3.5 stroke-[2.6]" />
                        </span>
                      </motion.button>
                    </div>
                  )}
                </form>
              </div>

              {/* Search Results / Home Track Lists */}
              <div className="px-4 pt-2 lg:px-0 lg:pt-0">
                {trimmedQuery ? (
                  <>
                    {isLoading && <SkeletonRows count={4} />}

                    {!isLoading && !errorMessage && !hasSearched && !isLinkMode && trimmedQuery.length < 3 && (
                      <div className="liquid-glass rounded-[20px] px-4 py-4 text-center">
                        <p className="text-[13px] text-[#8E8E93]">
                          Type at least <span className="font-medium text-white">3 characters</span> to search, or press <span className="font-medium text-white">Search</span>.
                        </p>
                      </div>
                    )}

                    {!isLoading && errorMessage && (
                      <div className="relative overflow-hidden rounded-[32px] border border-white/[0.12] bg-gradient-to-b from-[#232326] to-[#151517] px-5 pt-3 pb-5 text-center shadow-[0_18px_48px_rgba(0,0,0,0.65)]">
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-x-0 top-0 h-32"
                          style={{
                            background:
                              'radial-gradient(75% 85% at 50% 0%, rgba(255, 255, 255, 0.08) 0%, rgba(255, 159, 10, 0.05) 48%, transparent 100%)',
                          }}
                        />

                        <div className="relative mx-auto mb-4 h-1 w-9 rounded-full bg-white/20" />

                        <h3 className="relative text-[18px] font-semibold tracking-[-0.02em] text-white">
                          {isRateLimited ? "oh- well that didn't work 🙁" : "Link couldn't be read"}
                        </h3>

                        <p className="relative mx-auto mt-1.5 max-w-[320px] text-[13.5px] leading-relaxed text-[#98989D]">
                          {isRateLimited
                            ? "Too many people are searching at once! I'm working to get it fixed"
                            : errorMessage}
                        </p>

                        {isRateLimited ? (
                          <>
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
                          </>
                        ) : (
                          <motion.button
                            type="button"
                            onClick={handleClearInput}
                            whileTap={{ scale: 0.97 }}
                            transition={SPRING_BUTTON}
                            className="relative mt-5 flex min-h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-5 text-[15px] font-semibold tracking-[-0.01em] text-black transition-colors duration-150 active:bg-[#2C2C2E] active:text-white focus-visible:outline-none"
                          >
                            <Search className="h-4 w-4 stroke-[2.2]" />
                            <span>Search by song title instead</span>
                          </motion.button>
                        )}
                      </div>
                    )}

                    {!isLoading && !errorMessage && hasSearched && results.length === 0 && (
                      <Suspense fallback={<SkeletonRows count={3} />}>
                        <EmptySearchView
                          query={trimmedQuery}
                          onClearSearch={handleClearInput}
                          onPasteLink={() => void handlePasteFromClipboard()}
                        />
                      </Suspense>
                    )}

                    {!isLoading && !errorMessage && results.length > 0 && (
                      <section aria-label="Search results" className="pt-1 lg:pt-0">
                        <div className="flex items-center justify-between px-1 pb-2">
                          <h2 className="text-[13px] font-semibold tracking-wide text-[#8E8E93]">
                            {isLinkMode ? 'Matched Track' : 'Results · Tap to Copy ISRC'}
                          </h2>
                          <span className="hidden text-[11.5px] text-[#8E8E93] lg:inline">
                            ↑↓ navigate · Enter copy
                          </span>
                        </div>
                        <div className="touch-pan-y space-y-2">
                          {results.map((track, index) => (
                            <TrackRow
                              key={track.id}
                              track={track}
                              index={index}
                              isSelected={
                                (isDesktop ? activeDesktopTrack?.id : sheetTrack?.id) === track.id
                              }
                              onSelect={handleSelectTrack}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                ) : (
                  <div className="space-y-5 pt-1 lg:pt-0">
                    {/* Last Copied Quick-Grab Strip */}
                    {lastCopiedTrack?.isrc && (
                      <section aria-label="Last copied ISRC">
                        <button
                          type="button"
                          onClick={() => void handleQuickCopyLast()}
                          className="liquid-glass-strip group flex w-full cursor-pointer items-center justify-between gap-3 rounded-[12px] px-3.5 py-2.5 text-left text-xs transition-[transform,background-color] duration-150 hover:bg-white/[0.04] active:scale-[0.985] active:bg-[#2C2C2E]/75 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25"
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
                        </button>
                      </section>
                    )}

                    {/* Recent History Liquid Glass Capsules */}
                    {recentTracks.length > 0 && (
                      <TrackListSection
                        title="Recent"
                        ariaLabel="Recent copied tracks"
                        tracks={recentTracks}
                        selectedTrackId={isDesktop ? activeDesktopTrack?.id : sheetTrack?.id}
                        onSelect={handleSelectTrack}
                        onClear={handleClearRecent}
                      />
                    )}

                    {/* Popular Hits Liquid Glass Capsules */}
                    {(isQuickTryLoading ||
                      quickTryCharts.global.length > 0 ||
                      quickTryCharts.sriLanka.length > 0) && (
                      <TrackListSection
                        title="POPULAR HITS"
                        subtitle="UPDATED DAILY"
                        headerControl={
                          <RegionSegmentedToggle
                            region={popularRegion}
                            onChange={handleRegionChange}
                          />
                        }
                        footerControl={
                          activeQuickTryTracks.length > 5 ? (
                            <button
                              type="button"
                              onClick={() => setShowAllHits((prev) => !prev)}
                              className="mt-2.5 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-white/[0.08] border-t-white/[0.14] bg-gradient-to-b from-[#1C1C1F] to-[#131315] px-4 py-3 text-[13px] font-medium text-white/80 transition-all duration-150 hover:from-[#232326] hover:to-[#17171A] hover:text-white active:scale-[0.985] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
                            >
                              <span>{showAllHits ? 'Show less' : 'Show more'}</span>
                              {showAllHits ? (
                                <ChevronUp className="h-4 w-4 text-white/50" aria-hidden="true" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-white/50" aria-hidden="true" />
                              )}
                            </button>
                          ) : null
                        }
                        listKeyPrefix={popularRegion}
                        ariaLabel="Popular Hits"
                        tracks={displayedQuickTryTracks}
                        selectedTrackId={isDesktop ? activeDesktopTrack?.id : sheetTrack?.id}
                        showRanks={true}
                        isLoading={isQuickTryLoading}
                        skeletonCount={5}
                        onSelect={handleSelectTrack}
                      />
                    )}
                  </div>
                )}

                {/* Mobile & Tablet API Health Pill (< 1024px) */}
                <div className="mt-5 lg:hidden">
                  <ApiStatusPill status={apiStatus} />
                </div>
              </div>
            </div>

            {/* Right Column (Desktop col-span-5): Persistent Live ISRC Inspector Card */}
            <div className="hidden lg:block lg:col-span-5">
              <DesktopInspectorCard
                track={activeDesktopTrack}
                copiedSignal={autoCopiedSignal}
                isLoadingInitial={isQuickTryLoading}
                isFetchingIsrc={
                  Boolean(activeDesktopTrack?.id) &&
                  fetchingIsrcTrackId === activeDesktopTrack?.id
                }
                onCopied={handleInspectorCopied}
                onCopyFailed={handleInspectorCopyFailed}
                onSearchOtherVersions={handleSearchOtherVersions}
              />
            </div>
          </div>
        </main>

        {/* Footer: Fixed bottom dock on Mobile (<1024px), clean centered footer under workspace on Desktop (lg+) */}
        <FooterDock />
      </div>

      {/* Offline Status Indicator */}
      {!isOnline && (
        <div className="fixed bottom-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-[#FF9F0A]/40 bg-[#1C1C1E]/95 px-3.5 py-2 text-[12px] font-medium text-[#FF9F0A] shadow-lg lg:bottom-6">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Offline — Recent tracks still available</span>
        </div>
      )}

      {/* Mobile-Only Slide-Up Bottom Sheet (< 1024px) */}
      <div className="lg:hidden">
        <Suspense fallback={null}>
          <BottomSheet
            track={isDesktop ? null : sheetTrack}
            autoCopiedSignal={autoCopiedSignal}
            isFetchingIsrc={
              Boolean(sheetTrack?.id) && fetchingIsrcTrackId === sheetTrack?.id
            }
            onClose={handleCloseSheet}
            onCopied={handleInspectorCopied}
            onCopyFailed={handleInspectorCopyFailed}
            onSearchOtherVersions={handleSearchOtherVersions}
          />
        </Suspense>
      </div>
    </div>
  );
}

export default function App() {
  const isMaintenanceRoute =
    typeof window !== 'undefined' &&
    window.location.pathname.replace(/\/+$/, '') === '/maintenance';
  const showMaintenance =
    FORCE_MAINTENANCE ||
    import.meta.env.VITE_MAINTENANCE_MODE === 'true' ||
    isMaintenanceRoute;

  return (
    <MotionConfig reducedMotion="user">
      {showMaintenance ? (
        <Suspense fallback={<div className="min-h-[100dvh] bg-[#09090B]" />}>
          <MaintenancePage />
        </Suspense>
      ) : (
        <TrackCodeWorkspace />
      )}
      <Analytics />
    </MotionConfig>
  );
}
