/**
 * EventBus — Universal event system for Clausidian
 * Replaces 4-hook system with flexible pattern-based subscriptions
 * v3.5.0+
 */

export class EventBus {
  constructor(vault) {
    this.vault = vault;
    this.listeners = new Map();        // pattern → [{ handler, priority, once }]
    this.history = [];                 // Last 100 events
    this.maxHistory = 100;
  }

  /**
   * Subscribe to events by pattern
   * @param {string} pattern - "note:*", "search:*", "vault:*", "custom:*"
   * @param {Function} handler - async (event, payload) => void
   * @param {object} options - { once: false, priority: 0 }
   * @returns {object} - { unsubscribe() }
   */
  subscribe(pattern, handler, options = {}) {
    const { once = false, priority = 0 } = options;

    if (!this.listeners.has(pattern)) {
      this.listeners.set(pattern, []);
    }

    const listener = { handler, priority, once, pattern };
    const list = this.listeners.get(pattern);
    list.push(listener);

    // Sort by priority (higher first)
    list.sort((a, b) => b.priority - a.priority);

    // Return unsubscribe function
    return {
      unsubscribe: () => {
        const idx = list.indexOf(listener);
        if (idx !== -1) list.splice(idx, 1);
      },
    };
  }

  /**
   * Subscribe once (auto-unsubscribe after first emit)
   */
  once(event, handler, priority = 0) {
    return this.subscribe(event, handler, { once: true, priority });
  }

  /**
   * Emit event to all matching listeners
   * @param {string} event - Event name
   * @param {*} payload - Event data
   * @returns {object} - { success, errors, results }
   */
  async emit(event, payload) {
    const result = {
      event,
      timestamp: new Date().toISOString(),
      success: true,
      errors: [],
      results: [],
    };

    // Record in history
    this.history.push(result);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    // Find matching listeners
    const matchedPatterns = this.#matchPatterns(event);
    const handlersToRun = [];

    for (const pattern of matchedPatterns) {
      const listeners = this.listeners.get(pattern) || [];
      for (const listener of listeners) {
        handlersToRun.push(listener);
      }
    }

    // Execute handlers by priority
    for (const listener of handlersToRun) {
      try {
        const res = await listener.handler(event, payload);
        result.results.push({ pattern: listener.pattern, result: res });

        // Auto-unsubscribe if once
        if (listener.once) {
          const list = this.listeners.get(listener.pattern);
          const idx = list.indexOf(listener);
          if (idx !== -1) list.splice(idx, 1);
        }
      } catch (err) {
        result.success = false;
        result.errors.push({
          pattern: listener.pattern,
          error: err.message,
          stack: err.stack,
        });
      }
    }

    return result;
  }

  /**
   * Match event against all subscribed patterns
   * @private
   */
  #matchPatterns(event) {
    const patterns = Array.from(this.listeners.keys());
    const matched = [];

    for (const pattern of patterns) {
      // Exact match
      if (pattern === event) {
        matched.push(pattern);
        continue;
      }

      // Wildcard match: "note:*" matches "note:created", "note:updated"
      if (pattern.endsWith(':*')) {
        const prefix = pattern.slice(0, -2); // Remove ":*"
        if (event.startsWith(prefix + ':')) {
          matched.push(pattern);
        }
        continue;
      }

      // Global wildcard: "*"
      if (pattern === '*') {
        matched.push(pattern);
      }
    }

    return matched;
  }

  /**
   * Get all active listeners
   */
  listListeners() {
    const result = {};
    for (const [pattern, listeners] of this.listeners.entries()) {
      result[pattern] = listeners.map((l) => ({
        priority: l.priority,
        once: l.once,
      }));
    }
    return result;
  }

  /**
   * Get event history
   */
  getHistory(limit = 20) {
    return this.history.slice(-limit);
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
  }

  /**
   * Clear all listeners for a pattern
   */
  clearListeners(pattern) {
    if (pattern === '*') {
      this.listeners.clear();
    } else {
      this.listeners.delete(pattern);
    }
  }
}

export default EventBus;
