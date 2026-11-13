const colorCache = new Map<string, string>();
const DEFAULT_GLOW_RGB = '110, 110, 128';

export async function extractDominantColorRgb(imageUrl: string | null): Promise<string> {
  if (!imageUrl) return DEFAULT_GLOW_RGB;

  const cached = colorCache.get(imageUrl);
  if (cached) return cached;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timer = window.setTimeout(() => {
      resolve(DEFAULT_GLOW_RGB);
    }, 1500);

    img.onload = () => {
      window.clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        const size = 24;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(DEFAULT_GLOW_RGB);
          return;
        }

        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let rTotal = 0;
        let gTotal = 0;
        let bTotal = 0;
        let weightTotal = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 128) continue;

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

          // Favor vibrant mid-tone pixels over near-black or near-white background pixels
          if (luminance < 0.08 || luminance > 0.94) continue;
          const weight = 0.5 + saturation * 2.5;

          rTotal += r * weight;
          gTotal += g * weight;
          bTotal += b * weight;
          weightTotal += weight;
        }

        if (weightTotal === 0) {
          colorCache.set(imageUrl, DEFAULT_GLOW_RGB);
          resolve(DEFAULT_GLOW_RGB);
          return;
        }

        const rAvg = Math.min(255, Math.max(40, Math.round(rTotal / weightTotal)));
        const gAvg = Math.min(255, Math.max(40, Math.round(gTotal / weightTotal)));
        const bAvg = Math.min(255, Math.max(40, Math.round(bTotal / weightTotal)));

        const rgb = `${rAvg}, ${gAvg}, ${bAvg}`;
        colorCache.set(imageUrl, rgb);
        resolve(rgb);
      } catch {
        resolve(DEFAULT_GLOW_RGB);
      }
    };

    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(DEFAULT_GLOW_RGB);
    };

    img.src = imageUrl;
  });
}
