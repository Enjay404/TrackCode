import express, { type Request, type Response } from 'express';
import { readFile, writeFile } from 'node:fs/promises';
import type { AlbumType, ChartRegion, TrackItem } from '../src/types/track.js';

const UPSTREAM_TIMEOUT_MS = 8000;

class SpotifyRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('SPOTIFY_RATE_LIMITED');
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

class BoundedTtlCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }
}

let tokenCache: TokenCache | null = null;
let inflightTokenPromise: Promise<string> | null = null;
let spotifyRateLimitedUntil = 0;

function parseRetryAfterSeconds(res: globalThis.Response): number {
  const header = res.headers.get('retry-after');
  const parsed = header ? Number.parseInt(header, 10) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed, 300);
  }
  return 30;
}

function assertNotRateLimited(): void {
  const now = Date.now();
  if (now < spotifyRateLimitedUntil) {
    const remainingSec = Math.max(1, Math.ceil((spotifyRateLimitedUntil - now) / 1000));
    throw new SpotifyRateLimitError(remainingSec);
  }
}

function recordRateLimit(res: globalThis.Response): never {
  const retryAfterSec = parseRetryAfterSeconds(res);
  spotifyRateLimitedUntil = Date.now() + retryAfterSec * 1000;
  throw new SpotifyRateLimitError(retryAfterSec);
}

function getSpotifyCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim() || '';

  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CREDENTIALS_MISSING');
  }

  return { clientId, clientSecret };
}

async function fetchSpotifyToken(forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken;
  }

  assertNotRateLimited();

  if (!forceRefresh && inflightTokenPromise) {
    return inflightTokenPromise;
  }

  inflightTokenPromise = (async () => {
    const { clientId, clientSecret } = getSpotifyCredentials();
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (response.status === 429) {
      recordRateLimit(response);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`SPOTIFY_AUTH_FAILED:${response.status}:${text}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return tokenCache.accessToken;
  })();

  try {
    return await inflightTokenPromise;
  } finally {
    inflightTokenPromise = null;
  }
}

async function spotifyGet<T>(url: string): Promise<T> {
  assertNotRateLimited();

  let token = await fetchSpotifyToken(false);
  let res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (res.status === 401) {
    token = await fetchSpotifyToken(true);
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  }

  if (res.status === 429) {
    recordRateLimit(res);
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    const err = new Error(`SPOTIFY_API_ERROR:${res.status}:${errBody}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  return (await res.json()) as T;
}

interface SpotifyImage {
  url: string;
  height?: number | null;
  width?: number | null;
}

interface SpotifyRawTrack {
  id: string;
  name: string;
  explicit?: boolean;
  artists?: Array<{ name: string }>;
  album?: {
    name?: string;
    album_type?: string;
    release_date?: string;
    images?: SpotifyImage[];
  };
  external_ids?: {
    isrc?: string;
  };
  external_urls?: {
    spotify?: string;
  };
}

function normalizeAlbumType(rawType?: string): AlbumType {
  if (rawType === 'single' || rawType === 'compilation' || rawType === 'album') {
    return rawType;
  }
  return 'album';
}

function normalizeTrack(raw: SpotifyRawTrack): TrackItem {
  const images = Array.isArray(raw.album?.images) ? raw.album.images : [];
  const sortedBySize = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  const large = sortedBySize[0]?.url ?? null;
  const medium =
    sortedBySize.find((img) => (img.width ?? 0) <= 320 && (img.width ?? 0) >= 200)?.url ??
    sortedBySize[1]?.url ??
    large;

  const artistNames = (raw.artists ?? []).map((a) => a.name).filter(Boolean);
  const rawIsrc = raw.external_ids?.isrc?.trim().toUpperCase();
  const cleanIsrc = rawIsrc && /^[A-Z0-9]{12}$/.test(rawIsrc) ? rawIsrc : rawIsrc || null;

  const releaseDate = raw.album?.release_date ?? '';
  const yearMatch = releaseDate.match(/^(\d{4})/);

  return {
    id: raw.id,
    name: raw.name,
    artists: artistNames.join(', ') || 'Unknown Artist',
    primaryArtist: artistNames[0] || 'Unknown Artist',
    albumName: raw.album?.name || '',
    albumType: normalizeAlbumType(raw.album?.album_type),
    releaseYear: yearMatch ? yearMatch[1] : '',
    explicit: Boolean(raw.explicit),
    albumArt: {
      medium,
      large,
    },
    isrc: cleanIsrc,
    spotifyUrl: raw.external_urls?.spotify || `https://open.spotify.com/track/${raw.id}`,
    source: 'spotify',
  };
}

interface DeezerSearchTrack {
  id: number;
  title?: string;
  explicit_lyrics?: boolean;
  link?: string;
  artist?: { name?: string };
  album?: {
    title?: string;
    cover_medium?: string;
    cover_big?: string;
    cover?: string;
    record_type?: string;
  };
}

interface DeezerTrackDetail extends DeezerSearchTrack {
  isrc?: string;
  release_date?: string;
  contributors?: Array<{ name?: string }>;
}

function normalizeDeezerTrack(detail: DeezerTrackDetail): TrackItem {
  const rawIsrc = detail.isrc?.trim().toUpperCase();
  const cleanIsrc = rawIsrc && /^[A-Z0-9]{12}$/.test(rawIsrc) ? rawIsrc : rawIsrc || null;
  const contributorNames = (detail.contributors ?? [])
    .map((c) => c.name?.trim())
    .filter((name): name is string => Boolean(name));
  const primaryArtist = detail.artist?.name?.trim() || contributorNames[0] || 'Unknown Artist';
  const artists =
    contributorNames.length > 0 ? contributorNames.join(', ') : primaryArtist;

  const coverMedium =
    detail.album?.cover_medium || detail.album?.cover_big || detail.album?.cover || null;
  const coverLarge =
    detail.album?.cover_big || detail.album?.cover_medium || detail.album?.cover || null;
  const yearMatch = (detail.release_date ?? '').match(/^(\d{4})/);

  return {
    id: `dz-${detail.id}`,
    name: detail.title || 'Unknown Track',
    artists,
    primaryArtist,
    albumName: detail.album?.title || '',
    albumType: normalizeAlbumType(detail.album?.record_type),
    releaseYear: yearMatch ? yearMatch[1] : '',
    explicit: Boolean(detail.explicit_lyrics),
    albumArt: {
      medium: coverMedium,
      large: coverLarge,
    },
    isrc: cleanIsrc,
    spotifyUrl: detail.link || `https://www.deezer.com/track/${detail.id}`,
    source: 'deezer',
  };
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function extractTitleFromSpotifyOembed(rawQuery: string): Promise<string | null> {
  let targetUrl = rawQuery.trim();
  const trackId = extractTrackIdFromText(targetUrl);
  if (!/spotify\.com\//i.test(targetUrl) && trackId) {
    targetUrl = `https://open.spotify.com/track/${trackId}`;
  } else if (/^open\.spotify\.com\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  if (!/spotify\.com\//i.test(targetUrl)) {
    return null;
  }

  const [oembedResult, pageResult] = await Promise.allSettled([
    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(targetUrl)}`, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    }).then(async (res) => (res.ok ? ((await res.json()) as { title?: string }) : null)),
    fetch(targetUrl, {
      signal: AbortSignal.timeout(3500),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; TrackCodeBot/1.0; +https://trackcode.vercel.app)',
      },
    }).then(async (res) => (res.ok ? await res.text() : '')),
  ]);

  const oembedTitle =
    oembedResult.status === 'fulfilled' ? oembedResult.value?.title?.trim() || null : null;

  if (pageResult.status === 'fulfilled' && pageResult.value) {
    const html = pageResult.value;
    const ogDescMatch = html.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
    );
    if (ogDescMatch?.[1]) {
      const desc = decodeHtmlEntities(ogDescMatch[1]);
      // Typical format: "Listen to Blinding Lights on Spotify. Song · The Weeknd · 2020"
      const parts = desc.split('·').map((s) => s.trim());
      if (parts.length >= 2 && parts[1]) {
        const artist = parts[1];
        if (oembedTitle) {
          return `${oembedTitle} ${artist}`;
        }
      }
    }

    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) {
      const rawPageTitle = decodeHtmlEntities(titleMatch[1]);
      const byMatch = rawPageTitle.match(/^(.+?)\s*-\s*song(?:\s+and\s+lyrics)?\s+by\s+(.+?)\s*\|\s*Spotify$/i);
      if (byMatch?.[1] && byMatch?.[2]) {
        return `${byMatch[1].trim()} ${byMatch[2].trim()}`;
      }
    }
  }

  return oembedTitle;
}

async function searchDeezerTracks(
  rawQuery: string,
  limit = 8,
  hydrateDetails = false
): Promise<TrackItem[]> {
  let effectiveQuery = rawQuery.trim();
  if (/spotify\.com\/|spotify:|^[A-Za-z0-9]{22}$/i.test(effectiveQuery)) {
    const oembedQuery = await extractTitleFromSpotifyOembed(effectiveQuery);
    if (oembedQuery) {
      effectiveQuery = oembedQuery;
    }
  }

  const searchRes = await fetch(
    `https://api.deezer.com/search?q=${encodeURIComponent(effectiveQuery)}&limit=${limit}`,
    { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) }
  );
  if (!searchRes.ok) {
    throw new Error(`DEEZER_SEARCH_FAILED:${searchRes.status}`);
  }

  const searchJson = (await searchRes.json()) as {
    data?: DeezerSearchTrack[];
    error?: { message?: string };
  };
  if (searchJson.error) {
    throw new Error(`DEEZER_API_ERROR:${searchJson.error.message || 'Unknown error'}`);
  }

  const items = Array.isArray(searchJson.data) ? searchJson.data.slice(0, limit) : [];
  if (items.length === 0) return [];

  if (!hydrateDetails) {
    return items.map((item) => normalizeDeezerTrack(item));
  }

  const detailed = await Promise.all(
    items.map(async (item) => {
      try {
        const trackRes = await fetch(`https://api.deezer.com/track/${item.id}`, {
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        });
        if (!trackRes.ok) {
          return normalizeDeezerTrack(item);
        }
        const detail = (await trackRes.json()) as DeezerTrackDetail & { error?: unknown };
        if (!detail || detail.error || !detail.id) {
          return normalizeDeezerTrack(item);
        }
        return normalizeDeezerTrack(detail);
      } catch {
        return normalizeDeezerTrack(item);
      }
    })
  );

  return detailed;
}

const ALLOWED_REDIRECT_HOSTS = new Set([
  'open.spotify.com',
  'spotify.link',
  'spoti.fi',
  'spotify.app.link',
  'spotify.com',
  'www.spotify.com',
]);

function extractTrackIdFromText(value: string): string | null {
  const trimmed = value.trim();

  const uriMatch = trimmed.match(/spotify:(?:\/\/)?track[:/]([A-Za-z0-9]{22})/i);
  if (uriMatch) {
    return uriMatch[1];
  }

  const urlMatch = trimmed.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})/i);
  if (urlMatch) {
    return urlMatch[1];
  }

  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function isAllowedSpotifyHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return ALLOWED_REDIRECT_HOSTS.has(normalized) || normalized.endsWith('.spotify.com');
}

