import { useState, useEffect } from 'react';

/**
 * Extract the dominant color from an image URL using a hidden canvas.
 * Returns an rgba string suitable for CSS gradients.
 */
export function useDominantColor(src: string | null): string | null {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!src) { setColor(null); return; }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;

    const handleLoad = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 64; // downsample for speed
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        let r = 0, g = 0, b = 0, count = 0;
        // Sample every 4th pixel for speed
        for (let i = 0; i < data.length; i += 16) {
          const pr = data[i], pg = data[i + 1], pb = data[i + 2], pa = data[i + 3];
          if (pa < 128) continue; // skip transparent
          // Skip near-white and near-black pixels for more interesting colors
          if (pr + pg + pb > 700 || pr + pg + pb < 60) continue;
          r += pr; g += pg; b += pb; count++;
        }

        if (count === 0) {
          // Fallback: sample all pixels
          for (let i = 0; i < data.length; i += 4) {
            r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
          }
        }

        if (count > 0) {
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          setColor(`${r}, ${g}, ${b}`);
        }
      } catch {
        // Canvas tainted by CORS — ignore silently
        setColor(null);
      }
    };

    img.addEventListener('load', handleLoad);
    return () => img.removeEventListener('load', handleLoad);
  }, [src]);

  return color;
}

