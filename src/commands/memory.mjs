/**
 * memory — Dynamic vault-memory management
 * Bidirectional sync, lifecycle, context-aware retrieval, graph operations
 * v3.6.0+
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { Vault } from '../vault.mjs';
import { MemoryBridge } from '../memory-bridge.mjs';
import { MemoryGraph } from '../memory-graph.mjs';
import { SessionMemory } from '../session-memory.mjs';
import { SimilarityEngine } from '../similarity-engine.mjs';

// ── Legacy API (backward compatible) ──────────────────

export function memorySync(vaultRoot, options = {}) {
  const vault = new Vault(vaultRoot);
  const home = process.env.HOME || process.env.USERPROFILE;
  const dryRun = options.dryRun === true;

  const notes = vault.scanNotes({ includeBody: true });
  const memoryNotes = [];

  for (const note of notes) {
    const content = vault.read(note.dir, `${note.file}.md`);
    if (!content) continue;
    const fm = vault.parseFrontmatter(content);
    if (fm.memory === 'true' || fm.pin === 'true') {
      memoryNotes.push({ ...note, content, fm });
    }
  }

  const results = { synced: [], pending: [], outdated: [] };

  for (const note of memoryNotes) {
    const body = vault.extractBody(note.content);
    const memoryPath = note.type === 'project'
      ? join(home, '.claude', 'projects', note.file.replace(/[^a-z0-9-]/g, ''), 'memory', `vault-${note.file}.md`)
      : join(home, '.claude', 'memory', `vault-${note.file}.md`);

    const memoryContent = [
      `# ${note.title}`,
      `Type: ${note.type}`,
      `Tags: ${note.tags.join(', ')}`,
      `Updated: ${note.updated}`,
      `Source: clausidian`,
      ``,
      body,
    ].join('\n');

    if (!dryRun) {
      const dir = memoryPath.split('/').slice(0, -1).join('/');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(memoryPath, memoryContent);
      results.synced.push(note.file);
    } else {
      results.pending.push(note.file);
    }
  }

  console.log(JSON.stringify({
    status: dryRun ? 'preview' : 'synced',
    synced: results.synced.length,
    pending: results.pending.length,
    notes: results.synced.concat(results.pending),
  }));

  return results;
}

export function memoryPush(vaultRoot, noteName, options = {}) {
  const vault = new Vault(vaultRoot);
  const home = process.env.HOME || process.env.USERPROFILE;

  const note = vault.findNote(noteName);
  if (!note) {
    console.log(JSON.stringify({ status: 'error', reason: 'note not found', note: noteName }));
    return;
  }

  const content = vault.read(note.dir, `${note.file}.md`);
  if (!content) {
    console.log(JSON.stringify({ status: 'error', reason: 'cannot read note' }));
    return;
  }

  const fm = vault.parseFrontmatter(content);
  const body = vault.extractBody(content);

  const memoryPath = note.type === 'project'
    ? join(home, '.claude', 'projects', note.file.replace(/[^a-z0-9-]/g, ''), 'memory', `vault-${note.file}.md`)
    : join(home, '.claude', 'memory', `vault-${note.file}.md`);

  const memoryContent = [
    `# ${note.title}`,
    `Type: ${note.type}`,
    `Tags: ${note.tags.join(', ')}`,
    `Updated: ${note.updated}`,
    `Source: clausidian`,
    ``,
    body,
  ].join('\n');

  const dir = memoryPath.split('/').slice(0, -1).join('/');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(memoryPath, memoryContent);

  console.log(JSON.stringify({
    status: 'pushed',
    note: note.file,
    path: memoryPath,
    type: note.type,
  }));
}

export function memoryStatus(vaultRoot, options = {}) {
  const vault = new Vault(vaultRoot);
  const home = process.env.HOME || process.env.USERPROFILE;

  const notes = vault.scanNotes();
  const memoryNotes = notes.filter(n => {
    const content = vault.read(n.dir, `${n.file}.md`);
    if (!content) return false;
    const fm = vault.parseFrontmatter(content);
    return fm.memory === 'true' || fm.pin === 'true';
  });

  const synced = [];
  const pending = [];

  for (const note of memoryNotes) {
    const memoryPath = note.type === 'project'
      ? join(home, '.claude', 'projects', note.file.replace(/[^a-z0-9-]/g, ''), 'memory', `vault-${note.file}.md`)
      : join(home, '.claude', 'memory', `vault-${note.file}.md`);

    if (existsSync(memoryPath)) {
      synced.push(note.file);
    } else {
      pending.push(note.file);
    }
  }

  console.log(JSON.stringify({
    status: 'ok',
    synced,
    pending,
    syncedCount: synced.length,
    pendingCount: pending.length,
  }));

  return { synced, pending };
}

export function contextForTopic(vaultRoot, topic, options = {}) {
  const vault = new Vault(vaultRoot);
  const bridge = new MemoryBridge(vault);
  const result = bridge.queryContext(topic, {
    maxResults: options.maxResults || 10,
    depth: options.depth || 2,
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

// ── New Dynamic API ───────────────────────────────────

/**
 * Full bidirectional sync with graph + lifecycle
 */