type NonTrackSpotifyKind = 'album' | 'playlist' | 'artist' | 'episode' | 'show';

type ResolveTrackResult =
  | { status: 'track'; trackId: string }
  | { status: 'non_track'; kind: NonTrackSpotifyKind }
  | { status: 'invalid' };

function detectNonTrackSpotifyType(value: string): NonTrackSpotifyKind | null {
  const trimmed = value.trim();
  const uriMatch = trimmed.match(
    /spotify:(?:\/\/)?(album|playlist|artist|episode|show)[:/][A-Za-z0-9]+/i
  );
  if (uriMatch) {
    return uriMatch[1].toLowerCase() as NonTrackSpotifyKind;
  }

  const urlMatch = trimmed.match(
    /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(album|playlist|artist|episode|show)\/[A-Za-z0-9]+/i
  );
  if (urlMatch) {
    return urlMatch[1].toLowerCase() as NonTrackSpotifyKind;
  }

  return null;
}

async function resolveSpotifyTrackId(rawInput: string): Promise<ResolveTrackResult> {
  const directId = extractTrackIdFromText(rawInput);
  if (directId) {
    return { status: 'track', trackId: directId };
  }

  const directNonTrack = detectNonTrackSpotifyType(rawInput);
  if (directNonTrack) {
    return { status: 'non_track', kind: directNonTrack };
  }

  const trimmed = rawInput.trim();
  const candidateUrlStr = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^(spotify\.link|spoti\.fi|open\.spotify\.com)\//i.test(trimmed)
      ? `https://${trimmed}`
      : null;

  if (!candidateUrlStr) {
    return { status: 'invalid' };
  }

  let currentUrl: URL;
  try {
    currentUrl = new URL(candidateUrlStr);
  } catch {
    return { status: 'invalid' };
  }

  if (!isAllowedSpotifyHost(currentUrl.hostname)) {
    return { status: 'invalid' };
  }

  for (let hop = 0; hop < 6; hop++) {
    const currentUrlStr = currentUrl.toString();
    const idFromUrl = extractTrackIdFromText(currentUrlStr);
    if (idFromUrl) {
      return { status: 'track', trackId: idFromUrl };
    }
    const nonTrackFromUrl = detectNonTrackSpotifyType(currentUrlStr);
    if (nonTrackFromUrl) {
      return { status: 'non_track', kind: nonTrackFromUrl };
    }

    const res = await fetch(currentUrlStr, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) break;

      const nextUrl = new URL(location, currentUrl);
      const nextUrlStr = nextUrl.toString();
      const idFromNext = extractTrackIdFromText(nextUrlStr);
      if (idFromNext) {
        return { status: 'track', trackId: idFromNext };
      }
      const nonTrackFromNext = detectNonTrackSpotifyType(nextUrlStr);
      if (nonTrackFromNext) {
        return { status: 'non_track', kind: nonTrackFromNext };
      }

      if (!isAllowedSpotifyHost(nextUrl.hostname)) {
        break;
      }
      currentUrl = nextUrl;
      continue;
    }

    if (res.ok) {
      const html = await res.text();
      const idFromHtml = extractTrackIdFromText(html);
      if (idFromHtml) {
        return { status: 'track', trackId: idFromHtml };
      }
      const nonTrackFromHtml = detectNonTrackSpotifyType(html);
      if (nonTrackFromHtml) {
        return { status: 'non_track', kind: nonTrackFromHtml };
      }
    }
    break;
  }

  return { status: 'invalid' };
}

const app = express();
app.disable('x-powered-by');
app.use(express.json());

const searchCache = new BoundedTtlCache<TrackItem[]>(250, 15 * 60 * 1000);
const deezerSearchCache = new BoundedTtlCache<TrackItem[]>(150, 5 * 60 * 1000);
const trackCache = new BoundedTtlCache<TrackItem>(300, 60 * 60 * 1000);
const isrcCache = new BoundedTtlCache<{ isrc: string | null }>(500, 24 * 60 * 60 * 1000);

