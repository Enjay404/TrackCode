import type { CachedSearchResult, TrackItem } from '../types/track';

const RECENT_STORAGE_KEY = 'trackcode_recent_tracks_v1';
const GUIDE_OPEN_STORAGE_KEY = 'trackcode_ig_guide_open_v1';
const SEARCH_CACHE_STORAGE_KEY = 'trackcode_search_cache_v2';
const QUICK_TRY_STORAGE_KEY = 'trackcode_quick_try_v3';
const CHART_HISTORY_STORAGE_KEY = 'trackcode_chart_history_v1';
const ISRC_CACHE_STORAGE_KEY = 'trackcode_isrc_cache_v1';
const MAX_RECENT_TRACKS = 8;
const MAX_SEARCH_CACHE_ENTRIES = 40;
const MAX_ISRC_CACHE_ENTRIES = 120;
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;

const searchMemoryCache = new Map<string, CachedSearchResult>();
const trackIsrcMemoryCache = new Map<string, string | null>();

export function formatIsrcCode(isrc: string): string {
  return `ISRC:${isrc.trim().toUpperCase()}`;
}

export function isSpotifyTrackLink(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;

  return (
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:track|album|playlist|artist|episode|show)\/[A-Za-z0-9]+/i.test(
      trimmed
    ) ||
    /spotify:(?:\/\/)?(?:track|album|playlist|artist|episode|show)[:/][A-Za-z0-9]+/i.test(
      trimmed
    ) ||
    /(?:https?:\/\/)?(?:spotify\.link|spoti\.fi)\/[A-Za-z0-9_-]+/i.test(trimmed) ||
    /^[A-Za-z0-9]{22}$/.test(trimmed)
  );
}

function execCommandCopy(formatted: string): boolean {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = formatted;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, formatted.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export async function copyIsrcVerified(isrc: string): Promise<boolean> {
  const formatted = formatIsrcCode(isrc);
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      // Called before any await to preserve iOS/mobile user gesture activation
      await navigator.clipboard.writeText(formatted);
      return true;
    } catch {
      return execCommandCopy(formatted);
    }
  }
  return execCommandCopy(formatted);
}

