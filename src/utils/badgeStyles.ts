import type { CSSProperties } from 'react';
import type { TrackItem } from '../types/track';

export const ALBUM_TYPE_LABEL: Record<TrackItem['albumType'], string> = {
  album: 'ALBUM',
  single: 'SINGLE',
  compilation: 'COMPILATION',
};

export const ALBUM_TYPE_BADGE_STYLE: Record<TrackItem['albumType'], CSSProperties> = {
  single: {
    background: 'rgba(125, 196, 228, 0.09)',
    color: '#7DC4E4',
    border: 'none',
  },
  album: {
    background: 'rgba(180, 167, 214, 0.09)',
    color: '#B4A7D6',
    border: 'none',
  },
  compilation: {
    background: 'rgba(212, 196, 158, 0.09)',
    color: '#D4C49E',
    border: 'none',
  },
};

export const EXPLICIT_BADGE_STYLE: CSSProperties = {
  background: 'rgba(255, 69, 58, 0.12)',
  color: '#FF6961',
  border: 'none',
};