interface SearchExecutionResult {
  status: number;
  cacheControl?: string;
  retryAfter?: number;
  body: Record<string, unknown>;
}

const inflightSearchPromises = new Map<string, Promise<SearchExecutionResult>>();

function shouldFallbackToDeezer(error: unknown): boolean {
  if (error instanceof SpotifyRateLimitError) return true;
  const msg = error instanceof Error ? error.message : '';
  const status = (error as Error & { status?: number })?.status;
  return (
    status === 400 ||
    status === 401 ||
    status === 429 ||
    msg === 'SPOTIFY_CREDENTIALS_MISSING' ||
    msg.startsWith('SPOTIFY_AUTH_FAILED:400') ||
    msg.startsWith('SPOTIFY_AUTH_FAILED:401') ||
    msg.startsWith('SPOTIFY_API_ERROR:400') ||
    msg.startsWith('SPOTIFY_API_ERROR:401') ||
    msg.startsWith('SPOTIFY_API_ERROR:429')
  );
}

const CHART_HISTORY_PATH = '/tmp/trackcode-chart-history.json';
const CHART_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CHART_FALLBACK_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CHART_HISTORY_DAYS = 14;
const APPLE_LK_RSS_URL =
  'https://rss.marketingtools.apple.com/api/v2/lk/music/most-played/15/songs.json';

const BASELINE_GLOBAL_CHART_RANKS: Record<string, number> = {
  USQX92600464: 2,
  QZJ842603468: 1,
  USSM12504190: 3,
  USUG12607376: 6,
  USSM12600141: 4,
  GBARL2400510: 6,
  USUM72606032: 8,
  USUG12602391: 7,
  USUG12607940: 10,
  USRC12601916: 9,
  USUG12601723: 12,
  USUM72601821: 11,
  USQX92602558: 14,
  USQX92504224: 13,
  QZ8BZ2513510: 15,
};

const BASELINE_SRI_LANKA_CHART_RANKS: Record<string, number> = {
  SE66N2615962: 2,
  QTA862682783: 1,
  USUG12607940: 4,
  INT202607381: 3,
  FRX282657409: 6,
  QZQAY2642281: 5,
  FR96X2676818: 8,
  ATR981200299: 7,
  QZQAY2529877: 10,
  INT202607391: 9,
  IND292513785: 12,
  QMFME2664386: 11,
  QT6FN2584098: 14,
  SE6SA2579015: 13,
  SE6HN2622209: 15,
};

interface ChartHistoryFile {
  days?: Record<string, Record<string, number>>;
  regions?: Partial<Record<ChartRegion, Record<string, Record<string, number>>>>;
}

interface DailyDualChartCacheEntry {
  dateKey: string;
  global: TrackItem[];
  sriLanka: TrackItem[];
  expiresAt: number;
}

let dailyChartCache: DailyDualChartCacheEntry | null = null;
let inflightDailyChartPromise: Promise<{ global: TrackItem[]; sriLanka: TrackItem[] }> | null = null;

