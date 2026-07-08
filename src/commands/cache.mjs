/**
 * cache — manage search cache (stats, clear)
 */

import { join } from 'path';
import { existsSync, statSync, unlinkSync } from 'fs';

export async function cache(vaultRoot, { subcommand } = {}) {
  if (subcommand === 'stats') {
    return cacheStats(vaultRoot);
  } else if (subcommand === 'clear') {
    return cacheClear(vaultRoot);
  } else {
    throw new Error(`Unknown cache subcommand: ${subcommand}. Use 'stats' or 'clear'.`);
  }
}

function cacheStats(vaultRoot) {
  const cacheDir = join(vaultRoot, '.clausidian');
  const cachePath = join(cacheDir, 'cache.json');
  const exists = existsSync(cachePath);

  const stats = {
    diskCacheExists: exists,
  };

  if (exists) {
    try {
      const stat = statSync(cachePath);
      const ageMs = Date.now() - stat.mtimeMs;
      const ageMins = Math.floor(ageMs / (60 * 1000));
      stats.diskCacheAgeMins = ageMins;
      stats.diskCacheSizeBytes = stat.size;
    } catch (err) {
      // Silent fail
    }
  }

  return {
    status: 'stats',
    cache: stats,
  };
}

function cacheClear(vaultRoot) {
  const cacheDir = join(vaultRoot, '.clausidian');
  const cachePath = join(cacheDir, 'cache.json');

  if (existsSync(cachePath)) {
    try {
      unlinkSync(cachePath);
      return {
        status: 'cleared',
        message: 'Disk cache cleared',
      };
    } catch (err) {
      throw new Error(`Failed to clear cache: ${err.message}`);
    }
  }

  return {
    status: 'already_cleared',
    message: 'No disk cache found',
  };
}
