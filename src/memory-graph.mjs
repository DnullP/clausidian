/**
 * MemoryGraph — Graph-based memory relationship management
 * Tracks weighted relationships between notes, sessions, and topics
 * Supports context-aware retrieval and memory lifecycle
 *
 * v3.6.0+
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { createHash } from 'crypto';

const DEFAULT_CONFIG = {
  decayRate: 0.95,          // Daily decay multiplier for memory strength
  promotionThreshold: 3,    // Access count to promote from ephemeral to persistent
  maxEdgesPerNode: 20,      // Limit edges to prevent graph bloat
  minEdgeWeight: 0.1,       // Prune edges below this weight
  snapshotInterval: 3600000, // Auto-snapshot every hour (ms)
};

export class MemoryGraph {
  constructor(vault, config = {}) {
    this.vault = vault;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.storageDir = resolve(vault.root, '.clausidian');
    this.graphFile = resolve(this.storageDir, 'memory-graph.json');

    // Graph data structures
    this.nodes = new Map();   // id → { type, label, weight, metadata, lastAccess, accessCount, created }
    this.edges = new Map();   // edgeKey → { source, target, weight, type, created, lastReinforced }
    this.adjacency = new Map(); // id → Set<edgeKey>

    // Indexes for fast lookup
    this.nodesByType = new Map(); // type → Set<id>
    this.lastSnapshot = 0;

    this.loadFromDisk();
  }

  // ── Persistence ──────────────────────────────────────

  loadFromDisk() {
    if (!existsSync(this.graphFile)) return;

    try {
      const data = JSON.parse(readFileSync(this.graphFile, 'utf8'));

      // Restore nodes
      for (const [id, node] of Object.entries(data.nodes || {})) {
        this.nodes.set(id, node);
        if (!this.nodesByType.has(node.type)) this.nodesByType.set(node.type, new Set());
        this.nodesByType.get(node.type).add(id);
      }

      // Restore edges
      for (const [key, edge] of Object.entries(data.edges || {})) {
        this.edges.set(key, edge);
        if (!this.adjacency.has(edge.source)) this.adjacency.set(edge.source, new Set());
        if (!this.adjacency.has(edge.target)) this.adjacency.set(edge.target, new Set());
        this.adjacency.get(edge.source).add(key);
        this.adjacency.get(edge.target).add(key);
      }
    } catch { /* corrupted file, start fresh */ }
  }

  saveToDisk() {
    if (!existsSync(this.storageDir)) mkdirSync(this.storageDir, { recursive: true });

    const data = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      nodes: Object.fromEntries(this.nodes),
      edges: Object.fromEntries(this.edges),
    };

    const tmpPath = `${this.graphFile}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    writeFileSync(this.graphFile, JSON.stringify(data, null, 2));
  }

  // ── Node Operations ──────────────────────────────────

  addNode(id, type, label, metadata = {}) {
    const existing = this.nodes.get(id);
    if (existing) {
      existing.label = label;
      existing.metadata = { ...existing.metadata, ...metadata };
      existing.lastAccess = new Date().toISOString();
      existing.accessCount = (existing.accessCount || 0) + 1;
      return existing;
    }

    const node = {
      type,
      label,
      weight: 1.0,
      metadata,
      lastAccess: new Date().toISOString(),
      accessCount: 1,
      created: new Date().toISOString(),
    };

    this.nodes.set(id, node);
    if (!this.adjacency.has(id)) this.adjacency.set(id, new Set());

    if (!this.nodesByType.has(type)) this.nodesByType.set(type, new Set());
    this.nodesByType.get(type).add(id);

    return node;
  }

  removeNode(id) {
    const adjKeys = this.adjacency.get(id);
    if (adjKeys) {
      for (const edgeKey of adjKeys) {
        const edge = this.edges.get(edgeKey);
        if (edge) {
          const otherId = edge.source === id ? edge.target : edge.source;
          this.adjacency.get(otherId)?.delete(edgeKey);
          this.edges.delete(edgeKey);
        }
      }
      this.adjacency.delete(id);
    }

    const node = this.nodes.get(id);
    if (node) {
      this.nodesByType.get(node.type)?.delete(id);
      this.nodes.delete(id);
    }
  }

  getNode(id) {
    const node = this.nodes.get(id);
    if (node) {
      node.lastAccess = new Date().toISOString();
      node.accessCount = (node.accessCount || 0) + 1;
    }
    return node || null;
  }

  getNodesByType(type) {
    const ids = this.nodesByType.get(type) || new Set();
    return Array.from(ids).map(id => ({ id, ...this.nodes.get(id) }));
  }

  // ── Edge Operations ──────────────────────────────────

  _edgeKey(source, target) {
    return [source, target].sort().join('::');
  }

  addEdge(source, target, type = 'related', weight = 1.0) {
    if (source === target) return null;

    // Ensure nodes exist
    if (!this.nodes.has(source) || !this.nodes.has(target)) return null;

    const key = this._edgeKey(source, target);
    const existing = this.edges.get(key);

    if (existing) {
      // Reinforce existing edge (cap at 10)
      existing.weight = Math.min(10, existing.weight + weight * 0.5);
      existing.lastReinforced = new Date().toISOString();
      return existing;
    }

    // Prune if too many edges
    const sourceAdj = this.adjacency.get(source);
    if (sourceAdj && sourceAdj.size >= this.config.maxEdgesPerNode) {
      this._pruneWeakestEdge(source);
    }

    const edge = {
      source,
      target,
      weight,
      type,
      created: new Date().toISOString(),
      lastReinforced: new Date().toISOString(),
    };

    this.edges.set(key, edge);
    this.adjacency.get(source).add(key);
    this.adjacency.get(target).add(key);

    return edge;
  }

  removeEdge(source, target) {
    const key = this._edgeKey(source, target);
    const edge = this.edges.get(key);
    if (!edge) return false;

    this.adjacency.get(source)?.delete(key);
    this.adjacency.get(target)?.delete(key);
    this.edges.delete(key);
    return true;
  }

  _pruneWeakestEdge(nodeId) {
    const adjKeys = this.adjacency.get(nodeId);
    if (!adjKeys || adjKeys.size === 0) return;

    let weakestKey = null;
    let weakestWeight = Infinity;

    for (const key of adjKeys) {
      const edge = this.edges.get(key);
      if (edge && edge.weight < weakestWeight) {
        weakestWeight = edge.weight;
        weakestKey = key;
      }
    }

    if (weakestKey) {
      const edge = this.edges.get(weakestKey);
      const otherId = edge.source === nodeId ? edge.target : edge.source;
      this.adjacency.get(otherId)?.delete(weakestKey);
      this.adjacency.get(nodeId).delete(weakestKey);
      this.edges.delete(weakestKey);
    }
  }

  // ── Graph Traversal ──────────────────────────────────

  getNeighbors(id, depth = 1) {
    const visited = new Set();
    const result = [];
    const queue = [{ id, currentDepth: 0 }];

    while (queue.length > 0) {
      const { id: currentId, currentDepth } = queue.shift();
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      if (currentId !== id) {
        const node = this.nodes.get(currentId);
        if (node) result.push({ id: currentId, ...node, depth: currentDepth });
      }

      if (currentDepth < depth) {
        const adjKeys = this.adjacency.get(currentId) || new Set();
        for (const key of adjKeys) {
          const edge = this.edges.get(key);
          if (!edge) continue;
          const nextId = edge.source === currentId ? edge.target : edge.source;
          if (!visited.has(nextId)) {
            queue.push({ id: nextId, currentDepth: currentDepth + 1 });
          }
        }
      }
    }

    return result.sort((a, b) => b.weight - a.weight);
  }

  getStrongestConnections(id, limit = 5) {
    const adjKeys = this.adjacency.get(id) || new Set();
    const connections = [];

    for (const key of adjKeys) {
      const edge = this.edges.get(key);
      if (!edge) continue;
      const otherId = edge.source === id ? edge.target : edge.source;
      const node = this.nodes.get(otherId);
      if (node) {
        connections.push({
          id: otherId,
          ...node,
          edgeWeight: edge.weight,
          edgeType: edge.type,
        });
      }
    }

    return connections.sort((a, b) => b.edgeWeight - a.edgeWeight).slice(0, limit);
  }

  // ── Context-Aware Retrieval ──────────────────────────

  /**
   * Get memories relevant to a context (list of topics/tags/files)
   * Uses graph traversal + relevance scoring
   */
  queryContext(contextItems, options = {}) {
    const { maxResults = 10, depth = 2, minRelevance = 0.3 } = options;
    const scores = new Map(); // id → relevance score

    for (const item of contextItems) {
      // Direct node match
      const directNode = this.nodes.get(item);
      if (directNode) {
        scores.set(item, (scores.get(item) || 0) + directNode.weight);
        directNode.lastAccess = new Date().toISOString();
        directNode.accessCount = (directNode.accessCount || 0) + 1;
      }

      // Search by label/metadata
      for (const [id, node] of this.nodes) {
        if (id === item) continue;
        const labelMatch = node.label?.toLowerCase().includes(item.toLowerCase());
        const tagMatch = node.metadata?.tags?.some(t => t.toLowerCase().includes(item.toLowerCase()));
        if (labelMatch || tagMatch) {
          scores.set(id, (scores.get(id) || 0) + 0.5 * node.weight);
        }
      }

      // Graph proximity boost
      const neighbors = this.getNeighbors(item, depth);
      for (const neighbor of neighbors) {
        const proximityScore = neighbor.weight / (neighbor.depth + 1);
        scores.set(neighbor.id, (scores.get(neighbor.id) || 0) + proximityScore);
      }
    }

    // Sort by score, filter by minRelevance
    const results = Array.from(scores.entries())
      .filter(([_, score]) => score >= minRelevance)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxResults)
      .map(([id, score]) => {
        const node = this.nodes.get(id);
        return { id, ...node, relevance: Math.round(score * 100) / 100 };
      });

    return results;
  }

  // ── Lifecycle Management ─────────────────────────────

  /**
   * Apply decay to all node weights based on age
   */
  applyDecay() {
    const now = Date.now();
    const dayMs = 86400000;

    for (const [id, node] of this.nodes) {
      const lastAccess = new Date(node.lastAccess).getTime();
      const daysSinceAccess = (now - lastAccess) / dayMs;
      node.weight *= Math.pow(this.config.decayRate, daysSinceAccess);

      // Floor at 0.01
      if (node.weight < 0.01) node.weight = 0.01;
    }

    // Also decay edge weights
    for (const [key, edge] of this.edges) {
      const lastReinforce = new Date(edge.lastReinforced).getTime();
      const daysSinceReinforce = (now - lastReinforce) / dayMs;
      edge.weight *= Math.pow(this.config.decayRate, daysSinceReinforce);

      // Prune very weak edges
      if (edge.weight < this.config.minEdgeWeight) {
        this.adjacency.get(edge.source)?.delete(key);
        this.adjacency.get(edge.target)?.delete(key);
        this.edges.delete(key);
      }
    }
  }

  /**
   * Promote ephemeral memories to persistent based on access count
   */
  promoteMemories() {
    const promoted = [];
    for (const [id, node] of this.nodes) {
      if (node.metadata?.ephemeral && node.accessCount >= this.config.promotionThreshold) {
        node.metadata.ephemeral = false;
        node.metadata.promoted = new Date().toISOString();
        promoted.push(id);
      }
    }
    return promoted;
  }

  /**
   * Get memories that should be archived (very low weight, old)
   */
  getStaleMemories(maxAgeDays = 30) {
    const now = Date.now();
    const cutoff = now - maxAgeDays * 86400000;
    const stale = [];

    for (const [id, node] of this.nodes) {
      const lastAccess = new Date(node.lastAccess).getTime();
      if (lastAccess < cutoff && node.weight < 0.5) {
        stale.push({ id, ...node, age: Math.round((now - lastAccess) / 86400000) });
      }
    }

    return stale.sort((a, b) => a.weight - b.weight);
  }

  // ── Vault Integration ────────────────────────────────

  /**
   * Sync vault notes into the memory graph
   */
  syncFromVault() {
    const notes = this.vault.scanNotes();
    let added = 0;
    let edges = 0;

    for (const note of notes) {
      const existing = this.nodes.get(note.file);
      if (existing) {
        // Update metadata
        existing.label = note.title;
        existing.metadata.tags = note.tags;
        existing.metadata.status = note.status;
        existing.metadata.type = note.type;
        continue;
      }

      // Add node
      this.addNode(note.file, note.type, note.title, {
        tags: note.tags,
        status: note.status,
        summary: note.summary,
        source: 'vault',
      });
      added++;

      // Add edges from related field
      for (const rel of note.related) {
        const relName = rel.replace(/^\[\[|\]\]$/g, '');
        if (this.nodes.has(relName)) {
          this.addEdge(note.file, relName, 'related', 1.0);
          edges++;
        }
      }

      // Add edges by shared tags
      for (const other of notes) {
        if (other.file === note.file) continue;
        const sharedTags = note.tags.filter(t => other.tags.includes(t));
        if (sharedTags.length >= 2) {
          this.addEdge(note.file, other.file, 'tag-similar', sharedTags.length * 0.3);
          edges++;
        }
      }
    }

    return { added, edges, total: this.nodes.size };
  }

  // ── Statistics & Diagnostics ─────────────────────────

  getStats() {
    const nodesByType = {};
    for (const [type, ids] of this.nodesByType) {
      nodesByType[type] = ids.size;
    }

    const edgeTypes = {};
    for (const [, edge] of this.edges) {
      edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
    }

    // Find hub nodes (most connections)
    const hubNodes = Array.from(this.adjacency.entries())
      .map(([id, adj]) => ({ id, connections: adj.size }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 5);

    return {
      nodes: this.nodes.size,
      edges: this.edges.size,
      nodesByType,
      edgeTypes,
      hubNodes,
      avgConnections: this.nodes.size > 0
        ? Math.round(Array.from(this.adjacency.values()).reduce((s, a) => s + a.size, 0) / this.nodes.size * 10) / 10
        : 0,
    };
  }

  /**
   * Auto-snapshot if interval has passed
   */
  maybeSnapshot() {
    const now = Date.now();
    if (now - this.lastSnapshot > this.config.snapshotInterval) {
      this.applyDecay();
      this.promoteMemories();
      this.saveToDisk();
      this.lastSnapshot = now;
      return true;
    }
    return false;
  }
}

export default MemoryGraph;