const POPULAR_HITS_FALLBACK_TRACKS: TrackItem[] = [
  {
    id: 'dz-3818963601',
    name: 'Dracula (with JENNIE)',
    artists: 'Tame Impala, JENNIE',
    primaryArtist: 'Tame Impala',
    albumName: 'Dracula (with JENNIE)',
    albumType: 'single',
    releaseYear: '2026',
    explicit: true,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/b868399da682f34dcd7d98af1c0de80b/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/b868399da682f34dcd7d98af1c0de80b/500x500-000000-80-0-0.jpg',
    },
    isrc: 'USQX92600464',
    spotifyUrl: 'https://www.deezer.com/track/3818963601',
    source: 'deezer',
    rank: 1,
    rankChange: 1,
  },
  {
    id: 'dz-3895241341',
    name: 'Boston',
    artists: 'STELLA LEFTY',
    primaryArtist: 'STELLA LEFTY',
    albumName: 'Boston',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/66d6baca9df5092af22a710ce10d39cf/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/66d6baca9df5092af22a710ce10d39cf/500x500-000000-80-0-0.jpg',
    },
    isrc: 'QZJ842603468',
    spotifyUrl: 'https://www.deezer.com/track/3895241341',
    source: 'deezer',
    rank: 2,
    rankChange: -1,
  },
  {
    id: 'dz-3602074142',
    name: "Choosin' Texas",
    artists: 'Ella Langley',
    primaryArtist: 'Ella Langley',
    albumName: "Choosin' Texas",
    albumType: 'single',
    releaseYear: '2025',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/749ad2ad7609ec768e342bec41078095/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/749ad2ad7609ec768e342bec41078095/500x500-000000-80-0-0.jpg',
    },
    isrc: 'USSM12504190',
    spotifyUrl: 'https://www.deezer.com/track/3602074142',
    source: 'deezer',
    rank: 3,
    rankChange: 0,
  },
  {
    id: 'dz-4167204822',
    name: 'Been By Now',
    artists: 'Morgan Wallen',
    primaryArtist: 'Morgan Wallen',
    albumName: 'Been By Now',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/38e835566214fba0d9f0c71d58e16145/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/38e835566214fba0d9f0c71d58e16145/500x500-000000-80-0-0.jpg',
    },
    isrc: 'USUG12607376',
    spotifyUrl: 'https://www.deezer.com/track/4167204822',
    source: 'deezer',
    rank: 4,
    rankChange: 2,
  },
  {
    id: 'dz-3834003271',
    name: 'Be Her',
    artists: 'Ella Langley',
    primaryArtist: 'Ella Langley',
    albumName: 'Be Her',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/b1bde069e57968a190b0506aef2b6e3e/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/b1bde069e57968a190b0506aef2b6e3e/500x500-000000-80-0-0.jpg',
    },
    isrc: 'USSM12600141',
    spotifyUrl: 'https://www.deezer.com/track/3834003271',
    source: 'deezer',
    rank: 5,
    rankChange: -1,
  },
  {
    id: 'dz-2758844701',
    name: 'Stargazing',
    artists: 'Myles Smith',
    primaryArtist: 'Myles Smith',
    albumName: 'Stargazing',
    albumType: 'single',
    releaseYear: '2024',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/eaf89238495473e9d78eb75e7a181322/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/eaf89238495473e9d78eb75e7a181322/500x500-000000-80-0-0.jpg',
    },
    isrc: 'GBARL2400510',
    spotifyUrl: 'https://www.deezer.com/track/2758844701',
    source: 'deezer',
    rank: 6,
    rankChange: 0,
  },
  {
    id: 'dz-4250696681',
    name: 'Nicole Kidman',
    artists: 'ADÉLA',
    primaryArtist: 'ADÉLA',
    albumName: 'PRIMA',
    albumType: 'single',
    releaseYear: '2026',
    explicit: true,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/68502d8730fa4ce6a41e2cb4db6d2fb7/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/68502d8730fa4ce6a41e2cb4db6d2fb7/500x500-000000-80-0-0.jpg',
    },
    isrc: 'USUM72606032',
    spotifyUrl: 'https://www.deezer.com/track/4250696681',
    source: 'deezer',
    rank: 7,
    rankChange: 1,
  },
  {
    id: 'dz-4304169612',
    name: 'Patient Zero',
    artists: 'Taylor Swift',
    primaryArtist: 'Taylor Swift',
    albumName: 'The Life of a Showgirl: The Encore',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/3b43f946f6478daf5233a41414c34067/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/3b43f946f6478daf5233a41414c34067/500x500-000000-80-0-0.jpg',
    },
    isrc: 'USUG12602391',
    spotifyUrl: 'https://www.deezer.com/track/4304169612',
    source: 'deezer',
    rank: 8,
    rankChange: -1,
  },
  {
    id: 'dz-4208859922',
    name: 'BbY WOW',
    artists: 'KAROL G, Judeline, rusowsky',
    primaryArtist: 'KAROL G',
    albumName: 'NO ME ARREPIENTO DE SENTIR TANTO',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/f794dd1931dac42fc13f938850b686c6/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/f794dd1931dac42fc13f938850b686c6/500x500-000000-80-0-0.jpg',
    },
    isrc: 'USUG12607940',
    spotifyUrl: 'https://www.deezer.com/track/4208859922',
    source: 'deezer',
    rank: 9,
    rankChange: 1,
  },
  {
    id: 'dz-4350411742',
    name: 'Housewife',
    artists: 'Tate McRae',
    primaryArtist: 'Tate McRae',
    albumName: 'Housewife',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/0717657c0f9540946fb9813d3383a500/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/0717657c0f9540946fb9813d3383a500/500x500-000000-80-0-0.jpg',
    },
    isrc: 'USRC12601916',
    spotifyUrl: 'https://www.deezer.com/track/4350411742',
    source: 'deezer',
    rank: 10,
    rankChange: -1,
  },
  {
    id: 'dz-4078104881',
    name: 'stupid song',
    artists: 'Olivia Rodrigo',
    primaryArtist: 'Olivia Rodrigo',
    albumName: 'you seem pretty sad for a girl so in love',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/07d6896c8afea3a87dcf9381c3d0e6c7/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/07d6896c8afea3a87dcf9381c3d0e6c7/500x500-000000-80-0-0.jpg',
    },
    isrc: 'USUG12601723',
    spotifyUrl: 'https://www.deezer.com/track/4078104881',
    source: 'deezer',
    rank: 11,
    rankChange: 1,
  },
  {
    id: 'dz-4045817471',
    name: 'hate that i made you love me',
    artists: 'Ariana Grande',
    primaryArtist: 'Ariana Grande',
    albumName: 'hate that i made you love me',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/020b1804e8c8a2aba6770f5b2763847b/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/020b1804e8c8a2aba6770f5b2763847b/500x500-000000-80-0-0.jpg',
    },
    isrc: 'USUM72601821',
    spotifyUrl: 'https://www.deezer.com/track/4045817471',
    source: 'deezer',
    rank: 12,
    rankChange: -1,
  },
  {
    id: 'dz-4015341011',
    name: 'Dai Dai',
    artists: 'Shakira, Burna Boy',
    primaryArtist: 'Shakira',
    albumName: 'Dai Dai',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/a7f9bae0243c512059298a68d09f45a1/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/a7f9bae0243c512059298a68d09f45a1/500x500-000000-80-0-0.jpg',
    },
    isrc: 'USQX92602558',
    spotifyUrl: 'https://www.deezer.com/track/4015341011',
    source: 'deezer',
    rank: 13,
    rankChange: 1,
  },
  {
    id: 'dz-3602329332',
    name: 'Loser',
    artists: 'Tame Impala',
    primaryArtist: 'Tame Impala',
    albumName: 'Deadbeat',
    albumType: 'single',
    releaseYear: '2025',
    explicit: true,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/23b006b2e956536d97612847bbd7a3b7/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/23b006b2e956536d97612847bbd7a3b7/500x500-000000-80-0-0.jpg',
    },
    isrc: 'USQX92504224',
    spotifyUrl: 'https://www.deezer.com/track/3602329332',
    source: 'deezer',
    rank: 14,
    rankChange: -1,
  },
  {
    id: 'dz-3412534581',
    name: 'Golden',
    artists: 'HUNTR/X, EJAE, AUDREY NUNA, REI AMI, KPop Demon Hunters Cast',
    primaryArtist: 'HUNTR/X',
    albumName: 'KPop Demon Hunters (Soundtrack from the Netflix Film)',
    albumType: 'single',
    releaseYear: '2025',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/e54bda0628749119f7a9a05b71b40283/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/e54bda0628749119f7a9a05b71b40283/500x500-000000-80-0-0.jpg',
    },
    isrc: 'QZ8BZ2513510',
    spotifyUrl: 'https://www.deezer.com/track/3412534581',
    source: 'deezer',
    rank: 15,
    rankChange: 'NEW',
  },
];

