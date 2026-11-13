type TactileClickVariant = 'tap' | 'search';

let sharedAudioContext: AudioContext | null = null;
let lastPlayTimestamp = 0;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (sharedAudioContext && sharedAudioContext.state !== 'closed') {
    return sharedAudioContext;
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtx) {
    return null;
  }

  try {
    sharedAudioContext = new AudioCtx();
    return sharedAudioContext;
  } catch {
    return null;
  }
}

export function playTactileClick(variant: TactileClickVariant = 'tap'): void {
  const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (nowMs - lastPlayTimestamp < 55) {
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) {
    return;
  }

  lastPlayTimestamp = nowMs;

  const scheduleClick = () => {
    try {
      const startTime = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      const isSearch = variant === 'search';
      const startFreq = isSearch ? 3200 : 2400;
      const endFreq = isSearch ? 1650 : 1200;
      const peakGain = isSearch ? 0.036 : 0.028;
      const duration = isSearch ? 0.02 : 0.016;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(startFreq, startTime);
      oscillator.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.0015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();
      };

      oscillator.start(startTime);
      oscillator.stop(startTime + duration + 0.003);
    } catch {
      // Ignore Web Audio errors if blocked by browser autoplay policy
    }
  };

  if (ctx.state === 'suspended') {
    void ctx
      .resume()
      .then(() => {
        scheduleClick();
      })
      .catch(() => {
        // Ignore resume failure when outside user gesture
      });
    return;
  }

  scheduleClick();
}
