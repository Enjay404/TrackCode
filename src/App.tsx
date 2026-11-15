import { Analytics } from '@vercel/analytics/react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  Check,
  ChevronDown,
  ClipboardPaste,
  Copy,
  Globe,
  Link2,
  Loader2,
  RotateCcw,
  Search,
  Share,
  WifiOff,
  X,
} from 'lucide-react';
import {
  Fragment,
  type ReactNode,
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { BottomSheet } from './components/BottomSheet';
import { BrandLogo } from './components/BrandLogo';
import { DesktopInspectorCard } from './components/DesktopInspectorCard';
import { DynamicIslandToast, type ToastState } from './components/DynamicIslandToast';
import { FooterDock } from './components/FooterDock';
import { PWAInstallButton } from './components/PWAInstallButton';
import { SkeletonRows } from './components/SkeletonRows';
import { SriLankaFlag } from './components/SriLankaFlag';
import { TrackCapsule } from './components/TrackCapsule';
import { useAudioPreview } from './hooks/useAudioPreview';
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
  cacheTrackPreviewsFromTracks,
  clearRecentTracksStorage,
  copyIsrcVerified,
  formatIsrcCode,
  getCachedSearchResult,
  getCachedTrackIsrc,
  getCachedTrackPreview,
  getTrackPreviewCacheKey,
  hydrateTracksWithCachedIsrc,
  isSpotifyTrackLink,
  type LastCopiedEntry,
  loadCachedQuickTryCharts,
  loadLastCopied,
  loadRecentTracks,
  saveCachedQuickTryCharts,
  saveLastCopied,
  saveRecentTrack,
  setCachedSearchResult,
  setCachedTrackIsrc,
  setCachedTrackPreview,
  syncQuickTryChartHistory,
} from './utils/spotifyInput';

const EmptySearchView = lazy(() => import('./components/EmptySearchView'));
const GuidePage = lazy(() => import('./components/GuidePage'));
const MaintenancePage = lazy(() => import('./components/MaintenancePage'));

const FORCE_MAINTENANCE = false;