const SRI_LANKA_FALLBACK_TRACKS: TrackItem[] = [
  {
    id: 'dz-4384883221',
    name: 'Noyanu Hitha Ma',
    artists: 'Uvindu Ayshcharya, Dilu Beats',
    primaryArtist: 'Uvindu Ayshcharya',
    albumName: 'Noyanu Hitha Ma',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/c10ea0c9c6f6f0f2db4ec91634d5e616/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/c10ea0c9c6f6f0f2db4ec91634d5e616/500x500-000000-80-0-0.jpg',
    },
    isrc: 'SE66N2615962',
    spotifyUrl: 'https://www.deezer.com/track/4384883221',
    source: 'deezer',
    rank: 1,
    rankChange: 1,
  },
  {
    id: 'dz-4373796001',
    name: 'Guru Pata Handewa',
    artists: 'Sereena Batagoda',
    primaryArtist: 'Sereena Batagoda',
    albumName: 'Guru Pata Handewa',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/69ec2b63d867e8380e28bc2de11c07c0/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/69ec2b63d867e8380e28bc2de11c07c0/500x500-000000-80-0-0.jpg',
    },
    isrc: 'QTA862682783',
    spotifyUrl: 'https://www.deezer.com/track/4373796001',
    source: 'deezer',
    rank: 2,
    rankChange: -1,
  },
  {
    id: 'dz-4328164292',
    name: 'Nura Ananthe',
    artists: 'Cozzy, Kshia',
    primaryArtist: 'Cozzy',
    albumName: 'Nura Ananthe',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/950751727c896cf68900be866202feef/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/950751727c896cf68900be866202feef/500x500-000000-80-0-0.jpg',
    },
    isrc: 'FRX282657409',
    spotifyUrl: 'https://www.deezer.com/track/4328164292',
    source: 'deezer',
    rank: 3,
    rankChange: 0,
  },
  {
    id: 'dz-4264287982',
    name: 'Bowitiya Mal',
    artists: 'Ravi Jay, Nipuni Sharada',
    primaryArtist: 'Ravi Jay',
    albumName: 'Bowitiya Mal',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/b8fa9a2fbca44715396e3cfdd75790d7/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/b8fa9a2fbca44715396e3cfdd75790d7/500x500-000000-80-0-0.jpg',
    },
    isrc: 'QZQAY2642281',
    spotifyUrl: 'https://www.deezer.com/track/4264287982',
    source: 'deezer',
    rank: 4,
    rankChange: 1,
  },
  {
    id: 'dz-4002273351',
    name: 'Mandaaram Handaawe',
    artists: 'Channuka, Cozzy',
    primaryArtist: 'Channuka',
    albumName: 'Mandaaram Handaawe',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/3694e0fee5036d636fdd1587369b23f2/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/3694e0fee5036d636fdd1587369b23f2/500x500-000000-80-0-0.jpg',
    },
    isrc: 'FR96X2676818',
    spotifyUrl: 'https://www.deezer.com/track/4002273351',
    source: 'deezer',
    rank: 5,
    rankChange: 2,
  },
  {
    id: 'dz-2576424452',
    name: 'Sansarini',
    artists: 'Yasas Medagedara',
    primaryArtist: 'Yasas Medagedara',
    albumName: 'Sansarini',
    albumType: 'single',
    releaseYear: '2019',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/b0871217507a48729831a4d90dd43d14/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/b0871217507a48729831a4d90dd43d14/500x500-000000-80-0-0.jpg',
    },
    isrc: 'ATR981200299',
    spotifyUrl: 'https://www.deezer.com/track/2576424452',
    source: 'deezer',
    rank: 6,
    rankChange: -1,
  },
  {
    id: 'dz-3284205681',
    name: 'Oba Maage Aadare',
    artists: 'Channuka, Cozzy',
    primaryArtist: 'Channuka',
    albumName: 'Oba Maage Aadare',
    albumType: 'single',
    releaseYear: '2025',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/738bd109665de65a1e3c5c4903e2a9e8/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/738bd109665de65a1e3c5c4903e2a9e8/500x500-000000-80-0-0.jpg',
    },
    isrc: 'QZQAY2529877',
    spotifyUrl: 'https://www.deezer.com/track/3284205681',
    source: 'deezer',
    rank: 7,
    rankChange: 1,
  },
  {
    id: 'dz-3722664782',
    name: 'Bo Mal (feat. Ranudi de Zoysa)',
    artists: 'janana, Ranudi De Zoysa',
    primaryArtist: 'janana',
    albumName: 'Bo Mal (feat. Ranudi de Zoysa)',
    albumType: 'single',
    releaseYear: '2025',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/8d9bc98bd6b1bd52fb87b01f2e708a67/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/8d9bc98bd6b1bd52fb87b01f2e708a67/500x500-000000-80-0-0.jpg',
    },
    isrc: 'QT6FN2584098',
    spotifyUrl: 'https://www.deezer.com/track/3722664782',
    source: 'deezer',
    rank: 8,
    rankChange: 0,
  },
  {
    id: 'dz-3596389352',
    name: 'Me Hitha Sanasa',
    artists: 'Uvindu Ayshcharya, Dilu Beats',
    primaryArtist: 'Uvindu Ayshcharya',
    albumName: 'Me Hitha Sanasa',
    albumType: 'single',
    releaseYear: '2025',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/4353ac09f192cffb6e7b80f596c3e4be/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/4353ac09f192cffb6e7b80f596c3e4be/500x500-000000-80-0-0.jpg',
    },
    isrc: 'SE6SA2579015',
    spotifyUrl: 'https://www.deezer.com/track/3596389352',
    source: 'deezer',
    rank: 9,
    rankChange: 1,
  },
  {
    id: 'dz-3915183491',
    name: 'Api Aye Hamuwela',
    artists: 'Uvindu Ayshcharya, Dilu Beats',
    primaryArtist: 'Uvindu Ayshcharya',
    albumName: 'Api Aye Hamuwela',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/9eaeb474b4bc2160303eb08ceba4fbf3/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/9eaeb474b4bc2160303eb08ceba4fbf3/500x500-000000-80-0-0.jpg',
    },
    isrc: 'SE6HN2622209',
    spotifyUrl: 'https://www.deezer.com/track/3915183491',
    source: 'deezer',
    rank: 10,
    rankChange: -1,
  },
  {
    id: 'dz-2129182507',
    name: 'Numba Ha',
    artists: 'Dilu Beats',
    primaryArtist: 'Dilu Beats',
    albumName: 'Numba Ha',
    albumType: 'single',
    releaseYear: '2023',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/a8e586fa377fc3716afd1df54160d8ea/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/a8e586fa377fc3716afd1df54160d8ea/500x500-000000-80-0-0.jpg',
    },
    isrc: 'SE5BU2363737',
    spotifyUrl: 'https://www.deezer.com/track/2129182507',
    source: 'deezer',
    rank: 11,
    rankChange: 0,
  },
  {
    id: 'dz-639609212',
    name: 'Saragaye',
    artists: 'SANUKA',
    primaryArtist: 'SANUKA',
    albumName: 'Saragaye',
    albumType: 'single',
    releaseYear: '2019',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/fe6c49a84905c1f61d1335bc9372462c/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/fe6c49a84905c1f61d1335bc9372462c/500x500-000000-80-0-0.jpg',
    },
    isrc: 'ATR981194414',
    spotifyUrl: 'https://www.deezer.com/track/639609212',
    source: 'deezer',
    rank: 12,
    rankChange: 1,
  },
  {
    id: 'dz-1398346782',
    name: 'Manike Mage Hithe',
    artists: 'Chamath Sangeeth, Yohani, Satheeshan',
    primaryArtist: 'Chamath Sangeeth',
    albumName: 'Manike Mage Hithe',
    albumType: 'single',
    releaseYear: '2021',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/01c20272f58f33c9a20416c3b46f7919/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/01c20272f58f33c9a20416c3b46f7919/500x500-000000-80-0-0.jpg',
    },
    isrc: 'ATR981232884',
    spotifyUrl: 'https://www.deezer.com/track/1398346782',
    source: 'deezer',
    rank: 13,
    rankChange: -1,
  },
  {
    id: 'dz-4275410732',
    name: 'Magale (From "Baththa")',
    artists: 'Sai Abhyankkar, Harini, Karthik Netha',
    primaryArtist: 'Sai Abhyankkar',
    albumName: 'Magale (From "Baththa")',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/237407002fc9a79781638cf99d2f8f73/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/237407002fc9a79781638cf99d2f8f73/500x500-000000-80-0-0.jpg',
    },
    isrc: 'INT202607391',
    spotifyUrl: 'https://www.deezer.com/track/4275410732',
    source: 'deezer',
    rank: 14,
    rankChange: 1,
  },
  {
    id: 'dz-4319474642',
    name: 'One Name',
    artists: 'Anirudh Ravichander, Super Subu',
    primaryArtist: 'Anirudh Ravichander',
    albumName: 'Jailer 2 (Original Motion Picture Soundtrack)',
    albumType: 'single',
    releaseYear: '2026',
    explicit: false,
    albumArt: {
      medium: 'https://cdn-images.dzcdn.net/images/cover/5e1cf215697b2c9b1bd73198a4ddd231/250x250-000000-80-0-0.jpg',
      large: 'https://cdn-images.dzcdn.net/images/cover/5e1cf215697b2c9b1bd73198a4ddd231/500x500-000000-80-0-0.jpg',
    },
    isrc: 'QMFME2664386',
    spotifyUrl: 'https://www.deezer.com/track/4319474642',
    source: 'deezer',
    rank: 15,
    rankChange: 'NEW',
  },
];

function getUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function getChartTrackKey(track: TrackItem): string {
  return track.isrc?.trim().toUpperCase() || track.id;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchDeezerJson<T extends { error?: { code?: number } }>(
  url: string
): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!res.ok) {
        if (attempt === 0) {
          await sleep(300);
          continue;
        }
        return null;
      }
      const data = (await res.json()) as T;
      if (data && data.error?.code === 4 && attempt === 0) {
        await sleep(350);
        continue;
      }
      return data;
    } catch {
      if (attempt === 0) {
        await sleep(250);
      }
    }
  }
  return null;
}

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  delayMs: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await sleep(delayMs);
    }
  }
  return results;
}

