import type { TrackItem } from '../types/track';

const RECENT_STORAGE_KEY = 'trackcode_recent_tracks_v1';
const GUIDE_OPEN_STORAGE_KEY = 'trackcode_ig_guide_open_v1';
const SEARCH_CACHE_STORAGE_KEY = 'trackcode_search_cache_v1';
const MAX_RECENT_TRACKS = 8;
const MAX_SEARCH_CACHE_ENTRIES = 40;
const SEARCH_CACHE_TTL_MS = 15 * 60 * 1000;

const searchMemoryCache = new Map<string, { tracks: TrackItem[]; cachedAt: number }>();

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

export function syncCopyIsrc(isrc: string): boolean {
  const formatted = formatIsrcCode(isrc);
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      // Triggered synchronously inside tap handler to preserve iOS/mobile user gesture activation
      void navigator.clipboard.writeText(formatted).catch(() => {
        // Fallback happens if needed
      });
      return true;
    }
  } catch {
    // Fallback below
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = formatted;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function getCachedSearchResults(rawQuery: string): TrackItem[] | null {
  const key = rawQuery.trim().toLowerCase();
  if (!key) return null;

  const now = Date.now();
  const memEntry = searchMemoryCache.get(key);
  if (memEntry) {
    if (now - memEntry.cachedAt <= SEARCH_CACHE_TTL_MS) {
      return memEntry.tracks;
    }
    searchMemoryCache.delete(key);
  }

  try {
    const raw = sessionStorage.getItem(SEARCH_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Record<string, { tracks: TrackItem[]; cachedAt: number }>;
    const entry = stored?.[key];
    if (!entry || !Array.isArray(entry.tracks)) return null;
    if (now - entry.cachedAt > SEARCH_CACHE_TTL_MS) return null;

    searchMemoryCache.set(key, entry);
    return entry.tracks;
  } catch {
    return null;
  }
}

export function setCachedSearchResults(rawQuery: string, tracks: TrackItem[]): void {
  const key = rawQuery.trim().toLowerCase();
  if (!key) return;

  const entry = { tracks, cachedAt: Date.now() };
  if (searchMemoryCache.size >= MAX_SEARCH_CACHE_ENTRIES && !searchMemoryCache.has(key)) {
    const oldest = searchMemoryCache.keys().next().value;
    if (oldest !== undefined) {
      searchMemoryCache.delete(oldest);
    }
  }
  searchMemoryCache.set(key, entry);

  try {
    const raw = sessionStorage.getItem(SEARCH_CACHE_STORAGE_KEY);
    const stored: Record<string, { tracks: TrackItem[]; cachedAt: number }> = raw
      ? (JSON.parse(raw) as Record<string, { tracks: TrackItem[]; cachedAt: number }>)
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

export function loadRecentTracks(): TrackItem[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_RECENT_TRACKS);
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
