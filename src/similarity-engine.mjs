/**
 * SimilarityEngine — unified similarity scoring for notes
 *
 * Consolidates TF-IDF weighted scoring, keyword overlap, and link suggestion
 * logic that was previously duplicated across index-manager, link, and vault.
 */

import { buildTagIDF, buildDocIDF, buildDocVector, cosineSimilarity } from './scoring.mjs';
import { EmbeddingStore } from './embedding-store.mjs';

export class SimilarityEngine {
  constructor(vault, options = {}) {
    this.vault = vault;
    this.includeBody = options.includeBody ?? false;
    this.minScore = options.minScore ?? 1.5;
    this.maxResults = options.maxResults ?? 25;

    // Cache for tag TF-IDF weights
    this.tfidfCache = null;
    this.tfidfVersion = null;

    // Cache for document TF-IDF vectors
    this.docVectorCache = null;
    this.docVectorVersion = null;

    // Cache for embedding store (semantic search)
    this.embedStore = null;
    this.embedStoreVersion = null;
  }

  /**
   * Get or build TF-IDF weights (cached)
   */
  getTFIDF(notes) {
    // Check cache validity: if notes haven't changed, return cached
    const version = notes.map(n => `${n.file}:${n.tags.join(',')}` ).join('|');
    if (this.tfidfVersion === version) {
      return this.tfidfCache;
    }

    this.tfidfCache = buildTagIDF(notes, 'journal');
    this.tfidfVersion = version;
    return this.tfidfCache;
  }

  /**
   * Get or build document TF-IDF vectors (cached)
   * Cache key includes body length to detect content changes
   */
  getDocVectors(notes) {
    const version = notes.map(n => `${n.file}:${(n.body || '').length}:${n.title}`).join('|');
    if (this.docVectorVersion === version) {
      return this.docVectorCache;
    }

    const idf = buildDocIDF(notes);
    const vectors = new Map();
    for (const n of notes) {
      vectors.set(n.file, buildDocVector(n, idf));
    }

    this.docVectorCache = vectors;
    this.docVectorVersion = version;
    return vectors;
  }

  /**
   * Score all unlinked pairs and return suggested links
   *
   * @param {Array<Object>} notes - All notes from vault
   * @param {Object} options - Scoring options
   *   - incremental: boolean - if true, only score pairs involving dirty notes
   *   - dirtySet: Set<string> - files that changed (for incremental mode)
   * @returns {Array<Object>} Suggested links sorted by score
   */
  scorePairs(notes, options = {}) {
    // Filter non-journal notes with tags (handle both n.type and n.dir properties)
    const nonJournal = notes.filter(n => !(n.type === 'journal') && n.tags && n.tags.length > 0);

    if (nonJournal.length < 2) return [];

    // Get TF-IDF weights (cached)
    const tagIDF = this.getTFIDF(notes);

    // Build document TF-IDF vectors (cached)
    const docVectors = this.getDocVectors(notes);

    // Track existing links (bidirectional)
    const existingLinks = new Set();
    for (const n of nonJournal) {
      for (const rel of n.related) {
        existingLinks.add(`${n.file}→${rel}`);
        existingLinks.add(`${rel}→${n.file}`);
      }
      // Also check body wikilinks
      const wikilinks = (n.body || '').match(/\[\[([^\]]+)\]\]/g) || [];
      for (const w of wikilinks) {
        const target = w.slice(2, -2);
        existingLinks.add(`${n.file}→${target}`);
        existingLinks.add(`${target}→${n.file}`);
      }
    }

    // Determine which pairs to score
    let pairsToScore = [];
    if (options.incremental && options.dirtySet && options.dirtySet.size > 0) {
      // Incremental: only score pairs involving dirty notes
      for (let i = 0; i < nonJournal.length; i++) {
        const a = nonJournal[i];
        if (!options.dirtySet.has(a.file)) continue;

        for (let j = i + 1; j < nonJournal.length; j++) {
          const b = nonJournal[j];
          if (!existingLinks.has(`${a.file}→${b.file}`)) {
            pairsToScore.push([a, b]);
          }
        }
      }
    } else {
      // Full scan: all pairs
      for (let i = 0; i < nonJournal.length; i++) {
        for (let j = i + 1; j < nonJournal.length; j++) {
          const a = nonJournal[i], b = nonJournal[j];
          if (!existingLinks.has(`${a.file}→${b.file}`)) {
            pairsToScore.push([a, b]);
          }
        }
      }
    }

