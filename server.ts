import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AlbumType, TrackItem } from './src/types/track.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

interface TokenCache {
  accessToken: string;
  expiresAt: number;
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
  });

  if (res.status === 401) {
    token = await fetchSpotifyToken(true);
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
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

  // spotify:track:{id} or spotify://track/{id}
  const uriMatch = trimmed.match(/spotify:(?:\/\/)?track[:/]([A-Za-z0-9]{22})/i);
  if (uriMatch) {
    return uriMatch[1];
  }

  // open.spotify.com/track/{id} or open.spotify.com/intl-xx/track/{id}
  const urlMatch = trimmed.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{22})/i);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Bare 22-char Spotify base62 track ID if explicitly passed
  if (/^[A-Za-z0-9]{22}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function isAllowedSpotifyHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return ALLOWED_REDIRECT_HOSTS.has(normalized) || normalized.endsWith('.spotify.com');
}

async function resolveSpotifyTrackId(rawInput: string): Promise<string | null> {
  const directId = extractTrackIdFromText(rawInput);
  if (directId) {
    return directId;
  }

  const trimmed = rawInput.trim();
  const candidateUrlStr = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^(spotify\.link|spoti\.fi|open\.spotify\.com)\//i.test(trimmed)
      ? `https://${trimmed}`
      : null;

  if (!candidateUrlStr) {
    return null;
  }

  let currentUrl: URL;
  try {
    currentUrl = new URL(candidateUrlStr);
  } catch {
    return null;
  }

  if (!isAllowedSpotifyHost(currentUrl.hostname)) {
    return null;
  }

  // Manually follow up to 6 redirects so only trusted Spotify domains are traversed
  for (let hop = 0; hop < 6; hop++) {
    const idFromUrl = extractTrackIdFromText(currentUrl.toString());
    if (idFromUrl) {
      return idFromUrl;
    }

    const res = await fetch(currentUrl.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) break;

      const nextUrl = new URL(location, currentUrl);
      const idFromNext = extractTrackIdFromText(nextUrl.toString());
      if (idFromNext) {
        return idFromNext;
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
        return idFromHtml;
      }
    }
    break;
  }

  return null;
}

async function createServer() {
  const app = express();
  app.use(express.json());

  let quickTryCache: { tracks: TrackItem[]; expiresAt: number } | null = null;
  const QUICK_TRY_QUERIES = [
    'track:"Blinding Lights" artist:"The Weeknd"',
    'track:"Timeless" artist:"The Weeknd"',
    'track:"Espresso" artist:"Sabrina Carpenter"',
    'track:"BIRDS OF A FEATHER" artist:"Billie Eilish"',
  ];

  app.get('/api/health', (_req, res) => {
    const configured = Boolean(
      process.env.SPOTIFY_CLIENT_ID?.trim() && process.env.SPOTIFY_CLIENT_SECRET?.trim()
    );
    res.json({ ok: true, configured });
  });

  app.get('/api/quick-try', async (_req, res) => {
    const now = Date.now();
    if (quickTryCache && quickTryCache.expiresAt > now) {
      res.json({ tracks: quickTryCache.tracks });
      return;
    }

    try {
      const results = await Promise.all(
        QUICK_TRY_QUERIES.map(async (q) => {
          const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=1`;
          const data = await spotifyGet<{ tracks?: { items?: SpotifyRawTrack[] } }>(url);
          const first = data.tracks?.items?.[0];
          return first && first.id ? normalizeTrack(first) : null;
        })
      );

      const tracks = results.filter((t): t is TrackItem => t !== null);
      if (tracks.length > 0) {
        quickTryCache = {
          tracks,
          expiresAt: now + 12 * 60 * 60 * 1000,
        };
      }
      res.json({ tracks });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Quick Try fetch error:', message);
      res.json({ tracks: quickTryCache?.tracks ?? [] });
    }
  });

  app.get('/api/search', async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query) {
      res.status(400).json({ error: 'Search query is required.' });
      return;
    }

    try {
      const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`;
      const data = await spotifyGet<{ tracks?: { items?: SpotifyRawTrack[] } }>(searchUrl);

      // Preserve Spotify's native search result order; do not re-sort or filter by popularity
      const items = data.tracks?.items ?? [];
      const tracks = items.filter((item) => item && item.id).map(normalizeTrack);

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

  app.get('/api/track', async (req, res) => {
    const input = typeof req.query.input === 'string' ? req.query.input.trim() : '';
    if (!input) {
      res.status(400).json({ error: 'Spotify track link or URI is required.' });
      return;
    }

    try {
      const trackId = await resolveSpotifyTrackId(input);
      if (!trackId) {
        res.status(400).json({
          error: 'Could not find a Spotify track ID in that link. Try a full track link or search by song name.',
          code: 'INVALID_SPOTIFY_LINK',
        });
        return;
      }

      const rawTrack = await spotifyGet<SpotifyRawTrack>(`https://api.spotify.com/v1/tracks/${trackId}`);
      const track = normalizeTrack(rawTrack);
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

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TrackCode server listening on http://0.0.0.0:${PORT}`);
  });
}

createServer().catch((err) => {
  console.error('Failed to start TrackCode server:', err);
  process.exit(1);
});
