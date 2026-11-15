export type AlbumType = 'album' | 'single' | 'compilation';

export type ApiHealthStatus = 'online' | 'limited' | 'down';

export interface ApiStatusState {
  spotify: ApiHealthStatus;
  deezer: ApiHealthStatus;
}

export interface TrackItem {
  id: string;
  name: string;
  artists: string;
  primaryArtist: string;
  albumName: string;
  albumType: AlbumType;
  releaseYear: string;
  explicit: boolean;
  albumArt: {
    medium: string | null;
    large: string | null;
  };
  isrc: string | null;
  spotifyUrl: string;
  preview?: string | null;
  previewUrl?: string | null;
  source?: 'spotify' | 'deezer';
  rank?: number;
  rankChange?: number | 'NEW';
}

export type Track = TrackItem;

export interface SearchApiResponse {
  tracks: TrackItem[];
  query?: string;
  source?: 'spotify' | 'deezer';
  spotifyHealthy?: boolean;
  deezerHealthy?: boolean;
}

export interface TrackApiResponse {
  track: TrackItem;
  source?: 'spotify' | 'deezer';
  spotifyHealthy?: boolean;
  deezerHealthy?: boolean;
}

export type ChartRegion = 'global' | 'sriLanka';

export interface ChartSnapshot {
  global: TrackItem[];
  sriLanka: TrackItem[];
  updatedAt?: string;
}

export type QuickTryApiResponse = ChartSnapshot;

export interface PreviewCacheEntry {
  previewUrl: string | null;
  expiresAt: number;
}

export interface CachedSearchResult {
  tracks: TrackItem[];
  source?: 'spotify' | 'deezer';
  spotifyHealthy?: boolean;
  deezerHealthy?: boolean;
  cachedAt: number;
}