    // Score all pairs
    const suggested = [];
    for (const [a, b] of pairsToScore) {
      let score = 0;
      const shared = [];

      // TF-IDF weighted tag overlap
      for (const t of a.tags) {
        if (b.tags.includes(t)) {
          score += tagIDF[t] || 1;
          shared.push(t);
        }
      }

      // TF-IDF cosine similarity on document content (scale ×3, max +3)
      const sim = cosineSimilarity(
        docVectors.get(a.file) || {},
        docVectors.get(b.file) || {},
      );
      score += sim * 3;

      // Filter: at least 1 shared tag AND score >= threshold
      if (shared.length >= 1 && score >= this.minScore) {
        suggested.push({
          a: a.file,
          b: b.file,
          shared,
          score: Math.round(score * 10) / 10,
        });
      }
    }

    // Sort by score descending
    suggested.sort((a, b) => b.score - a.score);

    return suggested.slice(0, this.maxResults);
  }

  /**
   * Score related notes for a given title and tags
   * Used by vault.findRelated() for search results
   *
   * @param {string} title - Search title
   * @param {Array<string>} tags - Search tags
   * @param {number} maxResults - Max results to return (default 5)
   * @returns {Array<Object>} Related notes sorted by score
   */
  findRelated(title, tags = [], maxResults = 5) {
    const notes = this.vault.scanNotes({ includeBody: true });
    const nonJournal = notes.filter(n => n.type !== 'journal');

    // Get tag TF-IDF weights and document vectors
    const tagIDF = this.getTFIDF(notes);
    const docVectors = this.getDocVectors(notes);
    const titleWords = title.toLowerCase().split(/[\s-]+/).filter(w => w.length > 2);

    // Build a query vector from the title for cosine comparison
    const queryNote = { title, summary: '', body: tags.join(' ') };
    const queryIDF = buildDocIDF([queryNote, ...notes]);
    const queryVec = buildDocVector(queryNote, queryIDF);

    const results = nonJournal.map(n => {
      let score = 0;
      const nText = `${n.title} ${n.summary} ${n.body || ''}`.toLowerCase();

      // Title keyword matches (+1 each, +3 for exact title substring)
      for (const w of titleWords) {
        const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        if (re.test(nText)) score += 1;
      }
      if (nText.includes(title.toLowerCase())) score += 3;

      // TF-IDF weighted tag matches
      for (const t of tags) {
        if (n.tags.includes(t)) score += tagIDF[t] || 2;
      }

      // Cosine similarity on document content (scale ×2)
      const sim = cosineSimilarity(queryVec, docVectors.get(n.file) || {});
      score += sim * 2;

      const { body, ...rest } = n;
      return { ...rest, score: Math.round(score * 10) / 10 };
    })
      .filter(n => n.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return results;
  }

  /**
   * Semantic search using TF-IDF vector similarity (k-NN)
   * Find notes semantically similar to the query text
   * @param {string} queryText - User query text
   * @param {number} k - Number of results (default 10)
   * @returns {Array<{id, title, score}>} Top k semantically similar notes
   */
  semanticSearch(queryText, k = 10) {
    const scannedNotes = this.vault.scanNotes({ includeBody: true });
    if (!scannedNotes || scannedNotes.length === 0) {
      return [];
    }

    // Transform vault notes to embedding store format (id, title, summary, body)
    const notes = scannedNotes.map(n => ({
      id: n.file,
      title: n.title || '',
      summary: n.summary || '',
      body: n.body || '',
    }));

    // Generate version hash from notes content for cache invalidation
    const version = notes.map(n => `${n.id}:${(n.body || '').length}:${n.title}`).join('|');
    if (this.embedStoreVersion !== version) {
      this.embedStore = new EmbeddingStore({ maxResults: k, minScore: 0.1 });
      this.embedStore.build(notes);
      this.embedStoreVersion = version;
    }

    return this.embedStore.search(queryText, k);
  }
}