const SEARCH_PLACEHOLDERS = [
  'Search song name...',
  'Paste a Spotify link...',
  'Search by artist...',
  'Find hidden Instagram songs...',
];

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
  activeTabPill,
  onTabPress,
  onTabCancel,
  onChange,
}: {
  activeTabPill: ChartRegion;
  onTabPress: (next: ChartRegion) => void;
  onTabCancel: () => void;
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
            activeTabPill === 'global' ? 'translate3d(0%, 0, 0)' : 'translate3d(100%, 0, 0)',
        }}
        className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-xl border border-white/[0.15] border-t-white/[0.28] bg-gradient-to-b from-[#262629] to-[#1A1A1D] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.14),0_4px_12px_rgba(0,0,0,0.4)] transition-transform duration-200 ease-out"
      />

      <button
        type="button"
        role="tab"
        aria-selected={activeTabPill === 'global'}
        onPointerDown={() => onTabPress('global')}
        onPointerCancel={onTabCancel}
        onClick={() => onChange('global')}
        className={`relative z-10 flex min-h-[36px] touch-manipulation cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl py-2 text-[12.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/35 ${
          activeTabPill === 'global'
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
        aria-selected={activeTabPill === 'sriLanka'}
        onPointerDown={() => onTabPress('sriLanka')}
        onPointerCancel={onTabCancel}
        onClick={() => onChange('sriLanka')}
        className={`relative z-10 flex min-h-[36px] touch-manipulation cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-xl py-2 text-[12.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/35 ${
          activeTabPill === 'sriLanka'
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
  playingTrackId?: string | null;
  isAudioLoading?: boolean;
  audioProgress?: number;
  showRanks?: boolean;
  isLoading?: boolean;
  isStreamingMore?: boolean;
  animateFromIndex?: number | null;
  skeletonCount?: number;
  onTogglePreview?: (track: TrackItem) => void;
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
  playingTrackId = null,
  isAudioLoading = false,
  audioProgress = 0,
  showRanks = false,
  isLoading = false,
  isStreamingMore = false,
  animateFromIndex = null,
  skeletonCount = 4,
  onTogglePreview,
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
            className="flex min-h-[36px] touch-manipulation cursor-pointer items-center rounded-lg px-2 text-[13px] font-medium text-[#30D158] transition-transform duration-150 active:scale-[0.97] active:bg-white/10"
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
      {isLoading ? (
        <SkeletonRows count={skeletonCount} />
      ) : (
        <div className="overflow-hidden rounded-[20px] border border-white/[0.08] border-t-white/[0.15] bg-[#1C1C1E] shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
          <div
            key={listKeyPrefix ?? 'static'}
            className={listKeyPrefix ? 'animate-fade-up' : undefined}
          >
            {tracks.map((track, index) => {
              const isThisActive = playingTrackId === track.id;
              const shouldAnimateIn =
                animateFromIndex !== null && index >= animateFromIndex;
              return (
                <Fragment key={listKeyPrefix ? `${listKeyPrefix}-${track.id}` : track.id}>
                  {index > 0 && (
                    <div
                      aria-hidden="true"
                      className="ml-[78px] mr-4 h-px scale-y-50 bg-white/[0.08]"
                    />
                  )}
                  <TrackCapsule
                    track={track}
                    index={index}
                    className={shouldAnimateIn ? 'animate-track-stream-in' : undefined}
                    style={
                      index >= 15
                        ? { contentVisibility: 'auto', containIntrinsicSize: 'auto 73px' }
                        : undefined
                    }
                    isSelected={selectedTrackId === track.id}
                    showRank={showRanks}
                    isPreviewPlaying={isThisActive && !isAudioLoading}
                    isPreviewLoading={isThisActive && isAudioLoading}
                    progress={isThisActive ? audioProgress : 0}
                    onTogglePreview={onTogglePreview}
                    onSelect={onSelect}
                  />
                </Fragment>
              );
            })}
            {isStreamingMore && (
              <div aria-hidden="true">
                {tracks.length > 0 && (
                  <div className="ml-[78px] mr-4 h-px scale-y-50 bg-white/[0.08]" />
                )}
                <div className="flex items-center gap-3.5 px-3.5 py-2.5">
                  <div className="skeleton-shimmer h-[52px] w-[52px] shrink-0 rounded-[11px]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="skeleton-shimmer h-3.5 w-3/5 rounded-md" />
                    <div className="skeleton-shimmer h-3 w-2/5 rounded-md" />
                  </div>
                </div>
              </div>
            )}
          </div>
          {footerControl}
        </div>
      )}
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

const MAX_CHART_TRACKS = 50;
const INITIAL_CHART_COUNT = 5;
const CHART_EXPAND_STEP = 15;

function mergeChartTracks(existing: TrackItem[], incoming: TrackItem[]): TrackItem[] {
  const seenIds = new Set<string>();
  const seenIsrcs = new Set<string>();
  const merged: TrackItem[] = [];

  for (const track of [...existing, ...incoming]) {
    if (!track?.id || seenIds.has(track.id)) continue;
    const normalizedIsrc = track.isrc?.trim().toUpperCase() || '';
    if (normalizedIsrc && seenIsrcs.has(normalizedIsrc)) continue;

    seenIds.add(track.id);
    if (normalizedIsrc) {
      seenIsrcs.add(normalizedIsrc);
    }

    const rank = merged.length + 1;
    if (rank > MAX_CHART_TRACKS) break;
    merged.push({ ...track, rank });
  }

  return merged;
}

function TrackCodeWorkspace() {
  const isDesktop = useIsDesktop();
  const [query, setQuery] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [results, setResults] = useState<TrackItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [popularRegion, setPopularRegion] = useState<ChartRegion>('global');
  const [activeTabPill, setActiveTabPill] = useState<ChartRegion>('global');
  const activeRegionRef = useRef<ChartRegion>('global');
  const [, startRegionTransition] = useTransition();
  const [visibleCountByRegion, setVisibleCountByRegion] = useState<Record<ChartRegion, number>>({
    global: INITIAL_CHART_COUNT,
    sriLanka: INITIAL_CHART_COUNT,
  });
  const [streamTargetCount, setStreamTargetCount] = useState<number | null>(null);
  const [animateNewFromIndex, setAnimateNewFromIndex] = useState<number | null>(null);
  const [isStreamingMore, setIsStreamingMore] = useState(false);
  const [loadedFullRegions, setLoadedFullRegions] = useState<Record<ChartRegion, boolean>>({
    global: false,
    sriLanka: false,
  });
  const hasStreamedSessionRef = useRef(false);
  const [quickTryCharts, setQuickTryCharts] = useState(() => loadCachedQuickTryCharts());
  const quickTryChartsRef = useRef(quickTryCharts);
  quickTryChartsRef.current = quickTryCharts;
  const [isQuickTryLoading, setIsQuickTryLoading] = useState(() => {
    const cached = loadCachedQuickTryCharts();
    return cached.global.length === 0 && cached.sriLanka.length === 0;
  });
  const activeQuickTryTracks =
    popularRegion === 'global' ? quickTryCharts.global : quickTryCharts.sriLanka;
  const activeVisibleCount = visibleCountByRegion[popularRegion];
  const displayedQuickTryTracks = useMemo(
    () => activeQuickTryTracks.slice(0, activeVisibleCount),
    [activeQuickTryTracks, activeVisibleCount]
  );

  const [recentTracks, setRecentTracks] = useState<TrackItem[]>(() => loadRecentTracks());
  const [sheetTrack, setSheetTrack] = useState<TrackItem | null>(null);
  const [inspectedTrack, setInspectedTrack] = useState<TrackItem | null>(null);
  const [fetchingIsrcTrackId, setFetchingIsrcTrackId] = useState<string | null>(null);
  const [activePreview, setActivePreview] = useState<{ key: string; url: string | null } | null>(
    null
  );
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
  const streamAbortRef = useRef<AbortController | null>(null);
  const fetchingTrackIdRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const skipNextAutoLookupRef = useRef<string | null>(null);
  const isDesktopRef = useRef(isDesktop);
  isDesktopRef.current = isDesktop;
  const activeInspectTrackRef = useRef<TrackItem | null>(null);
  const [lastCopied, setLastCopied] = useState<LastCopiedEntry | null>(() => loadLastCopied());
  const [isLastCopiedSuccess, setIsLastCopiedSuccess] = useState(false);
  const lastCopiedTimerRef = useRef<number | null>(null);
  const [isPageScrolled, setIsPageScrolled] = useState(false);

  const isOnline = useOnlineStatus();
  const trimmedQuery = query.trim();
  const isLinkMode = isSpotifyTrackLink(trimmedQuery);

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

  const activeInspectTrack = isDesktop ? activeDesktopTrack : sheetTrack;
  activeInspectTrackRef.current = activeInspectTrack;

  const showToast = useCallback(
    (message: string, tone: ToastState['tone'] = 'success', durationMs = 2600) => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      setToast({ id: Date.now(), message, tone });
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, durationMs);
    },
    []
  );

  const handleAudioIsrcResolved = useCallback((trackId: string, resolvedIsrc: string) => {
    const patchTrack = (item: TrackItem) =>
      item.id === trackId ? { ...item, isrc: resolvedIsrc } : item;
    setResults((prev) => prev.map(patchTrack));
    setInspectedTrack((prev) => (prev ? patchTrack(prev) : prev));
    setSheetTrack((prev) => (prev ? patchTrack(prev) : prev));
    setQuickTryCharts((prev) => ({
      global: prev.global.map(patchTrack),
      sriLanka: prev.sriLanka.map(patchTrack),
    }));
  }, []);

  const handleAudioPreviewResolved = useCallback(
    (trackId: string, previewKey: string, resolvedPreviewUrl: string | null) => {
      if (activeInspectTrackRef.current?.id === trackId) {
        setActivePreview({ key: previewKey, url: resolvedPreviewUrl });
      }
    },
    []
  );

  const {
    playingTrackId,
    loadedTrackId,
    isAudioLoading,
    audioProgress,
    togglePreview: handleToggleTrackPreview,
    stopAudioPreview,
    getAudioGainMultiplier,
  } = useAudioPreview({
    onIsrcResolved: handleAudioIsrcResolved,
    onPreviewResolved: handleAudioPreviewResolved,
  });

  const playingTrackIdRef = useRef<string | null>(null);
  playingTrackIdRef.current = playingTrackId;

  const handleRegionPillPress = useCallback((nextRegion: ChartRegion) => {
    setActiveTabPill(nextRegion);
  }, []);

  const handleRegionPillCancel = useCallback(() => {
    setActiveTabPill(activeRegionRef.current);
  }, []);

  const handleRegionChange = useCallback(
    (nextRegion: ChartRegion) => {
      activeRegionRef.current = nextRegion;
      setActiveTabPill(nextRegion);
      if (nextRegion === popularRegion) return;
      if (streamAbortRef.current) {
        streamAbortRef.current.abort();
        streamAbortRef.current = null;
      }
      setIsStreamingMore(false);
      setStreamTargetCount(null);
      setAnimateNewFromIndex(null);
      startRegionTransition(() => {
        setPopularRegion(nextRegion);
      });
    },
    [popularRegion]
  );

  const handleShowMoreHits = useCallback(async () => {
    if (isStreamingMore) return;

    const requestRegion = activeRegionRef.current;
    const currentVisibleCount = visibleCountByRegion[requestRegion];
    if (currentVisibleCount >= MAX_CHART_TRACKS) return;

    const nextTarget = Math.min(MAX_CHART_TRACKS, currentVisibleCount + CHART_EXPAND_STEP);
    setVisibleCountByRegion((prev) => ({ ...prev, [requestRegion]: nextTarget }));

    const currentTracks =
      requestRegion === 'global'
        ? quickTryChartsRef.current.global
        : quickTryChartsRef.current.sriLanka;

    if (currentTracks.length >= nextTarget || loadedFullRegions[requestRegion]) {
      setAnimateNewFromIndex(
        currentTracks.length > currentVisibleCount ? currentVisibleCount : null
      );
      return;
    }

    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
    }
    const controller = new AbortController();
    streamAbortRef.current = controller;
    hasStreamedSessionRef.current = true;
    setAnimateNewFromIndex(currentTracks.length);
    setStreamTargetCount(nextTarget);
    setIsStreamingMore(true);

    const offset = currentTracks.length;
    const limit = Math.min(MAX_CHART_TRACKS - offset, nextTarget - offset);
    if (limit <= 0) {
      streamAbortRef.current = null;
      setStreamTargetCount(null);
      setIsStreamingMore(false);
      return;
    }

    const regionQueryParam = requestRegion === 'sriLanka' ? 'lk' : 'global';
    let receivedCount = 0;

    try {
      const res = await fetch(
        `/api/quick-try?region=${regionQueryParam}&offset=${offset}&limit=${limit}&stream=1`,
        { signal: controller.signal }
      );
      if (!res.ok || !res.body) {
        throw new Error('Failed to load remaining hits.');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const applyIncomingBatch = (batch: TrackItem[]) => {
        if (
          batch.length === 0 ||
          controller.signal.aborted ||
          requestRegion !== activeRegionRef.current
        ) {
          return;
        }
        receivedCount += batch.length;
        cacheTrackPreviewsFromTracks(batch);
        const hydratedBatch = hydrateTracksWithCachedIsrc(batch);

        setQuickTryCharts((prev) => {
          const existing = requestRegion === 'global' ? prev.global : prev.sriLanka;
          const merged = syncQuickTryChartHistory(
            mergeChartTracks(existing, hydratedBatch),
            requestRegion
          );
          const next =
            requestRegion === 'global'
              ? { ...prev, global: merged }
              : { ...prev, sriLanka: merged };
          saveCachedQuickTryCharts(next);
          return next;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (controller.signal.aborted || requestRegion !== activeRegionRef.current) return;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        const parsedBatch: TrackItem[] = [];
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;
          try {
            const parsed = JSON.parse(trimmedLine) as TrackItem;
            if (parsed?.id) {
              parsedBatch.push(parsed);
            }
          } catch {
            // Skip malformed NDJSON line
          }
        }
        applyIncomingBatch(parsedBatch);
      }

      if (
        buffer.trim() &&
        !controller.signal.aborted &&
        requestRegion === activeRegionRef.current
      ) {
        try {
          const parsed = JSON.parse(buffer.trim()) as TrackItem;
          if (parsed?.id) {
            applyIncomingBatch([parsed]);
          }
        } catch {
          // Ignore trailing partial line
        }
      }

      if (!controller.signal.aborted && requestRegion === activeRegionRef.current) {
        const latestTracks =
          requestRegion === 'global'
            ? quickTryChartsRef.current.global
            : quickTryChartsRef.current.sriLanka;
        if (latestTracks.length >= MAX_CHART_TRACKS || receivedCount < limit) {
          setLoadedFullRegions((prev) => ({ ...prev, [requestRegion]: true }));
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      if (requestRegion === activeRegionRef.current) {
        const latest =
          requestRegion === 'global'
            ? quickTryChartsRef.current.global
            : quickTryChartsRef.current.sriLanka;
        setVisibleCountByRegion((prev) => ({
          ...prev,
          [requestRegion]: Math.max(INITIAL_CHART_COUNT, Math.min(prev[requestRegion], latest.length)),
        }));
        showToast('Could not load more hits right now', 'info');
      }
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null;
        setStreamTargetCount(null);
        setIsStreamingMore(false);
      }
    }
  }, [isStreamingMore, visibleCountByRegion, loadedFullRegions, showToast]);

  const handleFocusSearchFromFooter = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 320);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/quick-try')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: QuickTryApiResponse | null) => {
        if (cancelled || !data || hasStreamedSessionRef.current) return;
        const rawGlobal = Array.isArray(data.global) ? data.global : [];
        const rawSriLanka = Array.isArray(data.sriLanka) ? data.sriLanka : [];
        if (rawGlobal.length > 0 || rawSriLanka.length > 0) {
          cacheTrackPreviewsFromTracks([...rawGlobal, ...rawSriLanka]);
          const nextCharts = {
            global:
              rawGlobal.length > 0
                ? syncQuickTryChartHistory(mergeChartTracks([], rawGlobal), 'global')
                : [],
            sriLanka:
              rawSriLanka.length > 0
                ? syncQuickTryChartHistory(mergeChartTracks([], rawSriLanka), 'sriLanka')
                : [],
          };
          setQuickTryCharts(nextCharts);
          setLoadedFullRegions({ global: false, sriLanka: false });
          saveCachedQuickTryCharts(nextCharts);
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

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const nextScrolled = window.scrollY > 12;
      setIsPageScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (query || isSearchFocused) return;
    const timer = window.setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % SEARCH_PLACEHOLDERS.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [query, isSearchFocused]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (lastCopiedTimerRef.current) {
        window.clearTimeout(lastCopiedTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (isrcAbortControllerRef.current) {
        isrcAbortControllerRef.current.abort();
      }
      if (streamAbortRef.current) {
        streamAbortRef.current.abort();
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
          if (playingTrackIdRef.current !== null && nextTrack.id !== playingTrackIdRef.current) {
            stopAudioPreview();
          }
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
  }, [isDesktop, visibleTracks, activeDesktopTrack, trimmedQuery, hasSearched, showToast, stopAudioPreview]);

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
          cacheTrackPreviewsFromTracks([track]);
          (document.activeElement as HTMLElement | null)?.blur();
          if (playingTrackIdRef.current !== null && track.id !== playingTrackIdRef.current) {
            stopAudioPreview();
          }
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
          cacheTrackPreviewsFromTracks(rawTracks);
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
    [showToast, stopAudioPreview]
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

  const activePreviewKey = activeInspectTrack ? getTrackPreviewCacheKey(activeInspectTrack) : null;
  const activePreviewUrl = activePreviewKey
    ? activePreview?.key === activePreviewKey
      ? activePreview.url
      : (getCachedTrackPreview(activePreviewKey) ?? null)
    : null;

  const handleToggleInspectorPreview = useCallback(() => {
    if (!activeInspectTrack) return;
    handleToggleTrackPreview(activeInspectTrack);
  }, [activeInspectTrack, handleToggleTrackPreview]);

  const fetchIsrcOnDemand = useCallback((targetTrack: TrackItem) => {
    const previewKey = getTrackPreviewCacheKey(targetTrack);
    const cachedIsrc = targetTrack.isrc ?? getCachedTrackIsrc(targetTrack.id);
    const needsIsrc = !targetTrack.isrc && cachedIsrc === undefined;
    const cachedPreview = getCachedTrackPreview(previewKey);
    const needsPreview = cachedPreview === undefined;

    if (!targetTrack.isrc && typeof cachedIsrc === 'string' && cachedIsrc) {
      const patchTrack = (item: TrackItem) =>
        item.id === targetTrack.id ? { ...item, isrc: cachedIsrc } : item;
      setResults((prev) => prev.map(patchTrack));
      setInspectedTrack((prev) => (prev ? patchTrack(prev) : prev));
      setSheetTrack((prev) => (prev ? patchTrack(prev) : prev));
    }

    if (!needsPreview) {
      setActivePreview({ key: previewKey, url: cachedPreview ?? null });
    }

    if (!needsIsrc && !needsPreview) {
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
    if (needsIsrc) {
      setFetchingIsrcTrackId(targetTrack.id);
    } else {
      setFetchingIsrcTrackId(null);
    }

    const source =
      targetTrack.source ?? (targetTrack.id.startsWith('dz-') ? 'deezer' : 'spotify');
    const params = new URLSearchParams();
    params.set('id', targetTrack.id);
    params.set('source', source);
    if (typeof cachedIsrc === 'string' && cachedIsrc) {
      params.set('isrc', cachedIsrc);
    }
    const fallbackQuery = `${targetTrack.name} ${targetTrack.primaryArtist}`.trim();
    if (fallbackQuery) {
      params.set('q', fallbackQuery);
    }

    void fetch(`/api/isrc?${params.toString()}`, { signal: controller.signal })
      .then((res) =>
        res.ok
          ? (res.json() as Promise<{ isrc?: string | null; previewUrl?: string | null }>)
          : { isrc: null, previewUrl: null }
      )
      .then((data) => {
        if (controller.signal.aborted) return;
        const resolvedIsrc =
          typeof data.isrc === 'string' && data.isrc.trim()
            ? data.isrc.trim().toUpperCase()
            : null;
        const resolvedPreviewUrl =
          typeof data.previewUrl === 'string' && /^https?:\/\//i.test(data.previewUrl.trim())
            ? data.previewUrl.trim()
            : null;

        setCachedTrackPreview(previewKey, resolvedPreviewUrl);
        if (resolvedIsrc) {
          setCachedTrackPreview(
            getTrackPreviewCacheKey({ id: targetTrack.id, isrc: resolvedIsrc }),
            resolvedPreviewUrl
          );
        }

        const effectiveKey = getTrackPreviewCacheKey({
          id: targetTrack.id,
          isrc: resolvedIsrc ?? (typeof cachedIsrc === 'string' ? cachedIsrc : targetTrack.isrc),
        });
        setActivePreview({ key: effectiveKey, url: resolvedPreviewUrl });

        if (needsIsrc) {
          setCachedTrackIsrc(targetTrack.id, resolvedIsrc);
          const patchTrack = (item: TrackItem) =>
            item.id === targetTrack.id ? { ...item, isrc: resolvedIsrc } : item;

          setResults((prev) => prev.map(patchTrack));
          setInspectedTrack((prev) => (prev ? patchTrack(prev) : prev));
          setSheetTrack((prev) => (prev ? patchTrack(prev) : prev));

          if (resolvedIsrc) {
            setRecentTracks(saveRecentTrack({ ...targetTrack, isrc: resolvedIsrc }));
          }
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
    if (!activeTrack) {
      setActivePreview(null);
      return;
    }

    const previewKey = getTrackPreviewCacheKey(activeTrack);
    const cachedPreview = getCachedTrackPreview(previewKey);
    const cachedIsrc = activeTrack.isrc ?? getCachedTrackIsrc(activeTrack.id);
    const needsIsrc = !activeTrack.isrc && cachedIsrc === undefined;

    if (cachedPreview !== undefined) {
      setActivePreview({ key: previewKey, url: cachedPreview });
    }

    if (needsIsrc || cachedPreview === undefined) {
      fetchIsrcOnDemand(activeTrack);
    }
  }, [isDesktop, activeDesktopTrack, sheetTrack, fetchIsrcOnDemand]);

  const handleSelectTrack = useCallback(
    (track: TrackItem, copied: boolean) => {
      if (playingTrackIdRef.current !== null && track.id !== playingTrackIdRef.current) {
        stopAudioPreview();
      }

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
        setFetchingIsrcTrackId(null);
        setRecentTracks(saveRecentTrack(effectiveTrack));
        if (copied) {
          const nextLastCopied: LastCopiedEntry = {
            isrc: effectiveTrack.isrc.trim().toUpperCase(),
            title: effectiveTrack.name?.trim() ?? '',
          };
          setLastCopied(nextLastCopied);
          saveLastCopied(nextLastCopied);
          setAutoCopiedSignal((s) => s + 1);
          showToast(`Copied ${formatIsrcCode(effectiveTrack.isrc)}`, 'success');
        } else {
          setAutoCopiedSignal(0);
        }
      } else {
        setAutoCopiedSignal(0);
      }

      fetchIsrcOnDemand(effectiveTrack);
    },
    [showToast, fetchIsrcOnDemand, stopAudioPreview]
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

  const handleSearchOtherVersions = useCallback(
    (track: TrackItem) => {
      if (playingTrackIdRef.current !== null && track.id === playingTrackIdRef.current) {
        stopAudioPreview();
      }
      setSheetTrack(null);
      const nextQuery = `${track.name} ${track.primaryArtist}`.trim();
      setQuery(nextQuery);
    },
    [stopAudioPreview]
  );

  const handleCloseSheet = useCallback(() => {
    if (sheetTrack?.id && playingTrackIdRef.current === sheetTrack.id) {
      stopAudioPreview();
    }
    setSheetTrack(null);
  }, [sheetTrack?.id, stopAudioPreview]);

  const handleInspectorCopied = useCallback(
    (isrc: string, copiedTrack?: TrackItem) => {
      if (copiedTrack) {
        setRecentTracks(saveRecentTrack(copiedTrack));
      }
      const nextLastCopied: LastCopiedEntry = {
        isrc: isrc.trim().toUpperCase(),
        title: copiedTrack?.name?.trim() ?? '',
      };
      setLastCopied(nextLastCopied);
      saveLastCopied(nextLastCopied);
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
    if (!lastCopied?.isrc) return;
    const copied = await copyIsrcVerified(lastCopied.isrc);
    if (copied) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
      if (lastCopiedTimerRef.current) {
        window.clearTimeout(lastCopiedTimerRef.current);
      }
      setIsLastCopiedSuccess(true);
      lastCopiedTimerRef.current = window.setTimeout(() => {
        lastCopiedTimerRef.current = null;
        setIsLastCopiedSuccess(false);
      }, 1500);
      const formatted = formatIsrcCode(lastCopied.isrc);
      showToast(lastCopied.title ? `Copied "${lastCopied.title}"` : `Copied ${formatted}`, 'success', 1200);
      if (isDesktopRef.current) {
        const matchedRecent = recentTracks.find(
          (item) => item.isrc?.trim().toUpperCase() === lastCopied.isrc
        );
        if (matchedRecent) {
          setInspectedTrack(matchedRecent);
        }
        setAutoCopiedSignal((s) => s + 1);
      }
    } else {
      showToast('Copy failed — tap to retry', 'info');
    }
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

  const popularHeaderControl = useMemo(
    () => (
      <RegionSegmentedToggle
        activeTabPill={activeTabPill}
        onTabPress={handleRegionPillPress}
        onTabCancel={handleRegionPillCancel}
        onChange={handleRegionChange}
      />
    ),
    [activeTabPill, handleRegionPillPress, handleRegionPillCancel, handleRegionChange]
  );

  const popularFooterControl = useMemo(() => {
    if (displayedQuickTryTracks.length === 0 && !isStreamingMore) {
      return null;
    }

    const targetCount = streamTargetCount ?? Math.min(MAX_CHART_TRACKS, activeVisibleCount);
    const hasMoreToRevealOrFetch =
      displayedQuickTryTracks.length < MAX_CHART_TRACKS &&
      (!loadedFullRegions[popularRegion] ||
        activeQuickTryTracks.length > displayedQuickTryTracks.length);

    if (isStreamingMore) {
      return (
        <div
          aria-live="polite"
          className="flex w-full items-center justify-center gap-2 border-t border-white/[0.08] px-4 py-3 text-[13px] font-medium text-white/75"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-white/70" aria-hidden="true" />
          <span className="tabular-nums">
            Loading {Math.min(activeQuickTryTracks.length, targetCount)} / {targetCount}…
          </span>
        </div>
      );
    }

    if (hasMoreToRevealOrFetch) {
      return (
        <button
          type="button"
          onClick={() => void handleShowMoreHits()}
          className="flex w-full touch-manipulation cursor-pointer items-center justify-center gap-1.5 border-t border-white/[0.08] px-4 py-3 text-[13px] font-medium text-white/75 transition-colors duration-100 hover:bg-white/[0.03] hover:text-white active:bg-[#2A2A2E] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/30"
        >
          <span>Show more</span>
          <ChevronDown className="h-4 w-4 text-white/50" aria-hidden="true" />
        </button>
      );
    }

    return (
      <div className="border-t border-white/[0.08] px-4 py-4 text-center">
        <p className="text-[13px] font-medium text-white/65">
          {displayedQuickTryTracks.length >= MAX_CHART_TRACKS
            ? 'That’s all 50 top hits for today :)'
            : `That’s all ${displayedQuickTryTracks.length} top hits for today :)`}
        </p>
        <p className="mt-1 text-[12px] text-white/45">
          Didn’t find one you liked?{' '}
          <button
            type="button"
            onClick={handleFocusSearchFromFooter}
            className="touch-manipulation cursor-pointer font-medium text-[#30D158] transition-colors hover:text-[#4AE070] active:opacity-80 focus-visible:outline-none focus-visible:underline"
          >
            Search any song above
          </button>
        </p>
      </div>
    );
  }, [
    isStreamingMore,
    streamTargetCount,
    activeVisibleCount,
    loadedFullRegions,
    popularRegion,
    activeQuickTryTracks.length,
    displayedQuickTryTracks.length,
    handleShowMoreHits,
    handleFocusSearchFromFooter,
  ]);

  const recentHasPlayingTrack = Boolean(
    playingTrackId && recentTracks.some((item) => item.id === playingTrackId)
  );
  const popularHasPlayingTrack = Boolean(
    playingTrackId && displayedQuickTryTracks.some((item) => item.id === playingTrackId)
  );

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-[#09090B] pb-8 text-white">
      {/* Top Status-Bar / Dynamic Island Fade Shield when scrolled (zero backdrop-filter) */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-x-0 top-0 z-30 h-[calc(env(safe-area-inset-top,0px)+16px)] bg-gradient-to-b from-[#09090B] via-[#09090B]/90 to-transparent transition-opacity duration-200 lg:hidden ${
          isPageScrolled ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <DynamicIslandToast toast={toast} />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-transparent pt-[calc(env(safe-area-inset-top,0px)+14px)] lg:max-w-5xl lg:px-8 lg:pt-0">
        {/* Breathing Ambient Background Glow behind top ~35% (pure CSS GPU animation) */}
        <div
          aria-hidden="true"
          className="animate-ambient-breathe pointer-events-none fixed inset-x-0 top-0 z-0 h-[44vh]"
          style={{
            transformOrigin: '50% 18%',
            background:
              'radial-gradient(68% 72% at 22% 14%, rgba(48, 209, 88, 0.11) 0%, transparent 72%), radial-gradient(75% 78% at 78% 18%, rgba(58, 75, 115, 0.14) 0%, transparent 75%)',
          }}
        />

        {/* Responsive Header: Mobile Large Title / Desktop Top Bar */}
        <header className="relative z-10 flex items-center justify-between gap-3 px-4 pt-1 pb-3 lg:px-0 lg:pt-8 lg:pb-6">
          <h1 className="flex items-center">
            <span className="sr-only">TrackCode — ISRC Finder</span>
            <BrandLogo className="h-[44px] sm:h-[48px]" />
          </h1>

          <div className="flex items-center gap-2 lg:gap-3">
            <div className="hidden lg:block">
              <ApiStatusPill status={apiStatus} />
            </div>
            <motion.button
              type="button"
              onClick={() => void handleShareApp()}
              whileTap={{ scale: 0.95 }}
              transition={SPRING_BUTTON}
              aria-label="Share TrackCode"
              className="liquid-glass flex h-[44px] w-[44px] shrink-0 touch-manipulation cursor-pointer items-center justify-center rounded-full text-white transition-colors hover:bg-white/[0.1] active:bg-white/[0.14] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
            >
              <Share className="h-[17px] w-[17px] text-[#AEAEB2]" />
            </motion.button>
            <PWAInstallButton />
          </div>
        </header>

        {/* Main Content Workspace: Single-Column Mobile / 12-Col Two-Column Split Desktop */}
        <main className="relative z-10 flex-1 pb-4">
          <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-7">
            {/* Left Column (Desktop col-span-7) / Mobile Full Column */}
            <div className="lg:col-span-7">
              {/* Hero Search Capsule (Sticky on Mobile, seamless gradient backdrop when scrolled, Static on Desktop) */}
              <div
                className={`sticky top-0 z-20 px-4 pt-[calc(env(safe-area-inset-top,0px)+8px)] pb-2.5 transition-colors duration-200 lg:static lg:mb-4 lg:bg-transparent lg:px-0 lg:py-0 ${
                  isPageScrolled ? 'bg-[#09090B]' : 'bg-transparent'
                }`}
              >
                <form
                  onSubmit={handleSearchSubmit}
                  className="group relative flex h-[56px] sm:h-[60px] items-center gap-3 rounded-[20px] border border-white/[0.12] border-t-white/[0.22] bg-[#1C1C1E] px-4 shadow-[0_14px_34px_rgba(0,0,0,0.6),0_0_0_1px_rgba(48,209,88,0.06)] transition-[border-color,background-color,box-shadow] duration-200 ease-out focus-within:border-[#30D158]/45 focus-within:bg-[#202221] focus-within:shadow-[0_14px_34px_rgba(0,0,0,0.6),0_0_24px_rgba(48,209,88,0.16),0_0_0_1px_rgba(48,209,88,0.22)]"
                >
                  {query.length === 0 && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[20px] group-focus-within:hidden"
                    >
                      <div className="animate-search-sheen h-full w-1/3 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
                    </div>
                  )}

                  <span className="pointer-events-none relative z-10 flex h-5 w-5 shrink-0 items-center justify-center">
                    {isLoading ? (
                      <Loader2
                        className="h-[18px] w-[18px] animate-spin text-white/65"
                        aria-hidden="true"
                      />
                    ) : isLinkMode ? (
                      <Link2
                        className="h-5 w-5 text-[#30D158] transition-colors duration-200"
                        aria-hidden="true"
                      />
                    ) : (
                      <Search
                        className="h-5 w-5 text-white/60 transition-colors duration-200 group-focus-within:text-[#30D158]"
                        aria-hidden="true"
                      />
                    )}
                  </span>

                  <div className="relative z-10 flex min-w-0 flex-1 items-center">
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
                      placeholder=""
                      aria-label="Search song, artist, or Spotify link"
                      className="w-full touch-manipulation bg-transparent text-[16px] font-medium tracking-[-0.01em] text-white outline-none focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                    />
                    {!query && !isSearchFocused && (
                      <span
                        key={placeholderIndex}
                        aria-hidden="true"
                        className="animate-placeholder-in pointer-events-none absolute inset-y-0 left-0 right-1 flex items-center overflow-hidden whitespace-nowrap select-none text-[16px] font-medium tracking-[-0.01em] text-white/45"
                      >
                        {SEARCH_PLACEHOLDERS[placeholderIndex]}
                      </span>
                    )}
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                    {query.length === 0 ? (
                      <motion.div
                        key="paste-action"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.92 }}
                        transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                        className="relative z-10 flex shrink-0 items-center gap-2"
                      >
                        <kbd
                          aria-hidden="true"
                          className="hidden select-none items-center rounded-md border border-white/[0.12] bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-[#8E8E93] lg:inline-flex"
                        >
                          ⌘K
                        </kbd>
                        <button
                          type="button"
                          onClick={() => void handlePasteFromClipboard()}
                          className="flex h-[38px] shrink-0 touch-manipulation cursor-pointer items-center gap-1.5 rounded-[13px] border border-[#30D158]/[0.28] border-t-[#30D158]/[0.48] bg-gradient-to-b from-[#30D158]/[0.24] to-[#30D158]/[0.12] px-3.5 text-[13px] font-semibold tracking-[-0.01em] text-[#34E060] shadow-[inset_0_1px_0_rgba(255,255,255,0.20),0_2px_10px_rgba(48,209,88,0.16)] transition-[background,transform,box-shadow] duration-150 hover:from-[#30D158]/[0.32] hover:to-[#30D158]/[0.18] active:scale-95"
                        >
                          <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Paste</span>
                        </button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="clear-action"
                        initial={{ opacity: 0, scale: 0.88 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.88 }}
                        transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                        className="flex shrink-0 items-center gap-2"
                      >
                        <kbd
                          aria-hidden="true"
                          className="hidden select-none items-center rounded-md border border-white/[0.12] bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-[#8E8E93] lg:inline-flex"
                        >
                          ⌘K
                        </kbd>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearInput();
                          }}
                          aria-label="Clear search"
                          className="relative flex h-[20px] w-[20px] shrink-0 touch-manipulation cursor-pointer items-center justify-center rounded-full bg-white/[0.24] text-[#1C1C1E] transition-[background-color,transform] duration-150 before:absolute before:-inset-2.5 before:content-[''] hover:bg-white/[0.34] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                        >
                          <X className="h-[11px] w-[11px]" strokeWidth={2.8} aria-hidden="true" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                              className="relative mt-4 flex min-h-[48px] w-full touch-manipulation items-center justify-center gap-2.5 rounded-2xl border border-[#FF453A]/45 bg-[#FF453A]/[0.08] px-4 py-3 text-[14px] font-semibold text-white transition-colors duration-150 hover:bg-[#FF453A]/[0.14] active:bg-[#FF453A]/[0.2] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#FF453A]"
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
                              className="relative mt-4 flex min-h-[50px] w-full touch-manipulation cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-5 text-[16px] font-semibold tracking-[-0.01em] text-black transition-colors duration-150 active:bg-[#2C2C2E] active:text-white focus-visible:outline-none"
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
                            className="relative mt-5 flex min-h-[50px] w-full touch-manipulation cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-5 text-[15px] font-semibold tracking-[-0.01em] text-black transition-colors duration-150 active:bg-[#2C2C2E] active:text-white focus-visible:outline-none"
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
                      <section key={trimmedQuery} aria-label="Search results" className="animate-fade-up pt-1 lg:pt-0">
                        <div className="flex items-center justify-between px-1 pb-2">
                          <h2 className="text-[13px] font-semibold tracking-wide text-[#8E8E93]">
                            {isLinkMode ? 'Matched Track' : 'Results · Tap to Copy ISRC'}
                          </h2>
                          <span className="hidden text-[11.5px] text-[#8E8E93] lg:inline">
                            ↑↓ navigate · Enter copy
                          </span>
                        </div>
                        <div className="overflow-hidden rounded-[20px] border border-white/[0.08] border-t-white/[0.15] bg-[#1C1C1E] shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
                          {results.map((track, index) => {
                            const isThisActive = playingTrackId === track.id;
                            return (
                              <Fragment key={track.id}>
                                {index > 0 && (
                                  <div
                                    aria-hidden="true"
                                    className="ml-[78px] mr-4 h-px scale-y-50 bg-white/[0.08]"
                                  />
                                )}
                                <TrackCapsule
                                  track={track}
                                  index={index}
                                  isSelected={
                                    (isDesktop ? activeDesktopTrack?.id : sheetTrack?.id) ===
                                    track.id
                                  }
                                  isPreviewPlaying={isThisActive && !isAudioLoading}
                                  isPreviewLoading={isThisActive && isAudioLoading}
                                  progress={isThisActive ? audioProgress : 0}
                                  onTogglePreview={handleToggleTrackPreview}
                                  onSelect={handleSelectTrack}
                                />
                              </Fragment>
                            );
                          })}
                        </div>
                      </section>
                    )}
                  </>
                ) : (
                  <div className="space-y-5 pt-1 lg:pt-0">
                    {/* Slim, Low-Profile Last Copied Utility Strip */}
                    {lastCopied?.isrc && (
                      <section aria-label="Last copied ISRC">
                        <button
                          type="button"
                          onClick={() => void handleQuickCopyLast()}
                          aria-label={`Re-copy ${formatIsrcCode(lastCopied.isrc)}`}
                          className="group flex h-[36px] w-full touch-manipulation cursor-pointer items-center justify-between gap-3 rounded-[12px] border border-white/[0.06] bg-[#141416] px-3.5 transition-[border-color,transform] duration-150 hover:border-white/[0.11] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/25"
                        >
                          <span className="truncate text-[12px] font-medium text-white/40">
                            Last copied
                          </span>
                          <AnimatePresence mode="wait" initial={false}>
                            {isLastCopiedSuccess ? (
                              <motion.span
                                key="copied"
                                initial={{ opacity: 0, scale: 0.94 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.94 }}
                                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                                className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-semibold text-[#30D158]"
                              >
                                <Check className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" aria-hidden="true" />
                                <span>Copied</span>
                              </motion.span>
                            ) : (
                              <motion.span
                                key="code"
                                initial={{ opacity: 0, scale: 0.94 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.94 }}
                                transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
                                className="inline-flex shrink-0 items-center gap-2"
                              >
                                <span className="font-mono whitespace-nowrap text-[12.5px] tracking-wide text-white/75">
                                  {formatIsrcCode(lastCopied.isrc)}
                                </span>
                                <Copy
                                  className="h-3.5 w-3.5 shrink-0 text-[#30D158] transition-transform duration-150 group-hover:scale-105"
                                  aria-hidden="true"
                                />
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </button>
                      </section>
                    )}

                    {/* Recent History Grouped Inset Container */}
                    {recentTracks.length > 0 && (
                      <TrackListSection
                        title="Recent"
                        ariaLabel="Recent copied tracks"
                        tracks={recentTracks}
                        selectedTrackId={isDesktop ? activeDesktopTrack?.id : sheetTrack?.id}
                        playingTrackId={recentHasPlayingTrack ? playingTrackId : null}
                        isAudioLoading={recentHasPlayingTrack ? isAudioLoading : false}
                        audioProgress={recentHasPlayingTrack ? audioProgress : 0}
                        onTogglePreview={handleToggleTrackPreview}
                        onSelect={handleSelectTrack}
                        onClear={handleClearRecent}
                      />
                    )}

                    {/* Popular Hits Grouped Inset Container */}
                    {(isQuickTryLoading ||
                      quickTryCharts.global.length > 0 ||
                      quickTryCharts.sriLanka.length > 0) && (
                      <TrackListSection
                        title="POPULAR HITS"
                        subtitle="UPDATED DAILY"
                        headerControl={popularHeaderControl}
                        footerControl={popularFooterControl}
                        listKeyPrefix={popularRegion}
                        ariaLabel="Popular Hits"
                        tracks={displayedQuickTryTracks}
                        selectedTrackId={isDesktop ? activeDesktopTrack?.id : sheetTrack?.id}
                        playingTrackId={popularHasPlayingTrack ? playingTrackId : null}
                        isAudioLoading={popularHasPlayingTrack ? isAudioLoading : false}
                        audioProgress={popularHasPlayingTrack ? audioProgress : 0}
                        showRanks={true}
                        isLoading={isQuickTryLoading}
                        isStreamingMore={isStreamingMore}
                        animateFromIndex={animateNewFromIndex}
                        skeletonCount={5}
                        onTogglePreview={handleToggleTrackPreview}
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
                previewUrl={isDesktop ? activePreviewUrl : null}
                isAudioPlaying={
                  isDesktop &&
                  Boolean(activeDesktopTrack?.id) &&
                  playingTrackId === activeDesktopTrack?.id &&
                  !isAudioLoading
                }
                isAudioLoading={
                  isDesktop &&
                  Boolean(activeDesktopTrack?.id) &&
                  playingTrackId === activeDesktopTrack?.id &&
                  isAudioLoading
                }
                audioProgress={
                  isDesktop &&
                  activeDesktopTrack?.id &&
                  (playingTrackId === activeDesktopTrack.id ||
                    loadedTrackId === activeDesktopTrack.id)
                    ? audioProgress
                    : 0
                }
                onTogglePreview={handleToggleInspectorPreview}
                getAudioGainMultiplier={getAudioGainMultiplier}
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
        <BottomSheet
          track={isDesktop ? null : sheetTrack}
          autoCopiedSignal={autoCopiedSignal}
          isFetchingIsrc={
            Boolean(sheetTrack?.id) && fetchingIsrcTrackId === sheetTrack?.id
          }
          previewUrl={!isDesktop && sheetTrack ? activePreviewUrl : null}
          isAudioPlaying={
            !isDesktop &&
            Boolean(sheetTrack?.id) &&
            playingTrackId === sheetTrack?.id &&
            !isAudioLoading
          }
          isAudioLoading={
            !isDesktop &&
            Boolean(sheetTrack?.id) &&
            playingTrackId === sheetTrack?.id &&
            isAudioLoading
          }
          audioProgress={
            !isDesktop &&
            sheetTrack?.id &&
            (playingTrackId === sheetTrack.id || loadedTrackId === sheetTrack.id)
              ? audioProgress
              : 0
          }
          getAudioGainMultiplier={getAudioGainMultiplier}
          onTogglePreview={handleToggleInspectorPreview}
          onClose={handleCloseSheet}
          onCopied={handleInspectorCopied}
          onCopyFailed={handleInspectorCopyFailed}
          onSearchOtherVersions={handleSearchOtherVersions}
        />
      </div>
    </div>
  );
}

function normalizePathname(rawPath: string): string {
  const trimmed = rawPath.replace(/\/+$/, '');
  return trimmed || '/';
}

export default function App() {
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? normalizePathname(window.location.pathname) : '/'
  );

  useEffect(() => {
    const handlePopState = () => {
      setPathname(normalizePathname(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = useCallback((nextPath: string) => {
    const target = normalizePathname(nextPath);
    if (typeof window !== 'undefined') {
      const current = normalizePathname(window.location.pathname);
      if (current !== target) {
        window.history.pushState({}, '', target);
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
    setPathname(target);
  }, []);

  const isMaintenanceRoute = pathname === '/maintenance';
  const isGuideRoute = pathname === '/guide';
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
      ) : isGuideRoute ? (
        <Suspense fallback={<div className="min-h-[100dvh] bg-[#09090B]" />}>
          <GuidePage onNavigate={navigateTo} />
        </Suspense>
      ) : (
        <TrackCodeWorkspace />
      )}
      <Analytics />
    </MotionConfig>
  );
}