async function readChartHistory(): Promise<ChartHistoryFile> {
  try {
    const raw = await readFile(CHART_HISTORY_PATH, 'utf8');
    const parsed = JSON.parse(raw) as ChartHistoryFile;
    if (parsed && typeof parsed === 'object') {
      return {
        days: parsed.days && typeof parsed.days === 'object' ? parsed.days : {},
        regions: parsed.regions && typeof parsed.regions === 'object' ? parsed.regions : {},
      };
    }
  } catch {
    // Missing or unreadable snapshot file on cold start
  }
  return { days: {}, regions: {} };
}

function trimChartDays(
  days: Record<string, Record<string, number>>
): Record<string, Record<string, number>> {
  const sortedDates = Object.keys(days).sort();
  const trimmed: Record<string, Record<string, number>> = {};
  for (const dateKey of sortedDates.slice(-MAX_CHART_HISTORY_DAYS)) {
    trimmed[dateKey] = days[dateKey];
  }
  return trimmed;
}

async function writeChartHistory(history: ChartHistoryFile): Promise<void> {
  try {
    const trimmedRegions: Partial<Record<ChartRegion, Record<string, Record<string, number>>>> = {};
    if (history.regions?.global) {
      trimmedRegions.global = trimChartDays(history.regions.global);
    }
    if (history.regions?.sriLanka) {
      trimmedRegions.sriLanka = trimChartDays(history.regions.sriLanka);
    }
    await writeFile(
      CHART_HISTORY_PATH,
      JSON.stringify({
        days: trimChartDays(history.days ?? {}),
        regions: trimmedRegions,
      }),
      'utf8'
    );
  } catch {
    // Ignore read-only filesystem errors
  }
}

function rankTracksForRegion(
  rawTracks: TrackItem[],
  region: ChartRegion,
  history: ChartHistoryFile,
  dateKey: string
): { ranked: TrackItem[]; todayRanks: Record<string, number>; changed: boolean } {
  const regionHistory: Record<string, Record<string, number>> = {
    ...(region === 'global' ? history.days : undefined),
    ...history.regions?.[region],
  };

  const previousDates = Object.keys(regionHistory)
    .filter((d) => d < dateKey)
    .sort();
  const previousDayKey = previousDates[previousDates.length - 1];
  const previousRanks = previousDayKey
    ? regionHistory[previousDayKey]
    : region === 'global'
      ? BASELINE_GLOBAL_CHART_RANKS
      : BASELINE_SRI_LANKA_CHART_RANKS;

  const todayRanks: Record<string, number> = {};
  const ranked = rawTracks.map((track, index) => {
    const rank = index + 1;
    const key = getChartTrackKey(track);
    todayRanks[key] = rank;

    const previousRank = previousRanks[key];
    const rankChange: number | 'NEW' =
      typeof previousRank === 'number' ? previousRank - rank : 'NEW';

    return {
      ...track,
      rank,
      rankChange,
    };
  });

  const changed = !history.regions?.[region]?.[dateKey];
  return { ranked, todayRanks, changed };
}

async function applyDualChartRankHistory(
  rawGlobal: TrackItem[],
  rawSriLanka: TrackItem[],
  dateKey: string
): Promise<{ global: TrackItem[]; sriLanka: TrackItem[] }> {
  const history = await readChartHistory();
  if (!history.regions) history.regions = {};

  const globalOutcome = rankTracksForRegion(rawGlobal, 'global', history, dateKey);
  const sriLankaOutcome = rankTracksForRegion(rawSriLanka, 'sriLanka', history, dateKey);

  if (globalOutcome.changed || sriLankaOutcome.changed) {
    if (globalOutcome.changed) {
      history.regions.global = {
        ...(history.regions.global ?? {}),
        [dateKey]: globalOutcome.todayRanks,
      };
    }
    if (sriLankaOutcome.changed) {
      history.regions.sriLanka = {
        ...(history.regions.sriLanka ?? {}),
        [dateKey]: sriLankaOutcome.todayRanks,
      };
    }
    await writeChartHistory(history);
  }

  return {
    global: globalOutcome.ranked,
    sriLanka: sriLankaOutcome.ranked,
  };
}

async function fetchRawGlobalChartTracks(): Promise<{ tracks: TrackItem[]; usedFallback: boolean }> {
  try {
    const chartPayload = await fetchDeezerJson<{
      data?: DeezerSearchTrack[];
      error?: { code?: number };
    }>('https://api.deezer.com/chart/0/tracks?limit=15');
    const chartEntries = Array.isArray(chartPayload?.data) ? chartPayload.data.slice(0, 15) : [];
    if (chartEntries.length === 0) {
      throw new Error('DEEZER_CHART_EMPTY');
    }

    const detailResults = await mapInBatches(chartEntries, 5, 120, async (item): Promise<TrackItem | null> => {
      const detail = await fetchDeezerJson<DeezerTrackDetail & { error?: { code?: number } }>(
        `https://api.deezer.com/track/${item.id}`
      );
      if (!detail || detail.error || !detail.id) return null;
      return normalizeDeezerTrack(detail);
    });

    const tracks = detailResults.filter((t): t is TrackItem => Boolean(t));
    if (tracks.length < 5) {
      throw new Error('DEEZER_CHART_NO_DETAILS');
    }

    return { tracks, usedFallback: false };
  } catch {
    return { tracks: POPULAR_HITS_FALLBACK_TRACKS, usedFallback: true };
  }
}

interface AppleRssSong {
  id: string;
  name: string;
  artistName: string;
  releaseDate?: string;
  artworkUrl100?: string;
  contentAdvisoryRating?: string;
  url?: string;
}

function cleanAppleSongTitle(title: string): string {
  return title
    .replace(/\s*[\(\[][^\)\]]*(?:feat\.|ft\.|from|with|remix)[^\)\]]*[\)\]]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function upscaleAppleArtwork(url: string | undefined, size: number): string | null {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb(\.[a-z]+)$/i, `/${size}x${size}bb$1`);
}

async function resolveAppleSongViaDeezer(song: AppleRssSong): Promise<TrackItem | null> {
  const cleanTitle = cleanAppleSongTitle(song.name);
  const primaryArtist = song.artistName.split(/[,&]/)[0]?.trim() || song.artistName.trim();
  const queryCandidates = Array.from(
    new Set(
      [
        `${primaryArtist} ${cleanTitle}`.trim(),
        `${song.artistName} ${song.name}`.trim(),
        cleanTitle,
      ].filter(Boolean)
    )
  );

  for (const searchQuery of queryCandidates) {
    const searchJson = await fetchDeezerJson<{
      data?: DeezerSearchTrack[];
      error?: { code?: number };
    }>(`https://api.deezer.com/search?q=${encodeURIComponent(searchQuery)}&limit=1`);
    const topMatch = Array.isArray(searchJson?.data) ? searchJson.data[0] : undefined;
    if (!topMatch?.id) continue;

    const detail = await fetchDeezerJson<DeezerTrackDetail & { error?: { code?: number } }>(
      `https://api.deezer.com/track/${topMatch.id}`
    );

    const appleMedium = upscaleAppleArtwork(song.artworkUrl100, 300);
    const appleLarge = upscaleAppleArtwork(song.artworkUrl100, 600);
    const appleYear = (song.releaseDate ?? '').match(/^(\d{4})/)?.[1] ?? '';

    if (detail && !detail.error && detail.id) {
      const normalized = normalizeDeezerTrack(detail);
      return {
        ...normalized,
        releaseYear: normalized.releaseYear || appleYear,
        explicit: normalized.explicit || song.contentAdvisoryRating === 'Explicit',
        albumArt: {
          medium: normalized.albumArt.medium || appleMedium,
          large: normalized.albumArt.large || appleLarge,
        },
      };
    }

    const basicNormalized = normalizeDeezerTrack(topMatch);
    return {
      ...basicNormalized,
      releaseYear: basicNormalized.releaseYear || appleYear,
      explicit: basicNormalized.explicit || song.contentAdvisoryRating === 'Explicit',
      albumArt: {
        medium: basicNormalized.albumArt.medium || appleMedium,
        large: basicNormalized.albumArt.large || appleLarge,
      },
    };
  }

  return null;
}