export function getCachedSearchResult(rawQuery: string): CachedSearchResult | null {
  const key = rawQuery.trim().toLowerCase();
  if (!key) return null;

  const now = Date.now();
  const memEntry = searchMemoryCache.get(key);
  if (memEntry) {
    if (now - memEntry.cachedAt <= SEARCH_CACHE_TTL_MS) {
      return memEntry;
    }
    searchMemoryCache.delete(key);
  }

  try {
    const raw = sessionStorage.getItem(SEARCH_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Record<string, CachedSearchResult>;
    const entry = stored?.[key];
    if (!entry || !Array.isArray(entry.tracks)) return null;
    if (now - entry.cachedAt > SEARCH_CACHE_TTL_MS) return null;

    searchMemoryCache.set(key, entry);
    return entry;
  } catch {
    return null;
  }
}

export function setCachedSearchResult(
  rawQuery: string,
  payload: Omit<CachedSearchResult, 'cachedAt'>
): void {
  const key = rawQuery.trim().toLowerCase();
  if (!key) return;

  const entry: CachedSearchResult = {
    ...payload,
    cachedAt: Date.now(),
  };

  if (searchMemoryCache.size >= MAX_SEARCH_CACHE_ENTRIES && !searchMemoryCache.has(key)) {
    const oldest = searchMemoryCache.keys().next().value;
    if (oldest !== undefined) {
      searchMemoryCache.delete(oldest);
    }
  }
  searchMemoryCache.set(key, entry);

  try {
    const raw = sessionStorage.getItem(SEARCH_CACHE_STORAGE_KEY);
    const stored: Record<string, CachedSearchResult> = raw
      ? (JSON.parse(raw) as Record<string, CachedSearchResult>)
      : {};
    stored[key] = entry;

    const keys = Object.keys(stored);
    if (keys.length > MAX_SEARCH_CACHE_ENTRIES) {
      keys
        .sort((a, b) => (stored[a]?.cachedAt ?? 0) - (stored[b]?.cachedAt ?? 0))
        .slice(0, keys.length - MAX_SEARCH_CACHE_ENTRIES)
        .forEach((k) => delete stored[k]);
    }

    sessionStorage.setItem(SEARCH_CACHE_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Ignore storage quota errors
  }
}

export function getCachedTrackIsrc(trackId: string): string | null | undefined {
  if (!trackId) return undefined;
  if (trackIsrcMemoryCache.has(trackId)) {
    return trackIsrcMemoryCache.get(trackId);
  }
  try {
    const raw = sessionStorage.getItem(ISRC_CACHE_STORAGE_KEY);
    if (!raw) return undefined;
    const stored = JSON.parse(raw) as Record<string, string | null>;
    if (stored && Object.prototype.hasOwnProperty.call(stored, trackId)) {
      const value = stored[trackId] ?? null;
      trackIsrcMemoryCache.set(trackId, value);
      return value;
    }
  } catch {
    // Ignore storage errors
  }
  return undefined;
}

export function setCachedTrackIsrc(trackId: string, isrc: string | null): void {
  if (!trackId) return;
  const normalized = isrc ? isrc.trim().toUpperCase() : null;

  if (trackIsrcMemoryCache.size >= MAX_ISRC_CACHE_ENTRIES && !trackIsrcMemoryCache.has(trackId)) {
    const oldest = trackIsrcMemoryCache.keys().next().value;
    if (oldest !== undefined) {
      trackIsrcMemoryCache.delete(oldest);
    }
  }
  trackIsrcMemoryCache.set(trackId, normalized);

  try {
    const raw = sessionStorage.getItem(ISRC_CACHE_STORAGE_KEY);
    const stored: Record<string, string | null> = raw
      ? (JSON.parse(raw) as Record<string, string | null>)
      : {};
    stored[trackId] = normalized;
    const keys = Object.keys(stored);
    if (keys.length > MAX_ISRC_CACHE_ENTRIES) {
      keys.slice(0, keys.length - MAX_ISRC_CACHE_ENTRIES).forEach((k) => delete stored[k]);
    }
    sessionStorage.setItem(ISRC_CACHE_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Ignore storage quota errors
  }
}

export function hydrateTracksWithCachedIsrc(tracks: TrackItem[]): TrackItem[] {
  return tracks.map((track) => {
    if (track.isrc) return track;
    const cached = getCachedTrackIsrc(track.id);
    if (typeof cached === 'string' && cached) {
      return { ...track, isrc: cached };
    }
    return track;
  });
}

export function loadCachedQuickTryTracks(): TrackItem[] {
  try {
    const raw = localStorage.getItem(QUICK_TRY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TrackItem[]) : [];
  } catch {
    return [];
  }
}

export function saveCachedQuickTryTracks(tracks: TrackItem[]): void {
  if (!Array.isArray(tracks) || tracks.length === 0) return;
  try {
    localStorage.setItem(QUICK_TRY_STORAGE_KEY, JSON.stringify(tracks));
  } catch {
    // Ignore storage quota errors
  }
}

export function syncQuickTryChartHistory(tracks: TrackItem[]): TrackItem[] {
  if (!Array.isArray(tracks) || tracks.length === 0) return tracks;

  const todayKey = new Date().toISOString().slice(0, 10);
  const currentRanks: Record<string, number> = {};
  tracks.forEach((track, idx) => {
    const key = track.isrc?.trim().toUpperCase() || track.id;
    currentRanks[key] = track.rank ?? idx + 1;
  });

  try {
    const raw = localStorage.getItem(CHART_HISTORY_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as { days?: Record<string, Record<string, number>> }) : {};
    const days: Record<string, Record<string, number>> =
      parsed && typeof parsed.days === 'object' && parsed.days !== null ? parsed.days : {};

    const previousDates = Object.keys(days)
      .filter((d) => d < todayKey)
      .sort();
    const prevDateKey = previousDates[previousDates.length - 1];
    const prevRanks = prevDateKey ? days[prevDateKey] : null;

    const syncedTracks = prevRanks
      ? tracks.map((track, idx) => {
          const rank = track.rank ?? idx + 1;
          const key = track.isrc?.trim().toUpperCase() || track.id;
          const prevRank = prevRanks[key];
          const rankChange: number | 'NEW' =
            typeof prevRank === 'number' ? prevRank - rank : 'NEW';
          return { ...track, rank, rankChange };
        })
      : tracks;

    days[todayKey] = currentRanks;
    const trimmedDays: Record<string, Record<string, number>> = {};
    for (const dateKey of Object.keys(days).sort().slice(-14)) {
      trimmedDays[dateKey] = days[dateKey];
    }
    localStorage.setItem(CHART_HISTORY_STORAGE_KEY, JSON.stringify({ days: trimmedDays }));
    return syncedTracks;
  } catch {
    return tracks;
  }
}

export function loadRecentTracks(): TrackItem[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_RECENT_TRACKS) as TrackItem[];
  } catch {
    return [];
  }
}

export function saveRecentTrack(track: TrackItem): TrackItem[] {
  const existing = loadRecentTracks();
  const deduped = [track, ...existing.filter((item) => item.id !== track.id)].slice(
    0,
    MAX_RECENT_TRACKS
  );
  try {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(deduped));
  } catch {
    // Ignore storage quota errors
  }
  return deduped;
}

export function clearRecentTracksStorage(): void {
  try {
    localStorage.removeItem(RECENT_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function loadGuideExpandedPreference(): boolean {
  try {
    const raw = localStorage.getItem(GUIDE_OPEN_STORAGE_KEY);
    if (raw === null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}

export function saveGuideExpandedPreference(isOpen: boolean): void {
  try {
    localStorage.setItem(GUIDE_OPEN_STORAGE_KEY, String(isOpen));
  } catch {
    // Ignore storage errors
  }
}
