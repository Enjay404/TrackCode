export type AlbumType = 'album' | 'single' | 'compilation';

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
}

export interface SearchApiResponse {
  tracks: TrackItem[];
  query: string;
}

export interface TrackApiResponse {
  track: TrackItem;
}