async function fetchRawSriLankaChartTracks(): Promise<{ tracks: TrackItem[]; usedFallback: boolean }> {
  try {
    const rssRes = await fetch(APPLE_LK_RSS_URL, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!rssRes.ok) {
      throw new Error(`APPLE_LK_RSS_ERROR:${rssRes.status}`);
    }

    const rssPayload = (await rssRes.json()) as {
      feed?: { results?: AppleRssSong[] };
    };
    const appleSongs = Array.isArray(rssPayload.feed?.results)
      ? rssPayload.feed.results.slice(0, 15)
      : [];
    if (appleSongs.length < 4) {
      throw new Error('APPLE_LK_RSS_INSUFFICIENT');
    }

    const resolvedResults = await mapInBatches(appleSongs, 5, 140, (song) =>
      resolveAppleSongViaDeezer(song)
    );
    const resolvedTracks = resolvedResults.filter((t): t is TrackItem => Boolean(t));

    if (resolvedTracks.length < 4) {
      throw new Error('SRI_LANKA_DEEZER_INSUFFICIENT');
    }

    return { tracks: resolvedTracks, usedFallback: false };
  } catch {
    return { tracks: SRI_LANKA_FALLBACK_TRACKS, usedFallback: true };
  }
}

async function fetchDailyDualCharts(): Promise<{ global: TrackItem[]; sriLanka: TrackItem[] }> {
  const todayKey = getUtcDateKey();
  if (dailyChartCache && dailyChartCache.dateKey === todayKey && dailyChartCache.expiresAt > Date.now()) {
    return { global: dailyChartCache.global, sriLanka: dailyChartCache.sriLanka };
  }

  if (inflightDailyChartPromise) {
    return inflightDailyChartPromise;
  }

  inflightDailyChartPromise = (async () => {
    const globalResult = await fetchRawGlobalChartTracks();
    await sleep(150);
    const sriLankaResult = await fetchRawSriLankaChartTracks();

    const ranked = await applyDualChartRankHistory(
      globalResult.tracks,
      sriLankaResult.tracks,
      todayKey
    );

    const anyFallback = globalResult.usedFallback || sriLankaResult.usedFallback;
    dailyChartCache = {
      dateKey: todayKey,
      global: ranked.global,
      sriLanka: ranked.sriLanka,
      expiresAt: Date.now() + (anyFallback ? CHART_FALLBACK_CACHE_TTL_MS : CHART_CACHE_TTL_MS),
    };

    return ranked;
  })();

  try {
    return await inflightDailyChartPromise;
  } finally {
    inflightDailyChartPromise = null;
  }
}

app.get('/api/health', (_req: Request, res: Response) => {
  const configured = Boolean(
    process.env.SPOTIFY_CLIENT_ID?.trim() && process.env.SPOTIFY_CLIENT_SECRET?.trim()
  );
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, configured });
});

app.get('/api/quick-try', async (_req: Request, res: Response) => {
  const charts = await fetchDailyDualCharts();
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');
  res.json({
    global: charts.global,
    sriLanka: charts.sriLanka,
    updatedAt: getUtcDateKey(),
  });
});

