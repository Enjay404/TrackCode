import express, { type Request, type Response } from 'express';
import { readFile, writeFile } from 'node:fs/promises';
import type { AlbumType, TrackItem } from '../src/types/track.js';

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
const MAX_CHART_HISTORY_DAYS = 14;

const BASELINE_CHART_RANKS: Record<string, number> = {
  USQX92600464: 2,
  QZJ842603468: 1,
  USSM12504190: 3,
  USUG12607376: 6,
  USSM12600141: 4,
  GBARL2400510: 6,
  USJ5G1714205: 2,
  USAT21700928: 1,
  USUM72401994: 3,
  GBK3W2202321: 5,
  USRC11300059: 4,
};

interface ChartHistoryFile {
  days: Record<string, Record<string, number>>;
}

interface DailyChartCacheEntry {
  dateKey: string;
  tracks: TrackItem[];
  expiresAt: number;
}

let dailyChartCache: DailyChartCacheEntry | null = null;
let inflightDailyChartPromise: Promise<TrackItem[]> | null = null;

const POPULAR_HITS_FALLBACK_TRACKS: TrackItem[] = [
  {
    id: '36DPRfPRHwkNKmFSXESAKG',
    name: 'Scott Street',
    artists: 'Phoebe Bridgers',
    primaryArtist: 'Phoebe Bridgers',
    albumName: 'Stranger in the Alps (Deluxe Edition)',
    albumType: 'album',
    releaseYear: '2018',
    explicit: true,
    albumArt: {
      medium: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e022a5edd6218037175ddf7c2c8',
      large: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b2732a5edd6218037175ddf7c2c8',
    },
    isrc: 'USJ5G1714205',
    spotifyUrl: 'https://open.spotify.com/track/36DPRfPRHwkNKmFSXESAKG',
    rank: 1,
    rankChange: 1,
  },
  {
    id: '5cF0dROlMOK5uNZtivgu50',
    name: 'Attention',
    artists: 'Charlie Puth',
    primaryArtist: 'Charlie Puth',
    albumName: 'Voicenotes',
    albumType: 'album',
    releaseYear: '2018',
    explicit: false,
    albumArt: {
      medium: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02897f73256b9128a9d70eaf66',
      large: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b273897f73256b9128a9d70eaf66',
    },
    isrc: 'USAT21700928',
    spotifyUrl: 'https://open.spotify.com/track/5cF0dROlMOK5uNZtivgu50',
    rank: 2,
    rankChange: -1,
  },
  {
    id: '6dOtVTDdiauQNBQEDOtlAB',
    name: 'BIRDS OF A FEATHER',
    artists: 'Billie Eilish',
    primaryArtist: 'Billie Eilish',
    albumName: 'HIT ME HARD AND SOFT',
    albumType: 'album',
    releaseYear: '2024',
    explicit: false,
    albumArt: {
      medium: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0271d62ea7ea8a5be92d3c1f62',
      large: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b27371d62ea7ea8a5be92d3c1f62',
    },
    isrc: 'USUM72401994',
    spotifyUrl: 'https://open.spotify.com/track/6dOtVTDdiauQNBQEDOtlAB',
    rank: 3,
    rankChange: 0,
  },
  {
    id: '1fDFHXcykq4iw8Gg7s5hG9',
    name: 'About You',
    artists: 'The 1975',
    primaryArtist: 'The 1975',
    albumName: 'Being Funny In A Foreign Language',
    albumType: 'album',
    releaseYear: '2022',
    explicit: false,
    albumArt: {
      medium: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e021f44db452a68e229650a302c',
      large: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b2731f44db452a68e229650a302c',
    },
    isrc: 'GBK3W2202321',
    spotifyUrl: 'https://open.spotify.com/track/1fDFHXcykq4iw8Gg7s5hG9',
    rank: 4,
    rankChange: 1,
  },
  {
    id: '4rHZZAmHpZrA3iH5zx8frV',
    name: 'Mirrors',
    artists: 'Justin Timberlake',
    primaryArtist: 'Justin Timberlake',
    albumName: 'The 20/20 Experience (Deluxe Version)',
    albumType: 'album',
    releaseYear: '2013',
    explicit: false,
    albumArt: {
      medium: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0256d5fb0cc9cec001d8ae0c8c',
      large: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b27356d5fb0cc9cec001d8ae0c8c',
    },
    isrc: 'USRC11300059',
    spotifyUrl: 'https://open.spotify.com/track/4rHZZAmHpZrA3iH5zx8frV',
    rank: 5,
    rankChange: 'NEW',
  },
];

function getUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function getChartTrackKey(track: TrackItem): string {
  return track.isrc?.trim().toUpperCase() || track.id;
}

async function readChartHistory(): Promise<ChartHistoryFile> {
  try {
    const raw = await readFile(CHART_HISTORY_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<ChartHistoryFile>;
    if (parsed && typeof parsed.days === 'object' && parsed.days !== null) {
      return { days: parsed.days };
    }
  } catch {
    // Missing or unreadable snapshot file on cold start
  }
  return { days: {} };
}

async function writeChartHistory(history: ChartHistoryFile): Promise<void> {
  try {
    const sortedDates = Object.keys(history.days).sort();
    const trimmedDays: Record<string, Record<string, number>> = {};
    for (const dateKey of sortedDates.slice(-MAX_CHART_HISTORY_DAYS)) {
      trimmedDays[dateKey] = history.days[dateKey];
    }
    await writeFile(CHART_HISTORY_PATH, JSON.stringify({ days: trimmedDays }), 'utf8');
  } catch {
    // Ignore read-only filesystem errors
  }
}

async function applyChartRankHistory(rawTracks: TrackItem[], dateKey: string): Promise<TrackItem[]> {
  const history = await readChartHistory();
  const previousDates = Object.keys(history.days)
    .filter((d) => d < dateKey)
    .sort();
  const previousDayKey = previousDates[previousDates.length - 1];
  const previousRanks = previousDayKey ? history.days[previousDayKey] : BASELINE_CHART_RANKS;

  const todayRanks: Record<string, number> = {};
  const rankedTracks = rawTracks.map((track, index) => {
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

  if (!history.days[dateKey]) {
    history.days[dateKey] = todayRanks;
    await writeChartHistory(history);
  }

  return rankedTracks;
}

async function fetchDailyTopChartTracks(): Promise<TrackItem[]> {
  const todayKey = getUtcDateKey();
  if (dailyChartCache && dailyChartCache.dateKey === todayKey && dailyChartCache.expiresAt > Date.now()) {
    return dailyChartCache.tracks;
  }

  if (inflightDailyChartPromise) {
    return inflightDailyChartPromise;
  }

  inflightDailyChartPromise = (async () => {
    try {
      const chartRes = await fetch('https://api.deezer.com/chart/0/tracks?limit=8', {
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!chartRes.ok) {
        throw new Error(`DEEZER_CHART_ERROR:${chartRes.status}`);
      }

      const chartPayload = (await chartRes.json()) as { data?: DeezerSearchTrack[] };
      const chartEntries = Array.isArray(chartPayload.data) ? chartPayload.data.slice(0, 8) : [];
      if (chartEntries.length === 0) {
        throw new Error('DEEZER_CHART_EMPTY');
      }

      const detailResults = await Promise.all(
        chartEntries.map(async (item): Promise<TrackItem | null> => {
          try {
            const detailRes = await fetch(`https://api.deezer.com/track/${item.id}`, {
              signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
            });
            if (!detailRes.ok) return null;
            const detail = (await detailRes.json()) as DeezerTrackDetail & { error?: unknown };
            if (!detail || detail.error || !detail.id) return null;
            return normalizeDeezerTrack(detail);
          } catch {
            return null;
          }
        })
      );

      const tracks = detailResults.filter((t): t is TrackItem => Boolean(t));
      if (tracks.length === 0) {
        throw new Error('DEEZER_CHART_NO_DETAILS');
      }

      const rankedTracks = await applyChartRankHistory(tracks, todayKey);
      dailyChartCache = {
        dateKey: todayKey,
        tracks: rankedTracks,
        expiresAt: Date.now() + CHART_CACHE_TTL_MS,
      };
      return rankedTracks;
    } catch {
      return POPULAR_HITS_FALLBACK_TRACKS;
    }
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
  const tracks = await fetchDailyTopChartTracks();
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=172800');
  res.json({ tracks, updatedAt: getUtcDateKey() });
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
