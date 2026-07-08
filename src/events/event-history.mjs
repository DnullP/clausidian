/**
 * EventHistory — Persistent event log for Clausidian
 * v3.5.0+
 *
 * Maintains append-only event history with:
 * - Per-vault isolation
 * - Query by event type / date range
 * - Automatic rotation (keep last 1000 events)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';

export class EventHistory {
  constructor(vault, storageDir = null) {
    this.vault = vault;
    // Use vault root + .clausidian, or provided storageDir
    this.storageDir = storageDir || resolve(vault.root, '.clausidian');
    this.historyFile = resolve(this.storageDir, `history-${this.vault.vaultName}.jsonl`);
    this.maxEntries = 1000;
    this.cache = [];
    this.loadFromDisk();
  }

  /**
   * Load history from disk
   */
  loadFromDisk() {
    if (!existsSync(this.historyFile)) {
      this.cache = [];
      return;
    }

    try {
      const content = readFileSync(this.historyFile, 'utf8');
      this.cache = content
        .trim()
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(entry => entry !== null);
    } catch (err) {
      console.error(`[EventHistory] Failed to load history: ${err.message}`);
      this.cache = [];
    }
  }

  /**
   * Append event to history
   */
  append(event, payload, result = {}) {
    const entry = {
      ts: new Date().toISOString(),
      vault: this.vault.vaultName,
      event,
      payload,
      success: result.success !== false,
      errors: result.errors || [],
      hash: this.#generateHash(event, payload),
    };

    this.cache.push(entry);

    // Rotate if exceeds max entries
    if (this.cache.length > this.maxEntries) {
      this.cache = this.cache.slice(-this.maxEntries);
    }

    // Write to disk (non-blocking)
    setImmediate(() => this.saveToDisk());

    return entry;
  }

  /**
   * Save history to disk (append-only)
   */
  saveToDisk() {
    try {
      // Ensure directory exists
      if (!existsSync(this.storageDir)) {
        mkdirSync(this.storageDir, { recursive: true });
      }
      const lines = this.cache.map(entry => JSON.stringify(entry));
      writeFileSync(this.historyFile, lines.join('\n') + '\n', 'utf8');
    } catch (err) {
      console.error(`[EventHistory] Failed to save history: ${err.message}`);
    }
  }

  /**
   * Query history by event type
   */
  queryByEvent(eventPattern) {
    return this.cache.filter(entry => {
      if (eventPattern === '*') return true;
      if (eventPattern.endsWith(':*')) {
        const prefix = eventPattern.slice(0, -2);
        return entry.event.startsWith(prefix + ':');
      }
      return entry.event === eventPattern;
    });
  }

  /**
   * Query history by date range
   */
  queryByDateRange(startTime, endTime) {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();

    return this.cache.filter(entry => {
      const ts = new Date(entry.ts).getTime();
      return ts >= start && ts <= end;
    });
  }

  /**
   * Query by vault
   */
  queryByVault(vaultName) {
    return this.cache.filter(entry => entry.vault === vaultName);
  }

  /**
   * Get recent events
   */
  getRecent(count = 20) {
    return this.cache.slice(-count);
  }

  /**
   * Clear history (for testing)
   */
  clear() {
    this.cache = [];
    try {
      if (existsSync(this.historyFile)) {
        writeFileSync(this.historyFile, '', 'utf8');
      }
    } catch (err) {
      console.error(`[EventHistory] Failed to clear history: ${err.message}`);
    }
  }

  /**
   * Generate hash for event deduplication
   */
  #generateHash(event, payload) {
    const data = JSON.stringify({ event, payload });
    return createHash('sha256').update(data).digest('hex').slice(0, 8);
  }

  /**
   * Get summary statistics
   */
  getStats() {
    const byEvent = {};
    const byVault = {};

    for (const entry of this.cache) {
      byEvent[entry.event] = (byEvent[entry.event] || 0) + 1;
      byVault[entry.vault] = (byVault[entry.vault] || 0) + 1;
    }

    return {
      totalEvents: this.cache.length,
      byEvent,
      byVault,
      oldestEvent: this.cache[0]?.ts,
      newestEvent: this.cache[this.cache.length - 1]?.ts,
    };
  }
}

export default EventHistory;