export function memoryFullSync(vaultRoot, options = {}) {
  const vault = new Vault(vaultRoot);
  const bridge = new MemoryBridge(vault);

  const result = bridge.fullSync();
  console.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Memory graph operations
 */
export function memoryGraph(vaultRoot, action, options = {}) {
  const vault = new Vault(vaultRoot);
  const graph = new MemoryGraph(vault);

  let result;

  switch (action) {
    case 'stats':
      result = graph.getStats();
      break;

    case 'sync':
      result = graph.syncFromVault();
      graph.saveToDisk();
      break;

    case 'neighbors': {
      const nodeId = options.node;
      if (!nodeId) throw new Error('--node required for neighbors');
      result = graph.getNeighbors(nodeId, options.depth || 2);
      break;
    }

    case 'query': {
      const query = options.query;
      if (!query) throw new Error('--query required');
      result = graph.queryContext([query], { maxResults: options.limit || 10 });
      break;
    }

    case 'connections': {
      const nodeId = options.node;
      if (!nodeId) throw new Error('--node required for connections');
      result = graph.getStrongestConnections(nodeId, options.limit || 5);
      break;
    }

    case 'hubs':
      result = graph.getStats().hubNodes;
      break;

    case 'decay':
      graph.applyDecay();
      graph.saveToDisk();
      result = { status: 'decay applied', stats: graph.getStats() };
      break;

    default:
      throw new Error(`Unknown graph action: ${action}. Use: stats|sync|neighbors|query|connections|hubs|decay`);
  }

  console.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Session memory operations
 */
export function memorySession(vaultRoot, action, options = {}) {
  const vault = new Vault(vaultRoot);
  const graph = new MemoryGraph(vault);
  const sessions = new SessionMemory(vault, graph);

  let result;

  switch (action) {
    case 'start':
      result = sessions.startSession({
        topic: options.topic,
        activeNotes: options.notes ? options.notes.split(',') : [],
      });
      break;

    case 'end':
      result = sessions.endSession({
        decisions: options.decisions ? options.decisions.split(';') : [],
        learnings: options.learnings ? options.learnings.split(';') : [],
        nextSteps: options.steps ? options.steps.split(';') : [],
      });
      break;

    case 'stats':
      result = sessions.getStats();
      break;

    case 'recent':
      result = sessions.getRecentSessions(options.days || 7);
      break;

    case 'pending':
      result = sessions.getPendingSteps(options.days || 14);
      break;

    case 'learnings':
      result = sessions.getAggregatedLearnings(options.days || 30);
      break;

    case 'context':
      result = sessions.buildContextWindow({ topic: options.topic });
      break;

    case 'cleanup':
      result = sessions.cleanup();
      break;

    default:
      throw new Error(`Unknown session action: ${action}. Use: start|end|stats|recent|pending|learnings|context|cleanup`);
  }

  console.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Memory lifecycle operations
 */
export function memoryLifecycle(vaultRoot, action, options = {}) {
  const vault = new Vault(vaultRoot);
  const bridge = new MemoryBridge(vault);

  let result;

  switch (action) {
    case 'promote':
      bridge.graph.applyDecay();
      result = { promoted: bridge.graph.promoteMemories() };
      bridge.graph.saveToDisk();
      break;

    case 'stale':
      result = bridge.graph.getStaleMemories(options.days || 30);
      break;

    case 'maintenance':
      result = bridge.maintenance();
      break;

    case 'diagnostics':
      result = bridge.getDiagnostics();
      break;

    default:
      throw new Error(`Unknown lifecycle action: ${action}. Use: promote|stale|maintenance|diagnostics`);
  }

  console.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Semantic similarity search — find notes by meaning
 * Uses TF-IDF vector embeddings and k-NN search
 */
export function memorySemanticSearch(vaultRoot, query, options = {}) {
  if (!query || query.trim().length === 0) {
    throw new Error('Query text is required');
  }

  const vault = new Vault(vaultRoot);
  const engine = new SimilarityEngine(vault, {
    maxResults: options.k || 10,
    minScore: options.minScore || 0.1,
  });

  const results = engine.semanticSearch(query, options.k || 10);

  return {
    query,
    results: results.map(r => ({
      id: r.id,
      title: r.title,
      similarity: r.score,
    })),
    count: results.length,
  };
}
