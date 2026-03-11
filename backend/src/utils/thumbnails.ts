import sharp from 'sharp';

export interface ThumbnailResult {
  buffer: Buffer;
  width: number;
  suffix: string;
}

const THUMBNAIL_SIZES = [
  { width: 100, suffix: '_thumb' },
  { width: 300, suffix: '_300' },
];

/**
 * Generate thumbnail buffers from an image buffer.
 * Returns array of { buffer, width, suffix }.
 */
export async function generateThumbnails(imageBuffer: Buffer): Promise<ThumbnailResult[]> {
  const results: ThumbnailResult[] = [];

  for (const size of THUMBNAIL_SIZES) {
    try {
      const resized = await sharp(imageBuffer)
        .resize(size.width, size.width, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 80 })
        .toBuffer();

      results.push({
        buffer: resized,
        width: size.width,
        suffix: size.suffix,
      });
    } catch (err) {
      console.error(`Failed to generate ${size.width}px thumbnail:`, err);
    }
  }

  return results;
}

/**
 * Given an original cover URL/path and a suffix, derive the thumbnail path.
 * E.g., "covers/abc.jpg" + "_thumb" → "covers/abc_thumb.jpg"
 */
export function deriveThumbnailPath(originalPath: string, suffix: string): string {
  const lastDot = originalPath.lastIndexOf('.');
  if (lastDot === -1) return originalPath + suffix;
  return originalPath.substring(0, lastDot) + suffix + '.jpg';
}

