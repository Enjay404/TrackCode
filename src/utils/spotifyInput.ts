import type { TrackItem } from '../types/track';

const RECENT_STORAGE_KEY = 'trackcode_recent_tracks_v1';
const GUIDE_OPEN_STORAGE_KEY = 'trackcode_ig_guide_open_v1';
const MAX_RECENT_TRACKS = 8;

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
        // Silent catch; fallback happens if needed
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

const POPULAR_HITS_CACHE_KEY = 'trackcode_popular_hits_v1';
const POPULAR_HITS_TTL_MS = 6 * 60 * 60 * 1000;

export function loadCachedPopularHits(): TrackItem[] {
  try {
    const raw = localStorage.getItem(POPULAR_HITS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { tracks?: TrackItem[]; cachedAt?: number };
    if (!parsed || !Array.isArray(parsed.tracks) || !parsed.cachedAt) return [];
    if (Date.now() - parsed.cachedAt > POPULAR_HITS_TTL_MS) return [];
    return parsed.tracks;
  } catch {
    return [];
  }
}

export function saveCachedPopularHits(tracks: TrackItem[]): void {
  try {
    localStorage.setItem(
      POPULAR_HITS_CACHE_KEY,
      JSON.stringify({ tracks, cachedAt: Date.now() })
    );
  } catch {
    // Ignore storage quota errors
  }
}
