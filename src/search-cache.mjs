/**
 * Search result caching with TTL
 * Improves performance for repeated searches
 */

class SearchCache {
  constructor(ttlMs = 10 * 60 * 1000) { // 10 minutes default
    this.cache = new Map();
    this.ttl = ttlMs;
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Generate cache key from search parameters using fast hashing.
   * Uses simple string concatenation for O(1) speed on typical inputs.
   * Supports vault-aware isolation to prevent cross-vault collisions.
   * @param {string} keyword - Search keyword
   * @param {string|Object|null} vaultName - Vault name for isolation, or options object for backward compat
   * @param {Object} options - Search options (used when vaultName is a string)
   * @returns {string} Cache key
   */
  _getCacheKey(keyword, vaultName = null, options = {}) {
    // Handle backward compatibility: if vaultName is an object, treat it as options
    let actualVaultName = vaultName;
    let actualOptions = options;

    if (typeof vaultName === 'object' && vaultName !== null && typeof options === 'object') {
      actualVaultName = null;
      actualOptions = vaultName;
    }

    const { type, tag, status, regex } = actualOptions;
    // Prefix with vault name for isolation (defaults to 'default' for backward compatibility)
    const prefix = actualVaultName || 'default';
    // Simple concatenation is fast and deterministic
    return `${prefix}|${keyword}|${type || ''}|${tag || ''}|${status || ''}|${regex ? 'regex' : ''}`;
  }

  /**
   * Get cached search result if valid
   * @param {string} keyword - Search keyword
   * @param {string|null} vaultName - Vault name for isolation
   * @param {Object} options - Search options
   * @returns {Array|null} Cached results or null if expired/missing
   */
  get(keyword, vaultName = null, options = {}) {
    // Handle backward compatibility: if vaultName is an object, treat it as options
    if (typeof vaultName === 'object' && vaultName !== null) {
      options = vaultName;
      vaultName = null;
    }

    const key = this._getCacheKey(keyword, vaultName, options);
    const entry = this.cache.get(key);

    if (!entry) {
      this.missCount++;
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.missCount++;
      return null;
    }

    this.hitCount++;
    return entry.results;
  }

  /**
   * Cache search results
   * @param {string} keyword - Search keyword
   * @param {string|null} vaultName - Vault name for isolation
   * @param {Object} options - Search options
   * @param {Array} results - Search results
   */
  set(keyword, vaultName = null, options = {}, results) {
    // Handle backward compatibility: if vaultName is an object, treat it as options and results as 3rd arg
    if (typeof vaultName === 'object' && vaultName !== null) {
      results = options;
      options = vaultName;
      vaultName = null;
    }

    const key = this._getCacheKey(keyword, vaultName, options);
    this.cache.set(key, {
      results,
      timestamp: Date.now(),
      vaultName, // Store vault name for stats and debugging
    });
  }

  /**
   * Invalidate all cache entries
   * Used when vault changes
   */
  clear() {
    this.cache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  /**
   * Invalidate specific cache entry
   * @param {string} keyword - Search keyword
   * @param {string|null} vaultName - Vault name for isolation
   * @param {Object} options - Search options
   */
  invalidate(keyword, vaultName = null, options = {}) {
    // Handle backward compatibility
    if (typeof vaultName === 'object' && vaultName !== null) {
      options = vaultName;
      vaultName = null;
    }

    const key = this._getCacheKey(keyword, vaultName, options);
    this.cache.delete(key);
  }

  /**
   * Get cache statistics with optional vault filtering
   * @param {string|null} vaultName - Optional vault name to filter stats
   * @returns {Object} Cache stats
   */
  stats(vaultName = null) {
    let validEntries = 0;
    let expiredEntries = 0;
    let vaultHits = 0;
    let vaultMisses = 0;

    this.cache.forEach((entry, key) => {
      // Filter by vault if specified
      if (vaultName && entry.vaultName !== vaultName) {
        return;
      }

      if (Date.now() - entry.timestamp > this.ttl) {
        expiredEntries++;
      } else {
        validEntries++;
      }

      // Count hits/misses - only count if we're in vault-specific mode
      if (vaultName) {
        // For vault-specific stats, we'd need to track per-vault counters
        // For now, return global counters
      }
    });

    const total = this.hitCount + this.missCount;
    const hitRate = total > 0 ? ((this.hitCount / total) * 100).toFixed(2) : 0;

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      ttlMs: this.ttl,
      hits: this.hitCount,
      misses: this.missCount,
      hitRate: parseFloat(hitRate),
      vaultName: vaultName || 'all', // Indicate scope of stats
    };
  }

}

export { SearchCache };
