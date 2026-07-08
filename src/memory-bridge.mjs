/**
 * MemoryBridge — Dynamic bidirectional bridge between Vault and Memory
 * Coordinates MemoryGraph, SessionMemory, and Claude memory sync
 * Provides unified API for all memory operations
 *
 * v3.6.0+
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { MemoryGraph } from './memory-graph.mjs';
import { SessionMemory } from './session-memory.mjs';

const BRIDGE_VERSION = '1.0';

export class MemoryBridge {
  constructor(vault, config = {}) {
    this.vault = vault;
    this.config = {
      claudeMemoryDir: config.claudeMemoryDir || resolve(
        process.env.HOME || process.env.USERPROFILE,
        '.claude', 'memory'
      ),
      autoSyncOnWrite: config.autoSyncOnWrite !== false,
      bidirectional: config.bidirectional !== false,
      ...config,
    };

    this.graph = new MemoryGraph(vault, config.graphConfig);
    this.sessions = new SessionMemory(vault, this.graph, config.sessionConfig);

    this.storageDir = resolve(vault.root, '.clausidian');
    this.bridgeFile = resolve(this.storageDir, 'memory-bridge.json');
    this.state = this._loadState();

    // Wire up EventBus listeners if available
    this._wireEvents();
  }

  // ── State Management ─────────────────────────────────

  _loadState() {
    if (!existsSync(this.bridgeFile)) {
      return {
        version: BRIDGE_VERSION,
        lastFullSync: null,
        lastIncrementalSync: null,
        syncCount: 0,
        stats: { pushed: 0, pulled: 0, merged: 0, conflicts: 0 },
      };
    }
    try {
      return JSON.parse(readFileSync(this.bridgeFile, 'utf8'));
    } catch {
      return { version: BRIDGE_VERSION, lastFullSync: null, lastIncrementalSync: null, syncCount: 0, stats: { pushed: 0, pulled: 0, merged: 0, conflicts: 0 } };
    }
  }

  _saveState() {
    if (!existsSync(this.storageDir)) mkdirSync(this.storageDir, { recursive: true });
    writeFileSync(this.bridgeFile, JSON.stringify(this.state, null, 2));
  }

  // ── Event Wiring ─────────────────────────────────────

  _wireEvents() {
    const bus = this.vault.eventBus;
    if (!bus) return;

    // Auto-sync on note changes
    bus.subscribe('note:created', (event, payload) => {
      if (this.config.autoSyncOnWrite) {
        this._handleNoteCreated(payload);
      }
    });

    bus.subscribe('note:updated', (event, payload) => {
      if (this.config.autoSyncOnWrite) {
        this._handleNoteUpdated(payload);
      }
    });

    bus.subscribe('note:deleted', (event, payload) => {
      this._handleNoteDeleted(payload);
    });

    bus.subscribe('session:stop', (event, payload) => {
      this._handleSessionStop(payload);
    });
  }

  _handleNoteCreated(payload) {
    const noteName = payload.note;
    const note = this.vault.findNote(noteName);
    if (!note) return;

    // Add to graph
    this.graph.addNode(noteName, note.type, note.title, {
      tags: note.tags,
      status: note.status,
      source: 'vault',
    });

    // Record in current session
    this.sessions.recordEvent('note:created', { note: noteName });

    // Check if should push to Claude memory
    const content = this.vault.read(note.dir, `${noteName}.md`);
    if (content) {
      const fm = this.vault.parseFrontmatter(content);
      if (fm.memory === 'true') {
        this._pushToClaudeMemory(noteName, note, content);
      }
    }

    this.graph.maybeSnapshot();
  }

  _handleNoteUpdated(payload) {
    const noteName = payload.note;
    const note = this.vault.findNote(noteName);
    if (!note) return;

    // Update graph node
    const node = this.graph.getNode(noteName);
    if (node) {
      node.metadata.tags = note.tags;
      node.metadata.status = note.status;
      node.lastAccess = new Date().toISOString();
    }

    this.sessions.recordEvent('note:modified', { note: noteName });

    // Re-push if memory note
    const content = this.vault.read(note.dir, `${noteName}.md`);
    if (content) {
      const fm = this.vault.parseFrontmatter(content);
      if (fm.memory === 'true') {
        this._pushToClaudeMemory(noteName, note, content);
      }
    }
  }

  _handleNoteDeleted(payload) {
    const noteName = payload.note;
    this.graph.removeNode(noteName);
    this._removeFromClaudeMemory(noteName);
    this.sessions.recordEvent('note:deleted', { note: noteName });
  }

  _handleSessionStop(payload) {
    this.sessions.endSession({
      decisions: payload.decisions,
      learnings: payload.learnings,
      nextSteps: payload.nextSteps,
    });
    this.graph.maybeSnapshot();
  }

  // ── Full Sync ────────────────────────────────────────

  /**
   * Full bidirectional sync: vault → graph, vault ↔ Claude memory
   */
  async fullSync() {
    const results = {
      graphSync: null,
      pushSync: null,
      pullSync: null,
      merged: 0,
    };

    // 1. Sync vault → memory graph
    results.graphSync = this.graph.syncFromVault();

    // 2. Push memory:true notes to Claude memory
    results.pushSync = this._pushMemoryNotes();

    // 3. Pull Claude memory changes back (if bidirectional)
    if (this.config.bidirectional) {
      results.pullSync = this._pullClaudeMemory();
    }

    // 4. Apply lifecycle rules
    this.graph.applyDecay();
    const promoted = this.graph.promoteMemories();
    const stale = this.graph.getStaleMemories();

    // 5. Update state
    this.state.lastFullSync = new Date().toISOString();
    this.state.syncCount++;
    this._saveState();
    this.graph.saveToDisk();

    return {
      ...results,
      promoted: promoted.length,
      staleCount: stale.length,
      graphStats: this.graph.getStats(),
    };
  }

  // ── Push: Vault → Claude Memory ─────────────────────

  _pushMemoryNotes() {
    const notes = this.vault.scanNotes({ includeBody: true });
    const memoryNotes = [];
    let pushed = 0;

    for (const note of notes) {
      const content = this.vault.read(note.dir, `${note.file}.md`);
      if (!content) continue;
      const fm = this.vault.parseFrontmatter(content);
      if (fm.memory === 'true' || fm.pin === 'true') {
        memoryNotes.push({ ...note, content, fm });
      }
    }

    for (const note of memoryNotes) {
      this._pushToClaudeMemory(note.file, note, note.content);
      pushed++;
    }

    this.state.stats.pushed += pushed;
    return { total: memoryNotes.length, pushed };
  }

  _pushToClaudeMemory(noteName, note, content) {
    const body = this.vault.extractBody(content);
    const memoryPath = note.type === 'project'
      ? join(this.config.claudeMemoryDir, '..', 'projects',
          noteName.replace(/[^a-z0-9-]/g, ''), 'memory', `vault-${noteName}.md`)
      : join(this.config.claudeMemoryDir, `vault-${noteName}.md`);

    const memoryContent = [
      `# ${note.title}`,
      `Type: ${note.type}`,
      `Tags: ${(note.tags || []).join(', ')}`,
      `Updated: ${note.updated || new Date().toISOString().split('T')[0]}`,
      `Source: clausidian`,
      ``,
      body,
    ].join('\n');

    try {
      const dir = memoryPath.split('/').slice(0, -1).join('/');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(memoryPath, memoryContent);
    } catch { /* silent fail */ }
  }

  _removeFromClaudeMemory(noteName) {
    const memoryPath = join(this.config.claudeMemoryDir, `vault-${noteName}.md`);
    try {
      if (existsSync(memoryPath)) {
        const { unlinkSync } = require('fs');
        unlinkSync(memoryPath);
      }
    } catch { /* silent fail */ }
  }

  // ── Pull: Claude Memory → Vault ─────────────────────

  _pullClaudeMemory() {
    if (!existsSync(this.config.claudeMemoryDir)) {
      return { pulled: 0, reason: 'no memory dir' };
    }

    let pulled = 0;
    const conflicts = [];

    try {
      const files = readdirSync(this.config.claudeMemoryDir)
        .filter(f => f.startsWith('vault-') && f.endsWith('.md'));

      for (const file of files) {
        const noteName = file.replace('vault-', '').replace('.md', '');
        const memoryContent = readFileSync(
          join(this.config.claudeMemoryDir, file), 'utf8'
        );

        // Check if vault note exists
        const vaultNote = this.vault.findNote(noteName);
        if (!vaultNote) {
          // Memory exists in Claude but not in vault — create it
          this._createVaultFromMemory(noteName, memoryContent);
          pulled++;
        } else {
          // Check for conflicts (memory modified after vault)
          const vaultContent = this.vault.read(vaultNote.dir, `${noteName}.md`);
          if (vaultContent) {
            const vaultFm = this.vault.parseFrontmatter(vaultContent);
            const memoryFm = this.vault.parseFrontmatter(memoryContent);

            // Simple conflict detection: different bodies
            const vaultBody = this.vault.extractBody(vaultContent).trim();
            const memoryBody = this.vault.extractBody(memoryContent).trim();

            if (vaultBody !== memoryBody && memoryBody.length > 0) {
              // Memory has been modified externally
              const hasExternalChanges = !memoryContent.includes('Source: clausidian');
              if (hasExternalChanges) {
                conflicts.push({
                  note: noteName,
                  action: 'merge',
                  vaultSize: vaultBody.length,
                  memorySize: memoryBody.length,
                });
                // Auto-merge: append external changes
                this._mergeMemoryToVault(noteName, vaultNote, memoryContent);
                pulled++;
              }
            }
          }
        }
      }
    } catch { /* silent fail */ }

    this.state.stats.pulled += pulled;
    this.state.stats.conflicts += conflicts.length;
    return { pulled, conflicts };
  }

  _createVaultFromMemory(noteName, memoryContent) {
    // Parse metadata from memory content
    const lines = memoryContent.split('\n');
    const typeLine = lines.find(l => l.startsWith('Type:'));
    const tagsLine = lines.find(l => l.startsWith('Tags:'));

    const type = typeLine ? typeLine.replace('Type:', '').trim() : 'idea';
    const tags = tagsLine
      ? tagsLine.replace('Tags:', '').trim().split(',').map(t => t.trim()).filter(Boolean)
      : [];

    const dir = this.vault.typeDir(type);
    const body = this.vault.extractBody(memoryContent);

    const frontmatter = [
      '---',
      `title: "${noteName}"`,
      `type: ${type}`,
      `tags: [${tags.join(', ')}]`,
      `created: ${new Date().toISOString().split('T')[0]}`,
      `updated: ${new Date().toISOString().split('T')[0]}`,
      'status: active',
      'summary: "Imported from Claude memory"',
      'memory: "true"',
      '---',
    ].join('\n');

    const content = `${frontmatter}\n\n${body}`;
    this.vault.write(dir, `${noteName}.md`, content);

    // Add to graph
    this.graph.addNode(noteName, type, noteName, {
      tags,
      source: 'claude-memory',
      imported: true,
    });
  }

  _mergeMemoryToVault(noteName, vaultNote, memoryContent) {
    const vaultContent = this.vault.read(vaultNote.dir, `${noteName}.md`);
    if (!vaultContent) return;

    const memoryBody = this.vault.extractBody(memoryContent);
    const vaultBody = this.vault.extractBody(vaultContent);

    // Only append if memory body has content not in vault
    if (memoryBody && !vaultBody.includes(memoryBody)) {
      const merged = `${vaultContent}\n\n---\n\n## External Changes (auto-merged)\n\n${memoryBody}`;
      this.vault.write(vaultNote.dir, `${noteName}.md`, merged);
      this.state.stats.merged++;
    }
  }

  // ── Context Query ────────────────────────────────────

  /**
   * Get unified context for a topic/query
   * Combines graph traversal, session history, and vault search
   */
  queryContext(query, options = {}) {
    const { maxResults = 10, includeGraph = true, includeSessions = true, includeVault = true } = options;
    const results = {
      query,
      graph: [],
      sessions: [],
      vault: [],
      combined: [],
    };

    // Graph context
    if (includeGraph && this.graph) {
      results.graph = this.graph.queryContext([query], { maxResults: 5, depth: 2 });
    }

    // Session context
    if (includeSessions) {
      const topicSessions = this.sessions.getSessionsByTopic(query);
      if (topicSessions.length > 0) {
        results.sessions = topicSessions.slice(0, 3).map(s => ({
          id: s.id,
          topic: s.context?.topic,
          decisions: s.decisions?.length || 0,
          learnings: s.learnings?.length || 0,
          date: s.started,
        }));
      }

      const pendingSteps = this.sessions.getPendingSteps();
      const relevantSteps = pendingSteps.filter(s =>
        s.step.toLowerCase().includes(query.toLowerCase()) ||
        (s.sessionTopic && s.sessionTopic.toLowerCase().includes(query.toLowerCase()))
      );
      if (relevantSteps.length > 0) {
        results.sessions.push({ type: 'pending-steps', steps: relevantSteps });
      }
    }

    // Vault search
    if (includeVault) {
      results.vault = this.vault.search(query).slice(0, maxResults);
    }

    // Combine and score
    const scored = new Map();

    for (const item of results.graph) {
      scored.set(item.id, {
        id: item.id,
        label: item.label,
        type: item.type,
        score: (item.relevance || 1) * 2, // Graph results get 2x weight
        source: 'graph',
      });
    }

    for (const item of results.vault) {
      const existing = scored.get(item.file);
      const vaultScore = item._score || 1;
      if (existing) {
        existing.score += vaultScore;
        existing.source = 'graph+vault';
      } else {
        scored.set(item.file, {
          id: item.file,
          label: item.title,
          type: item.type,
          score: vaultScore,
          source: 'vault',
        });
      }
    }

    results.combined = Array.from(scored.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return results;
  }

  // ── Diagnostics ──────────────────────────────────────

  getDiagnostics() {
    return {
      version: BRIDGE_VERSION,
      state: this.state,
      graph: this.graph.getStats(),
      sessions: this.sessions.getStats(),
      config: {
        autoSyncOnWrite: this.config.autoSyncOnWrite,
        bidirectional: this.config.bidirectional,
      },
    };
  }

  // ── Maintenance ──────────────────────────────────────

  maintenance() {
    // Apply graph decay
    this.graph.applyDecay();

    // Promote memories
    const promoted = this.graph.promoteMemories();

    // Prune stale memories
    const stale = this.graph.getStaleMemories(this.config.maxSessionAge || 30);

    // Cleanup old sessions
    const sessionCleanup = this.sessions.cleanup();

    // Save state
    this.graph.saveToDisk();
    this._saveState();

    return {
      promoted: promoted.length,
      staleNodes: stale.length,
      sessionCleanup,
      graphStats: this.graph.getStats(),
    };
  }
}

export default MemoryBridge;
