import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackItem } from '../types/track';
import {
  getCachedTrackIsrc,
  getCachedTrackPreview,
  getTrackPreviewCacheKey,
  setCachedTrackIsrc,
  setCachedTrackPreview,
} from '../utils/spotifyInput';

export interface UseAudioPreviewOptions {
  onIsrcResolved?: (trackId: string, isrc: string) => void;
  onPreviewResolved?: (trackId: string, previewKey: string, previewUrl: string | null) => void;
}

export interface UseAudioPreviewReturn {
  playingTrackId: string | null;
  loadedTrackId: string | null;
  isAudioLoading: boolean;
  audioProgress: number;
  togglePreview: (track: TrackItem) => void;
  stopAudioPreview: () => void;
  getAudioGainMultiplier: () => number;
}

export function useAudioPreview(options?: UseAudioPreviewOptions): UseAudioPreviewReturn {
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [loadedTrackId, setLoadedTrackId] = useState<string | null>(null);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);

  const onIsrcResolvedRef = useRef(options?.onIsrcResolved);
  onIsrcResolvedRef.current = options?.onIsrcResolved;
  const onPreviewResolvedRef = useRef(options?.onPreviewResolved);
  onPreviewResolvedRef.current = options?.onPreviewResolved;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const analyserDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const hasAudioSignalRef = useRef(false);

  const previewFetchAbortRef = useRef<AbortController | null>(null);
  const playRequestIdRef = useRef(0);
  const loadedAudioSrcRef = useRef<string | null>(null);
  const loadedAudioTrackIdRef = useRef<string | null>(null);
  const playingTrackIdRef = useRef<string | null>(null);
  playingTrackIdRef.current = playingTrackId;
  const isAudioLoadingRef = useRef(false);
  isAudioLoadingRef.current = isAudioLoading;

  const getOrCreateAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'none';
    audio.addEventListener('timeupdate', () => {
      const duration =
        Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 30;
      setAudioProgress(Math.min(1, Math.max(0, audio.currentTime / duration)));
    });
    audio.addEventListener('playing', () => {
      isAudioLoadingRef.current = false;
      setIsAudioLoading(false);
    });
    audio.addEventListener('pause', () => {
      if (isAudioLoadingRef.current || audio.ended || !audio.paused) return;
      setPlayingTrackId(null);
    });
    audio.addEventListener('ended', () => {
      isAudioLoadingRef.current = false;
      setPlayingTrackId(null);
      setIsAudioLoading(false);
      setAudioProgress(0);
    });
    audio.addEventListener('error', () => {
      if (!audio.getAttribute('src')) return;
      isAudioLoadingRef.current = false;
      setPlayingTrackId(null);
      setIsAudioLoading(false);
      setAudioProgress(0);
    });
    audioRef.current = audio;
    return audio;
  }, []);

  const ensureAudioAnalyser = useCallback(() => {
    if (typeof window === 'undefined') return;
    const audio = audioRef.current ?? getOrCreateAudio();
    if (mediaSourceRef.current && analyserRef.current) {
      if (audioContextRef.current?.state === 'suspended') {
        void audioContextRef.current.resume().catch(() => {});
      }
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = audioContextRef.current ?? new AudioCtx();
      audioContextRef.current = ctx;

      if (!analyserRef.current) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.78;
        analyserRef.current = analyser;
        analyserDataRef.current = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      }

      if (!mediaSourceRef.current) {
        const source = ctx.createMediaElementSource(audio);
        source.connect(analyserRef.current);
        analyserRef.current.connect(ctx.destination);
        mediaSourceRef.current = source;
      }

      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }
    } catch {
      // Fall back cleanly to native <audio> playback and default gain multiplier (1)
    }
  }, [getOrCreateAudio]);

  const getAudioGainMultiplier = useCallback((): number => {
    const analyser = analyserRef.current;
    const data = analyserDataRef.current;
    const ctx = audioContextRef.current;
    if (!analyser || !data || !ctx || ctx.state !== 'running') {
      return 1;
    }

    analyser.getByteTimeDomainData(data);
    let sumSq = 0;
    for (let i = 0; i < data.length; i += 1) {
      const normalized = (data[i] - 128) / 128;
      sumSq += normalized * normalized;
    }
    const rms = Math.sqrt(sumSq / data.length);
    if (rms > 0.001) {
      hasAudioSignalRef.current = true;
    }
    if (!hasAudioSignalRef.current) {
      return 1;
    }

    // Simple gain-based multiplier [0.45 .. 1.28] derived from live RMS amplitude
    return 0.45 + Math.min(1, rms * 3.2) * 0.83;
  }, []);

  const stopAudioPreview = useCallback(() => {
    playRequestIdRef.current += 1;
    if (previewFetchAbortRef.current) {
      previewFetchAbortRef.current.abort();
      previewFetchAbortRef.current = null;
    }
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      try {
        audio.currentTime = 0;
      } catch {
        // Ignore if no media loaded
      }
      audio.removeAttribute('src');
      audio.load();
    }
    loadedAudioSrcRef.current = null;
    loadedAudioTrackIdRef.current = null;
    hasAudioSignalRef.current = false;
    playingTrackIdRef.current = null;
    isAudioLoadingRef.current = false;
    setLoadedTrackId(null);
    setPlayingTrackId(null);
    setIsAudioLoading(false);
    setAudioProgress(0);
  }, []);

  const togglePreview = useCallback(
    (targetTrack: TrackItem) => {
      const requestId = ++playRequestIdRef.current;

      if (playingTrackIdRef.current === targetTrack.id) {
        if (previewFetchAbortRef.current) {
          previewFetchAbortRef.current.abort();
          previewFetchAbortRef.current = null;
        }
        audioRef.current?.pause();
        playingTrackIdRef.current = null;
        isAudioLoadingRef.current = false;
        setPlayingTrackId(null);
        setIsAudioLoading(false);
        return;
      }

      if (previewFetchAbortRef.current) {
        previewFetchAbortRef.current.abort();
        previewFetchAbortRef.current = null;
      }

      // Synchronously create/unlock <audio> and AudioContext inside the tap gesture for iOS Safari
      const audio = getOrCreateAudio();
      ensureAudioAnalyser();

      const previewKey = getTrackPreviewCacheKey(targetTrack);
      const cachedIsrc = targetTrack.isrc ?? getCachedTrackIsrc(targetTrack.id);
      const inlinePreviewCandidate =
        typeof targetTrack.previewUrl === 'string' &&
        /^https?:\/\//i.test(targetTrack.previewUrl.trim())
          ? targetTrack.previewUrl.trim()
          : typeof targetTrack.preview === 'string' &&
              /^https?:\/\//i.test(targetTrack.preview.trim())
            ? targetTrack.preview.trim()
            : undefined;
      const cachedPreview = getCachedTrackPreview(previewKey) ?? inlinePreviewCandidate;

      if (typeof cachedPreview === 'string' && cachedPreview) {
        setCachedTrackPreview(previewKey, cachedPreview);
        playingTrackIdRef.current = targetTrack.id;
        isAudioLoadingRef.current = true;
        setPlayingTrackId(targetTrack.id);
        setIsAudioLoading(true);
        audio.pause();

        if (
          loadedAudioTrackIdRef.current !== targetTrack.id ||
          loadedAudioSrcRef.current !== cachedPreview ||
          !audio.getAttribute('src')
        ) {
          audio.src = cachedPreview;
          loadedAudioTrackIdRef.current = targetTrack.id;
          loadedAudioSrcRef.current = cachedPreview;
          hasAudioSignalRef.current = false;
          setLoadedTrackId(targetTrack.id);
          setAudioProgress(0);
        }

        if (audioContextRef.current?.state === 'suspended') {
          void audioContextRef.current.resume().catch(() => {});
        }
        void audio.play().catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
          if (
            requestId === playRequestIdRef.current &&
            playingTrackIdRef.current === targetTrack.id
          ) {
            playingTrackIdRef.current = null;
            isAudioLoadingRef.current = false;
            setPlayingTrackId(null);
            setIsAudioLoading(false);
          }
        });
        return;
      }

      if (cachedPreview === null) {
        stopAudioPreview();
        return;
      }

      // Prime audio element synchronously before awaiting /api/isrc so iOS Safari retains user-gesture activation
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      loadedAudioSrcRef.current = null;
      loadedAudioTrackIdRef.current = null;
      setLoadedTrackId(null);
      setAudioProgress(0);
      playingTrackIdRef.current = targetTrack.id;
      isAudioLoadingRef.current = true;
      setPlayingTrackId(targetTrack.id);
      setIsAudioLoading(true);

      const controller = new AbortController();
      previewFetchAbortRef.current = controller;

      const source =
        targetTrack.source ?? (targetTrack.id.startsWith('dz-') ? 'deezer' : 'spotify');
      const params = new URLSearchParams();
      params.set('id', targetTrack.id);
      params.set('source', source);
      if (typeof cachedIsrc === 'string' && cachedIsrc) {
        params.set('isrc', cachedIsrc);
      }
      const fallbackQuery = `${targetTrack.name} ${targetTrack.primaryArtist}`.trim();
      if (fallbackQuery) {
        params.set('q', fallbackQuery);
      }

      void fetch(`/api/isrc?${params.toString()}`, { signal: controller.signal })
        .then((res) =>
          res.ok
            ? (res.json() as Promise<{ isrc?: string | null; previewUrl?: string | null }>)
            : { isrc: null, previewUrl: null }
        )
        .then((data) => {
          if (
            requestId !== playRequestIdRef.current ||
            controller.signal.aborted ||
            playingTrackIdRef.current !== targetTrack.id
          ) {
            return;
          }

          const resolvedIsrc =
            typeof data.isrc === 'string' && data.isrc.trim()
              ? data.isrc.trim().toUpperCase()
              : null;
          const resolvedPreviewUrl =
            typeof data.previewUrl === 'string' && /^https?:\/\//i.test(data.previewUrl.trim())
              ? data.previewUrl.trim()
              : null;

          setCachedTrackPreview(previewKey, resolvedPreviewUrl);
          if (resolvedIsrc) {
            setCachedTrackPreview(
              getTrackPreviewCacheKey({ id: targetTrack.id, isrc: resolvedIsrc }),
              resolvedPreviewUrl
            );
          }

          if (!targetTrack.isrc && resolvedIsrc) {
            setCachedTrackIsrc(targetTrack.id, resolvedIsrc);
            onIsrcResolvedRef.current?.(targetTrack.id, resolvedIsrc);
          }

          const effectiveKey = getTrackPreviewCacheKey({
            id: targetTrack.id,
            isrc: resolvedIsrc ?? (typeof cachedIsrc === 'string' ? cachedIsrc : targetTrack.isrc),
          });
          onPreviewResolvedRef.current?.(targetTrack.id, effectiveKey, resolvedPreviewUrl);

          if (!resolvedPreviewUrl) {
            isAudioLoadingRef.current = false;
            playingTrackIdRef.current = null;
            setPlayingTrackId(null);
            setIsAudioLoading(false);
            setAudioProgress(0);
            return;
          }

          audio.src = resolvedPreviewUrl;
          loadedAudioTrackIdRef.current = targetTrack.id;
          loadedAudioSrcRef.current = resolvedPreviewUrl;
          hasAudioSignalRef.current = false;
          setLoadedTrackId(targetTrack.id);

          if (audioContextRef.current?.state === 'suspended') {
            void audioContextRef.current.resume().catch(() => {});
          }
          void audio.play().catch((err) => {
            if (err instanceof DOMException && err.name === 'AbortError') {
              return;
            }
            if (
              requestId === playRequestIdRef.current &&
              playingTrackIdRef.current === targetTrack.id
            ) {
              isAudioLoadingRef.current = false;
              playingTrackIdRef.current = null;
              setPlayingTrackId(null);
              setIsAudioLoading(false);
            }
          });
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return;
          }
          if (
            requestId === playRequestIdRef.current &&
            playingTrackIdRef.current === targetTrack.id
          ) {
            isAudioLoadingRef.current = false;
            playingTrackIdRef.current = null;
            setPlayingTrackId(null);
            setIsAudioLoading(false);
          }
        });
    },
    [ensureAudioAnalyser, getOrCreateAudio, stopAudioPreview]
  );

  // Stop playback when the user backgrounds, hides, or exits the page
  useEffect(() => {
    if (!playingTrackId) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAudioPreview();
      }
    };

    const handlePageExit = () => {
      stopAudioPreview();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageExit);
    window.addEventListener('beforeunload', handlePageExit);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageExit);
      window.removeEventListener('beforeunload', handlePageExit);
    };
  }, [playingTrackId, stopAudioPreview]);

  // Release audio and Web Audio resources cleanly on unmount
  useEffect(() => {
    return () => {
      playRequestIdRef.current += 1;
      if (previewFetchAbortRef.current) {
        previewFetchAbortRef.current.abort();
        previewFetchAbortRef.current = null;
      }
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        audioRef.current = null;
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      mediaSourceRef.current = null;
      analyserDataRef.current = null;
      hasAudioSignalRef.current = false;
      loadedAudioSrcRef.current = null;
      loadedAudioTrackIdRef.current = null;
    };
  }, []);

  return {
    playingTrackId,
    loadedTrackId,
    isAudioLoading,
    audioProgress,
    togglePreview,
    stopAudioPreview,
    getAudioGainMultiplier,
  };
}

export default useAudioPreview;
