/**
 * SessionMemory — Session-level memory persistence
 * Captures, structures, and retrieves session context across agent restarts
 * Integrates with MemoryGraph for relationship tracking
 *
 * v3.6.0+
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { resolve } from 'path';

const SESSION_STATES = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ABANDONED: 'abandoned',
};

const DEFAULT_CONFIG = {
  maxSessions: 100,         // Keep last N sessions
  maxSessionAge: 30,        // Archive sessions older than N days
  contextWindowSize: 10,    // Items in context window
  autoExtract: true,        // Auto-extract decisions/learnings
};

export class SessionMemory {
  constructor(vault, memoryGraph = null, config = {}) {
    this.vault = vault;
    this.graph = memoryGraph;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storageDir = resolve(vault.root, '.clausidian', 'sessions');
    this.currentSession = null;
  }

  // ── Session Lifecycle ────────────────────────────────

  startSession(context = {}) {
    const sessionId = this._generateSessionId();
    const session = {
      id: sessionId,
      state: SESSION_STATES.ACTIVE,
      started: new Date().toISOString(),
      ended: null,
      context: {
        topic: context.topic || null,
        activeNotes: context.activeNotes || [],
        tags: context.tags || [],
        parentSession: context.parentSession || null,
      },
      events: [],
      decisions: [],
      learnings: [],
      nextSteps: [],
      metrics: {
        notesCreated: 0,
        notesModified: 0,
        searchesPerformed: 0,
        duration: 0,
      },
    };

    this.currentSession = session;
    this._persistSession(session);

    // Track in graph
    if (this.graph) {
      this.graph.addNode(`session:${sessionId}`, 'session', `Session ${sessionId.slice(-6)}`, {
        topic: context.topic,
        ephemeral: true,
      });

      // Link to active notes
      for (const note of (context.activeNotes || [])) {
        if (this.graph.nodes.has(note)) {
          this.graph.addEdge(`session:${sessionId}`, note, 'session-active', 1.0);
        }
      }
    }

    return session;
  }

  endSession(summary = {}) {
    if (!this.currentSession) return null;

    const session = this.currentSession;
    session.state = SESSION_STATES.COMPLETED;
    session.ended = new Date().toISOString();
    session.duration = Date.now() - new Date(session.started).getTime();

    // Merge summary
    if (summary.decisions) session.decisions.push(...summary.decisions);
    if (summary.learnings) session.learnings.push(...summary.learnings);
    if (summary.nextSteps) session.nextSteps.push(...summary.nextSteps);

    // Auto-extract from events
    if (this.config.autoExtract) {
      this._autoExtract(session);
    }

    session.metrics.duration = session.duration;
    this._persistSession(session);

    // Update graph node
    if (this.graph) {
      const node = this.graph.getNode(`session:${session.id}`);
      if (node) {
        node.metadata.ephemeral = false;
        node.metadata.decisions = session.decisions.length;
        node.metadata.learnings = session.learnings.length;
      }
    }

    this.currentSession = null;
    return session;
  }

  abandonSession() {
    if (!this.currentSession) return null;

    this.currentSession.state = SESSION_STATES.ABANDONED;
    this.currentSession.ended = new Date().toISOString();
    this._persistSession(this.currentSession);
    this.currentSession = null;
  }

  // ── Event Recording ─────────────────────────────────

  recordEvent(type, data = {}) {
    if (!this.currentSession) return;

    const event = {
      type,
      timestamp: new Date().toISOString(),
      ...data,
    };

    this.currentSession.events.push(event);

    // Update metrics
    switch (type) {
      case 'note:created':
        this.currentSession.metrics.notesCreated++;
        break;
      case 'note:modified':
        this.currentSession.metrics.notesModified++;
        break;
      case 'search:executed':
        this.currentSession.metrics.searchesPerformed++;
        break;
    }

    // Track in graph
    if (this.graph && data.note) {
      const sessionId = `session:${this.currentSession.id}`;
      if (this.graph.nodes.has(data.note)) {
        this.graph.addEdge(sessionId, data.note, `session-${type}`, 0.5);
      }
    }
  }

  recordDecision(decision) {
    if (!this.currentSession) return;
    this.currentSession.decisions.push({
      text: decision,
      timestamp: new Date().toISOString(),
    });
  }

  recordLearning(learning) {
    if (!this.currentSession) return;
    this.currentSession.learnings.push({
      text: learning,
      timestamp: new Date().toISOString(),
    });
  }

  recordNextStep(step) {
    if (!this.currentSession) return;
    this.currentSession.nextSteps.push({
      text: step,
      completed: false,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Context Window ──────────────────────────────────

  /**
   * Build a context window from recent sessions + current context
   */
  buildContextWindow(options = {}) {
    const { maxItems = this.config.contextWindowSize, topic = null } = options;
    const context = [];

    // Current session context
    if (this.currentSession) {
      context.push({
        source: 'current-session',
        type: 'session',
        items: this.currentSession.events.slice(-5).map(e => ({
          text: `${e.type}: ${e.note || e.query || ''}`,
          time: e.timestamp,
        })),
      });
    }

    // Recent sessions with same topic
    const recentSessions = this.getRecentSessions(7);
    const topicSessions = topic
      ? recentSessions.filter(s => s.context?.topic === topic)
      : recentSessions.slice(0, 3);

    for (const session of topicSessions) {
      if (session.decisions.length > 0) {
        context.push({
          source: `session:${session.id.slice(-6)}`,
          type: 'decisions',
          items: session.decisions.map(d => ({
            text: typeof d === 'string' ? d : d.text,
            time: session.started,
          })),
        });
      }
      if (session.learnings.length > 0) {
        context.push({
          source: `session:${session.id.slice(-6)}`,
          type: 'learnings',
          items: session.learnings.map(l => ({
            text: typeof l === 'string' ? l : l.text,
            time: session.started,
          })),
        });
      }
    }

    // Incomplete next steps from recent sessions
    const pendingSteps = [];
    for (const session of recentSessions) {
      for (const step of (session.nextSteps || [])) {
        const stepText = typeof step === 'string' ? step : step.text;
        const completed = typeof step === 'object' && step.completed;
        if (!completed) {
          pendingSteps.push({
            text: stepText,
            source: `session:${session.id.slice(-6)}`,
            time: session.started,
          });
        }
      }
    }
    if (pendingSteps.length > 0) {
      context.push({ source: 'pending', type: 'next-steps', items: pendingSteps });
    }

    // Graph-based context (if graph available)
    if (this.graph && this.currentSession?.context?.activeNotes) {
      const graphContext = this.graph.queryContext(this.currentSession.context.activeNotes, {
        maxResults: 5,
        depth: 2,
      });
      if (graphContext.length > 0) {
        context.push({
          source: 'memory-graph',
          type: 'related',
          items: graphContext.map(g => ({
            text: `${g.label} (${g.type})`,
            relevance: g.relevance,
          })),
        });
      }
    }

    return context.slice(0, maxItems);
  }

  // ── Session Retrieval ────────────────────────────────

  getSession(sessionId) {
    const filePath = resolve(this.storageDir, `${sessionId}.json`);
    if (!existsSync(filePath)) return null;
    try {
      return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch { return null; }
  }

  getRecentSessions(days = 7) {
    if (!existsSync(this.storageDir)) return [];

    const cutoff = Date.now() - days * 86400000;
    const sessions = [];

    try {
      const files = readdirSync(this.storageDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const session = JSON.parse(readFileSync(resolve(this.storageDir, file), 'utf8'));
          const started = new Date(session.started).getTime();
          if (started >= cutoff) {
            sessions.push(session);
          }
        } catch { /* skip corrupted */ }
      }
    } catch { /* directory doesn't exist */ }

    return sessions.sort((a, b) => new Date(b.started) - new Date(a.started));
  }

  getSessionsByTopic(topic) {
    if (!existsSync(this.storageDir)) return [];

    const sessions = [];
    try {
      const files = readdirSync(this.storageDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const session = JSON.parse(readFileSync(resolve(this.storageDir, file), 'utf8'));
          if (session.context?.topic === topic) {
            sessions.push(session);
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }

    return sessions.sort((a, b) => new Date(b.started) - new Date(a.started));
  }

  /**
   * Get unresolved next steps across sessions
   */
  getPendingSteps(maxAgeDays = 14) {
    const sessions = this.getRecentSessions(maxAgeDays);
    const pending = [];

    for (const session of sessions) {
      for (const step of (session.nextSteps || [])) {
        const stepText = typeof step === 'string' ? step : step.text;
        const completed = typeof step === 'object' && step.completed;
        if (!completed) {
          pending.push({
            step: stepText,
            session: session.id,
            sessionTopic: session.context?.topic,
            date: session.started,
          });
        }
      }
    }

    return pending;
  }

  /**
   * Aggregate learnings across sessions
   */
  getAggregatedLearnings(maxAgeDays = 30) {
    const sessions = this.getRecentSessions(maxAgeDays);
    const learnings = new Map();

    for (const session of sessions) {
      for (const learning of (session.learnings || [])) {
        const text = typeof learning === 'string' ? learning : learning.text;
        const key = text.toLowerCase().slice(0, 50);
        if (!learnings.has(key)) {
          learnings.set(key, {
            text,
            count: 0,
            sessions: [],
            firstSeen: session.started,
          });
        }
        const entry = learnings.get(key);
        entry.count++;
        entry.sessions.push(session.id);
      }
    }

    return Array.from(learnings.values())
      .sort((a, b) => b.count - a.count);
  }

  // ── Maintenance ──────────────────────────────────────

  cleanup() {
    if (!existsSync(this.storageDir)) return { archived: 0, deleted: 0 };

    const cutoff = Date.now() - this.config.maxSessionAge * 86400000;
    let archived = 0;
    let deleted = 0;

    try {
      const files = readdirSync(this.storageDir).filter(f => f.endsWith('.json'));
      const sessions = files.map(f => {
        try {
          return { file: f, data: JSON.parse(readFileSync(resolve(this.storageDir, f), 'utf8')) };
        } catch { return null; }
      }).filter(Boolean);

      // Sort by date, keep most recent maxSessions
      sessions.sort((a, b) => new Date(b.data.started) - new Date(a.data.started));

      for (let i = 0; i < sessions.length; i++) {
        const { file, data } = sessions[i];
        const started = new Date(data.started).getTime();

        if (i >= this.config.maxSessions || started < cutoff) {
          if (data.state === SESSION_STATES.ACTIVE) continue; // Don't delete active
          unlinkSync(resolve(this.storageDir, file));
          deleted++;
        }
      }
    } catch { /* skip */ }

    return { archived, deleted };
  }

  getStats() {
    const sessions = this.getRecentSessions(365);
    const byState = {};
    const byTopic = {};
    let totalDuration = 0;
    let totalDecisions = 0;
    let totalLearnings = 0;

    for (const session of sessions) {
      byState[session.state] = (byState[session.state] || 0) + 1;
      const topic = session.context?.topic || 'untagged';
      byTopic[topic] = (byTopic[topic] || 0) + 1;
      totalDuration += session.metrics?.duration || 0;
      totalDecisions += (session.decisions || []).length;
      totalLearnings += (session.learnings || []).length;
    }

    return {
      totalSessions: sessions.length,
      byState,
      byTopic,
      avgDuration: sessions.length > 0 ? Math.round(totalDuration / sessions.length / 1000) : 0,
      totalDecisions,
      totalLearnings,
      pendingSteps: this.getPendingSteps().length,
    };
  }

  // ── Internal Helpers ─────────────────────────────────

  _generateSessionId() {
    const now = new Date();
    const datePart = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const randPart = Math.random().toString(36).slice(2, 6);
    return `${datePart}-${randPart}`;
  }

  _persistSession(session) {
    if (!existsSync(this.storageDir)) mkdirSync(this.storageDir, { recursive: true });
    const filePath = resolve(this.storageDir, `${session.id}.json`);
    writeFileSync(filePath, JSON.stringify(session, null, 2));
  }

  _autoExtract(session) {
    // Extract decisions from note:created/modified events with meaningful changes
    for (const event of session.events) {
      if (event.type === 'note:created' && event.note) {
        // Check if it looks like a decision (project, resource with status change)
        const node = this.vault.findNote(event.note);
        if (node && (node.type === 'project' || node.type === 'resource')) {
          const existingDecision = session.decisions.find(d =>
            (typeof d === 'string' ? d : d.text).includes(event.note)
          );
          if (!existingDecision) {
            session.decisions.push({
              text: `Created ${node.type}: ${event.note}`,
              auto: true,
              timestamp: event.timestamp,
            });
          }
        }
      }
    }

    // Extract learnings from high-search-frequency topics
    const searchTopics = {};
    for (const event of session.events) {
      if (event.type === 'search:executed' && event.query) {
        searchTopics[event.query] = (searchTopics[event.query] || 0) + 1;
      }
    }
    for (const [query, count] of Object.entries(searchTopics)) {
      if (count >= 3) {
        session.learnings.push({
          text: `Frequently searched: "${query}" (${count}x) — candidate for documentation`,
          auto: true,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
}

export default SessionMemory;