export async function resolveTrackIsrc(
  rawId: string,
  rawSource = 'deezer'
): Promise<string | null> {
  const trimmedId = rawId.trim();
  if (!trimmedId) return null;

  const source: 'deezer' | 'spotify' =
    rawSource.toLowerCase() === 'spotify' && !trimmedId.startsWith('dz-')
      ? 'spotify'
      : 'deezer';

  const cacheKey = `${source}:${trimmedId}`;
  const cached = isrcCache.get(cacheKey);
  if (cached) {
    return cached.isrc;
  }

  if (source === 'deezer') {
    const cleanId = trimmedId.replace(/^dz-/i, '');
    if (!/^\d+$/.test(cleanId)) {
      return null;
    }

    try {
      const detailRes = await fetch(`https://api.deezer.com/track/${cleanId}`, {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!detailRes.ok) {
        return null;
      }
      const detail = (await detailRes.json()) as DeezerTrackDetail & { error?: unknown };
      if (!detail || detail.error) {
        return null;
      }
      const rawIsrc = detail.isrc?.trim().toUpperCase();
      const cleanIsrc = rawIsrc && /^[A-Z0-9]{12}$/.test(rawIsrc) ? rawIsrc : rawIsrc || null;
      isrcCache.set(cacheKey, { isrc: cleanIsrc });
      return cleanIsrc;
    } catch {
      return null;
    }
  }

  const cachedTrack = trackCache.get(trimmedId);
  if (cachedTrack) {
    isrcCache.set(cacheKey, { isrc: cachedTrack.isrc });
    return cachedTrack.isrc;
  }

  if (!/^[A-Za-z0-9]{22}$/.test(trimmedId)) {
    return null;
  }

  try {
    const rawTrack = await spotifyGet<SpotifyRawTrack>(
      `https://api.spotify.com/v1/tracks/${trimmedId}`
    );
    const track = normalizeTrack(rawTrack);
    trackCache.set(trimmedId, track);
    isrcCache.set(cacheKey, { isrc: track.isrc });
    return track.isrc;
  } catch {
    return null;
  }
}

app.get('/api/isrc', async (req: Request, res: Response) => {
  const id = typeof req.query.id === 'string' ? req.query.id.trim() : '';
  const source = typeof req.query.source === 'string' ? req.query.source.trim() : 'deezer';

  if (!id) {
    res.status(400).json({ error: 'Track id is required.', isrc: null });
    return;
  }

  const isrc = await resolveTrackIsrc(id, source);
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
  res.json({ isrc });
});

async function executeSearchQuery(
  query: string,
  normalizedQuery: string,
  directTrackId: string | null,
  cacheControlHeader: string
): Promise<SearchExecutionResult> {
  try {
    if (directTrackId) {
      const cachedTrack = trackCache.get(directTrackId);
      if (cachedTrack) {
        const tracks = [cachedTrack];
        searchCache.set(normalizedQuery, tracks);
        return {
          status: 200,
          cacheControl: cacheControlHeader,
          body: {
            tracks,
            query: normalizedQuery,
            source: 'spotify',
            spotifyHealthy: Date.now() >= spotifyRateLimitedUntil,
            deezerHealthy: true,
          },
        };
      }

      const rawTrack = await spotifyGet<SpotifyRawTrack>(
        `https://api.spotify.com/v1/tracks/${directTrackId}`
      );
      const track = normalizeTrack(rawTrack);
      trackCache.set(directTrackId, track);
      const tracks = [track];
      searchCache.set(normalizedQuery, tracks);
      return {
        status: 200,
        cacheControl: cacheControlHeader,
        body: {
          tracks,
          query: normalizedQuery,
          source: 'spotify',
          spotifyHealthy: true,
          deezerHealthy: true,
        },
      };
    }

    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(normalizedQuery)}&type=track&limit=10`;
    const data = await spotifyGet<{ tracks?: { items?: SpotifyRawTrack[] } }>(searchUrl);

    const items = data.tracks?.items ?? [];
    const tracks = items.filter((item) => item && item.id).map(normalizeTrack);
    searchCache.set(normalizedQuery, tracks);

    return {
      status: 200,
      cacheControl: cacheControlHeader,
      body: {
        tracks,
        query: normalizedQuery,
        source: 'spotify',
        spotifyHealthy: true,
        deezerHealthy: true,
      },
    };
  } catch (error) {
    if (shouldFallbackToDeezer(error)) {
      const cachedDeezer = deezerSearchCache.get(normalizedQuery);
      if (cachedDeezer) {
        return {
          status: 200,
          cacheControl: 'public, s-maxage=300, stale-while-revalidate=3600',
          body: {
            tracks: cachedDeezer,
            query: normalizedQuery,
            source: 'deezer',
            spotifyHealthy: false,
            deezerHealthy: true,
          },
        };
      }

      try {
        const deezerTracks = await searchDeezerTracks(query, 8, false);
        if (deezerTracks.length > 0) {
          deezerSearchCache.set(normalizedQuery, deezerTracks);
        }
        return {
          status: 200,
          cacheControl: 'public, s-maxage=300, stale-while-revalidate=3600',
          body: {
            tracks: deezerTracks,
            query: normalizedQuery,
            source: 'deezer',
            spotifyHealthy: false,
            deezerHealthy: true,
          },
        };
      } catch (deezerError) {
        const dzMsg = deezerError instanceof Error ? deezerError.message : 'Unknown Deezer error';
        console.error('Deezer fallback search error:', dzMsg);
        if (error instanceof SpotifyRateLimitError) {
          return {
            status: 429,
            retryAfter: error.retryAfterSeconds,
            body: {
              error: 'Too many searches right now. Please wait a few seconds and try again.',
              code: 'RATE_LIMITED',
              retryAfter: error.retryAfterSeconds,
              tracks: [],
              source: 'spotify',
              spotifyHealthy: false,
              deezerHealthy: false,
            },
          };
        }
        return {
          status: 502,
          body: {
            error: 'Unable to search right now. Please try again.',
            tracks: [],
            source: 'spotify',
            spotifyHealthy: false,
            deezerHealthy: false,
          },
        };
      }
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Spotify search error:', message);
    return {
      status: 502,
      body: {
        error: 'Unable to search Spotify right now. Please try again.',
        tracks: [],
        source: 'spotify',
        spotifyHealthy: false,
        deezerHealthy: true,
      },
    };
  }
}

app.get('/api/search', async (req: Request, res: Response) => {
  const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const query = rawQuery.slice(0, 120).trim();
  if (!query) {
    res.status(400).json({ error: 'Search query is required.' });
    return;
  }

  const directTrackId = extractTrackIdFromText(query);
  const normalizedQuery = query.toLowerCase();
  const cacheControlHeader = directTrackId
    ? 'public, s-maxage=86400, stale-while-revalidate=604800'
    : 'public, s-maxage=3600, stale-while-revalidate=86400';

  const cached = searchCache.get(normalizedQuery);
  if (cached) {
    res.setHeader('Cache-Control', cacheControlHeader);
    res.json({
      tracks: cached,
      query: normalizedQuery,
      source: 'spotify',
      spotifyHealthy: Date.now() >= spotifyRateLimitedUntil,
      deezerHealthy: true,
    });
    return;
  }

  let inflight = inflightSearchPromises.get(normalizedQuery);
  if (!inflight) {
    inflight = executeSearchQuery(query, normalizedQuery, directTrackId, cacheControlHeader).finally(
      () => {
        inflightSearchPromises.delete(normalizedQuery);
      }
    );
    inflightSearchPromises.set(normalizedQuery, inflight);
  }

  const outcome = await inflight;
  if (outcome.cacheControl) {
    res.setHeader('Cache-Control', outcome.cacheControl);
  }
  if (outcome.retryAfter !== undefined) {
    res.setHeader('Retry-After', String(outcome.retryAfter));
  }
  res.status(outcome.status).json(outcome.body);
});

app.get('/api/track', async (req: Request, res: Response) => {
  const rawInput = typeof req.query.input === 'string' ? req.query.input.trim() : '';
  const input = rawInput.slice(0, 500).trim();
  if (!input) {
    res.status(400).json({ error: 'Spotify track link or URI is required.' });
    return;
  }

  let resolvedTrackId: string | null = null;

  try {
    const resolved = await resolveSpotifyTrackId(input);
    if (resolved.status === 'non_track') {
      res.status(400).json({
        error: `That's a Spotify ${resolved.kind} link. Open a specific song on Spotify and paste its track link instead.`,
        code: 'NON_TRACK_SPOTIFY_LINK',
      });
      return;
    }
    if (resolved.status !== 'track') {
      res.status(400).json({
        error: 'Could not find a Spotify track ID in that link. Try a song link or search by title.',
        code: 'INVALID_SPOTIFY_LINK',
      });
      return;
    }

    const { trackId } = resolved;
    resolvedTrackId = trackId;

    const cachedTrack = trackCache.get(trackId);
    if (cachedTrack) {
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      res.json({
        track: cachedTrack,
        source: 'spotify',
        spotifyHealthy: Date.now() >= spotifyRateLimitedUntil,
        deezerHealthy: true,
      });
      return;
    }

    const rawTrack = await spotifyGet<SpotifyRawTrack>(`https://api.spotify.com/v1/tracks/${trackId}`);
    const track = normalizeTrack(rawTrack);
    trackCache.set(trackId, track);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.json({
      track,
      source: 'spotify',
      spotifyHealthy: true,
      deezerHealthy: true,
    });
  } catch (error) {
    if (shouldFallbackToDeezer(error)) {
      try {
        const fallbackInput = resolvedTrackId
          ? `https://open.spotify.com/track/${resolvedTrackId}`
          : input;
        const deezerTracks = await searchDeezerTracks(fallbackInput, 1, true);
        if (deezerTracks.length > 0) {
          res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
          res.json({
            track: deezerTracks[0],
            source: 'deezer',
            spotifyHealthy: false,
            deezerHealthy: true,
          });
          return;
        }
      } catch (deezerError) {
        const dzMsg = deezerError instanceof Error ? deezerError.message : 'Unknown Deezer error';
        console.error('Deezer fallback track error:', dzMsg);
        if (error instanceof SpotifyRateLimitError) {
          res.setHeader('Retry-After', String(error.retryAfterSeconds));
          res.status(429).json({
            error: 'Too many searches right now. Please wait a few seconds and try again.',
            code: 'RATE_LIMITED',
            retryAfter: error.retryAfterSeconds,
            spotifyHealthy: false,
            deezerHealthy: false,
          });
          return;
        }
      }

      if (error instanceof SpotifyRateLimitError) {
        res.setHeader('Retry-After', String(error.retryAfterSeconds));
        res.status(429).json({
          error: 'Too many searches right now. Please wait a few seconds and try again.',
          code: 'RATE_LIMITED',
          retryAfter: error.retryAfterSeconds,
          spotifyHealthy: false,
          deezerHealthy: true,
        });
        return;
      }
    }

    const errWithStatus = error as Error & { status?: number };
    const message = errWithStatus.message || 'Unknown error';
    if (errWithStatus.status === 404) {
      res.status(404).json({ error: 'Track not found on Spotify.' });
      return;
    }
    console.error('Spotify track lookup error:', message);
    res.status(502).json({
      error: 'Could not load that Spotify track. Check the link and try again.',
      spotifyHealthy: false,
      deezerHealthy: true,
    });
  }
});

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

export default app;
