import { memo, useEffect, useRef } from 'react';

interface AcousticWaveformProps {
  isPlaying: boolean;
  isLoading?: boolean;
  hasProgress?: boolean;
  getGainMultiplier?: () => number;
  className?: string;
}

const WAVEFORM_BARS = [
  { height: 5, delay: '0ms', duration: '0.88s' },
  { height: 9, delay: '120ms', duration: '0.76s' },
  { height: 13, delay: '240ms', duration: '0.94s' },
  { height: 8, delay: '60ms', duration: '0.82s' },
  { height: 15, delay: '190ms', duration: '0.72s' },
  { height: 11, delay: '310ms', duration: '0.90s' },
  { height: 16, delay: '100ms', duration: '0.80s' },
  { height: 9, delay: '270ms', duration: '0.96s' },
  { height: 14, delay: '40ms', duration: '0.84s' },
  { height: 16, delay: '210ms', duration: '0.74s' },
  { height: 10, delay: '340ms', duration: '0.92s' },
  { height: 15, delay: '140ms', duration: '0.78s' },
  { height: 8, delay: '260ms', duration: '0.89s' },
  { height: 12, delay: '80ms', duration: '0.83s' },
  { height: 9, delay: '200ms', duration: '0.95s' },
  { height: 6, delay: '50ms', duration: '0.86s' },
] as const;

export const AcousticWaveform = memo(function AcousticWaveform({
  isPlaying,
  isLoading = false,
  hasProgress = false,
  getGainMultiplier,
  className = '',
}: AcousticWaveformProps) {
  const waveRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const el = waveRef.current;
    if (!el) return;

    if (!isPlaying || !getGainMultiplier) {
      el.style.setProperty('--isrc-wave-gain', '1');
      return;
    }

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      el.style.setProperty('--isrc-wave-gain', '1');
      return;
    }

    let rafId = 0;
    let smoothedGain = 1;

    const tick = () => {
      const targetGain = getGainMultiplier();
      smoothedGain += (targetGain - smoothedGain) * 0.28;
      el.style.setProperty('--isrc-wave-gain', smoothedGain.toFixed(3));
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      el.style.setProperty('--isrc-wave-gain', '1');
    };
  }, [isPlaying, getGainMultiplier]);

  return (
    <span
      ref={waveRef}
      aria-hidden="true"
      style={{
        transform: 'scaleY(var(--isrc-wave-gain, 1))',
        transformOrigin: 'center',
        willChange: 'transform',
      }}
      className={`inline-flex h-4 shrink-0 items-center gap-[1.5px] transition-opacity duration-200 ${
        isPlaying
          ? 'opacity-95'
          : isLoading || hasProgress
            ? 'opacity-55'
            : 'opacity-30'
      } ${className}`}
    >
      {WAVEFORM_BARS.map((bar, index) => (
        <span
          key={index}
          className={`w-[2px] rounded-full bg-white transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isPlaying ? 'animate-isrc-wave' : ''
          }`}
          style={{
            height: `${bar.height}px`,
            transformOrigin: 'center',
            ...(isPlaying
              ? {
                  animationDelay: bar.delay,
                  animationDuration: bar.duration,
                }
              : {
                  transform: 'scaleY(0.35)',
                }),
          }}
        />
      ))}
    </span>
  );
});

export default AcousticWaveform;
