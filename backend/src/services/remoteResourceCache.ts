import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';

type CacheCategory = 'covers' | 'lyrics';

type CachedBinary = {
  buffer: Buffer;
  contentType: string;
};

type CacheMeta = {
  contentType: string;
  updatedAt: string;
};

const CACHE_ENABLED = process.env.REMOTE_RESOURCE_CACHE_ENABLED !== 'false';
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const cacheRoot = path.join(
  process.cwd(),
  process.env.REMOTE_RESOURCE_CACHE_DIR || path.join(uploadDir, 'cache', 'remote')
);

const hashKey = (key: string): string => createHash('sha1').update(key).digest('hex');

const resolveFilePaths = (category: CacheCategory, cacheKey: string) => {
  const digest = hashKey(cacheKey);
  const shard = digest.slice(0, 2);
  const dir = path.join(cacheRoot, category, shard);
  return {
    dir,
    dataPath: path.join(dir, `${digest}.bin`),
    metaPath: path.join(dir, `${digest}.json`),
  };
};

class RemoteResourceCache {
  private hits = 0;
  private misses = 0;
  private writes = 0;

  isEnabled(): boolean {
    return CACHE_ENABLED;
  }

  async getBinary(category: CacheCategory, key: string): Promise<CachedBinary | null> {
    if (!CACHE_ENABLED) return null;

    const { dataPath, metaPath } = resolveFilePaths(category, key);
    try {
      const [buffer, metaText] = await Promise.all([
        fs.readFile(dataPath),
        fs.readFile(metaPath, 'utf-8'),
      ]);
      const meta = JSON.parse(metaText) as CacheMeta;
      if (!meta?.contentType) return null;
      this.hits += 1;
      return { buffer, contentType: meta.contentType };
    } catch {
      this.misses += 1;
      return null;
    }
  }

  async setBinary(category: CacheCategory, key: string, value: CachedBinary): Promise<void> {
    if (!CACHE_ENABLED) return;

    const { dir, dataPath, metaPath } = resolveFilePaths(category, key);
    try {
      await fs.mkdir(dir, { recursive: true });
      await Promise.all([
        fs.writeFile(dataPath, value.buffer),
        fs.writeFile(metaPath, JSON.stringify({
          contentType: value.contentType,
          updatedAt: new Date().toISOString(),
        })),
      ]);
      this.writes += 1;
    } catch (error) {
      console.warn('[RemoteResourceCache:setBinary] failed:', (error as Error).message);
    }
  }

  async deleteBinary(category: CacheCategory, key: string): Promise<void> {
    if (!CACHE_ENABLED) return;

    const { dataPath, metaPath } = resolveFilePaths(category, key);
    await Promise.allSettled([fs.unlink(dataPath), fs.unlink(metaPath)]);
  }

  async stats() {
    const summarize = async (category: CacheCategory) => {
      const categoryPath = path.join(cacheRoot, category);
      let files = 0;
      let totalBytes = 0;

      const walk = async (dirPath: string): Promise<void> => {
        let entries: Array<{ name: string; isDirectory: () => boolean }> = [];
        try {
          entries = await fs.readdir(dirPath, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          if (entry.isDirectory()) {
            await walk(fullPath);
            continue;
          }
          if (!fullPath.endsWith('.bin')) continue;
          try {
            const fileStat = await fs.stat(fullPath);
            files += 1;
            totalBytes += fileStat.size;
          } catch {
            // ignore single file errors
          }
        }
      };

      await walk(categoryPath);
      return { files, totalBytes };
    };

    const [covers, lyrics] = await Promise.all([summarize('covers'), summarize('lyrics')]);
    const total = this.hits + this.misses;

    return {
      enabled: CACHE_ENABLED,
      rootDir: cacheRoot,
      hits: this.hits,
      misses: this.misses,
      writes: this.writes,
      hitRate: total > 0 ? `${((this.hits / total) * 100).toFixed(1)}%` : 'N/A',
      covers,
      lyrics,
      totalFiles: covers.files + lyrics.files,
      totalBytes: covers.totalBytes + lyrics.totalBytes,
    };
  }
}

export default new RemoteResourceCache();

