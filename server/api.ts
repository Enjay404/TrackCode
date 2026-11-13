import express, { type Request, type Response } from 'express';
import type { AlbumType, TrackItem } from '../src/types/track.js';

const UPSTREAM_TIMEOUT_MS = 8000;
const POPULAR_HITS_TTL_MS = 30 * 60 * 1000;

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
  };
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

const searchCache = new BoundedTtlCache<TrackItem[]>(200, 5 * 60 * 1000);
const trackCache = new BoundedTtlCache<TrackItem>(300, 30 * 60 * 1000);
let quickTryCache: { tracks: TrackItem[]; expiresAt: number } | null = null;
let inflightQuickTryPromise: Promise<TrackItem[]> | null = null;

const QUICK_TRY_QUERIES = [
  'track:"Blinding Lights" artist:"The Weeknd"',
  'track:"Timeless" artist:"The Weeknd"',
  'track:"Espresso" artist:"Sabrina Carpenter"',
  'track:"BIRDS OF A FEATHER" artist:"Billie Eilish"',
];

app.get('/api/health', (_req: Request, res: Response) => {
  const configured = Boolean(
    process.env.SPOTIFY_CLIENT_ID?.trim() && process.env.SPOTIFY_CLIENT_SECRET?.trim()
  );
  res.setHeader('Cache-Control', 'no-store');
  res.json({ ok: true, configured });
});

async function handlePopularHits(_req: Request, res: Response) {
  const now = Date.now();
  if (quickTryCache && quickTryCache.expiresAt > now) {
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
    res.json({ tracks: quickTryCache.tracks });
    return;
  }

  try {
    if (!inflightQuickTryPromise) {
      inflightQuickTryPromise = Promise.all(
        QUICK_TRY_QUERIES.map(async (q) => {
          const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`;
          const data = await spotifyGet<{ tracks?: { items?: SpotifyRawTrack[] } }>(url);
          const first = data.tracks?.items?.[0];
          return first && first.id ? normalizeTrack(first) : null;
        })
      )
        .then((results) => {
          const tracks = results.filter((t): t is TrackItem => t !== null);
          if (tracks.length > 0) {
            quickTryCache = {
              tracks,
              expiresAt: Date.now() + POPULAR_HITS_TTL_MS,
            };
          }
          return tracks;
        })
        .finally(() => {
          inflightQuickTryPromise = null;
        });
    }

    const tracks = await inflightQuickTryPromise;
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
    res.json({ tracks });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Popular Hits fetch error:', message);
    res.json({ tracks: quickTryCache?.tracks ?? [] });
  }
}

app.get('/api/quick-try', handlePopularHits);
app.get('/api/popular', handlePopularHits);

app.get('/api/search', async (req: Request, res: Response) => {
  const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const query = rawQuery.slice(0, 120).trim();
  if (!query) {
    res.status(400).json({ error: 'Search query is required.' });
    return;
  }

  const cacheKey = query.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached) {
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ tracks: cached, query });
    return;
  }

  try {
    const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`;
    const data = await spotifyGet<{ tracks?: { items?: SpotifyRawTrack[] } }>(searchUrl);

    const items = data.tracks?.items ?? [];
    const tracks = items.filter((item) => item && item.id).map(normalizeTrack);
    searchCache.set(cacheKey, tracks);

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ tracks, query });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'SPOTIFY_CREDENTIALS_MISSING') {
      res.status(503).json({
        error: 'Spotify API credentials are not configured on the server.',
        code: 'CREDENTIALS_MISSING',
      });
      return;
    }
    console.error('Spotify search error:', message);
    res.status(502).json({ error: 'Unable to search Spotify right now. Please try again.' });
  }
});

app.get('/api/track', async (req: Request, res: Response) => {
  const rawInput = typeof req.query.input === 'string' ? req.query.input.trim() : '';
  const input = rawInput.slice(0, 500).trim();
  if (!input) {
    res.status(400).json({ error: 'Spotify track link or URI is required.' });
    return;
  }

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

    const cachedTrack = trackCache.get(trackId);
    if (cachedTrack) {
      res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
      res.json({ track: cachedTrack });
      return;
    }

    const rawTrack = await spotifyGet<SpotifyRawTrack>(`https://api.spotify.com/v1/tracks/${trackId}`);
    const track = normalizeTrack(rawTrack);
    trackCache.set(trackId, track);
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=1800');
    res.json({ track });
  } catch (error) {
    const errWithStatus = error as Error & { status?: number };
    const message = errWithStatus.message || 'Unknown error';
    if (message === 'SPOTIFY_CREDENTIALS_MISSING') {
      res.status(503).json({
        error: 'Spotify API credentials are not configured on the server.',
        code: 'CREDENTIALS_MISSING',
      });
      return;
    }
    if (errWithStatus.status === 404) {
      res.status(404).json({ error: 'Track not found on Spotify.' });
      return;
    }
    console.error('Spotify track lookup error:', message);
    res.status(502).json({ error: 'Could not load that Spotify track. Check the link and try again.' });
  }
});

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

export default app;
