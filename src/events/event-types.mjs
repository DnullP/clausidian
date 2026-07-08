/**
 * Clausidian Event Types — 29 system events
 * Used with EventBus for flexible automation and plugin hooks
 */

export const SYSTEM_EVENTS = {
  // ── Vault Lifecycle (3) ──
  'vault:initialized': 'Vault started or switched',
  'vault:destroyed': 'Vault closed or removed',
  'vault:switched': 'Switched between vaults',

  // ── Note Operations (4) ──
  'note:created': 'New note added',
  'note:updated': 'Note content modified',
  'note:deleted': 'Note moved to archive',
  'note:renamed': 'Note path changed',

  // ── Index Events (4) ──
  'index:rebuilt': 'Full index rebuild complete',
  'index:invalidated': 'Index entries invalidated',
  'index:synced': 'Index synchronized',
  'index:error': 'Index operation failed',

  // ── Search Events (3) ──
  'search:executed': 'Search query ran',
  'search:cached_hit': 'Result from cache',
  'search:cache_miss': 'Result not in cache',

  // ── File System (2) ──
  'fs:watch_started': 'File watch initialized',
  'fs:error': 'File system error',

  // ── Tag Operations (3) ──
  'tag:created': 'New tag added',
  'tag:updated': 'Tag modified',
  'tag:deleted': 'Tag removed',

  // ── Link Operations (3) ──
  'link:created': 'Link added between notes',
  'link:deleted': 'Link removed',
  'link:invalid': 'Broken link detected',

  // ── Multi-Vault (2) ──
  'vault:sync_started': 'Cross-vault sync begin',
  'vault:sync_complete': 'Cross-vault sync done',

  // ── Memory Graph (4) ──
  'memory:node_added': 'Node added to memory graph',
  'memory:edge_added': 'Edge added between nodes',
  'memory:decay_applied': 'Memory decay applied',
  'memory:promoted': 'Ephemeral memory promoted to persistent',

  // ── Session Memory (3) ──
  'session:start': 'Session started',
  'session:stop': 'Session ended',
  'session:abandoned': 'Session abandoned',

  // ── Memory Bridge (3) ──
  'memory:full_sync': 'Full bidirectional sync completed',
  'memory:pushed': 'Note pushed to Claude memory',
  'memory:pulled': 'Changes pulled from Claude memory',

  // ── Custom Events ──
  // User-defined: "custom:workflow-started", "custom:backup-complete", etc
};

export const SYSTEM_EVENT_PATTERNS = [
  'vault:*',      // All vault events
  'note:*',       // All note events
  'index:*',      // All index events
  'search:*',     // All search events
  'fs:*',         // All file system events
  'tag:*',        // All tag events
  'link:*',       // All link events
  'memory:*',     // All memory events
  'session:*',    // All session events
  'tool:*',       // All tool events
  'journal:*',    // All journal events
  'custom:*',     // All custom events
  '*',            // All events
];

/**
 * Event payload schema (informal)
 */
export const EVENT_PAYLOADS = {
  'vault:initialized': { vault: 'string', config: 'object' },
  'vault:destroyed': { vault: 'string' },
  'vault:switched': { from: 'string', to: 'string' },

  'note:created': { path: 'string', content: 'string', tags: 'array' },
  'note:updated': { path: 'string', oldContent: 'string', newContent: 'string', diff: 'object' },
  'note:deleted': { path: 'string', archive_path: 'string' },
  'note:renamed': { oldPath: 'string', newPath: 'string' },

  'index:rebuilt': { vault: 'string', stats: 'object' },
  'index:invalidated': { pattern: 'string', affected_count: 'number' },
  'index:synced': { changes_count: 'number', duration_ms: 'number' },
  'index:error': { vault: 'string', error: 'string' },

  'search:executed': { keyword: 'string', results_count: 'number', latency_ms: 'number' },
  'search:cached_hit': { keyword: 'string', source: 'string' },
  'search:cache_miss': { keyword: 'string' },

  'fs:watch_started': { vault: 'string', paths: 'array' },
  'fs:error': { vault: 'string', error: 'string', path: 'string' },

  'tag:created': { tag: 'string', count: 'number' },
  'tag:updated': { tag: 'string', oldName: 'string', newName: 'string' },
  'tag:deleted': { tag: 'string' },

  'link:created': { source: 'string', target: 'string' },
  'link:deleted': { source: 'string', target: 'string' },
  'link:invalid': { source: 'string', target: 'string', reason: 'string' },

  'vault:sync_started': { source: 'string', target: 'string', items: 'number' },
  'vault:sync_complete': { source: 'string', target: 'string', synced: 'number', conflicts: 'number' },

  'memory:node_added': { id: 'string', type: 'string', label: 'string' },
  'memory:edge_added': { source: 'string', target: 'string', type: 'string', weight: 'number' },
  'memory:decay_applied': { nodesAffected: 'number', edgesPruned: 'number' },
  'memory:promoted': { nodeIds: 'array' },

  'session:start': { sessionId: 'string', topic: 'string' },
  'session:stop': { sessionId: 'string', reason: 'string', duration: 'number', decisions: 'number', learnings: 'number' },
  'session:abandoned': { sessionId: 'string' },

  'memory:full_sync': { graphNodes: 'number', pushed: 'number', pulled: 'number' },
  'memory:pushed': { note: 'string', path: 'string' },
  'memory:pulled': { note: 'string', action: 'string' },
};

export default SYSTEM_EVENTS;
