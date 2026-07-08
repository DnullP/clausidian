/**
 * Vector Embedding Store — k-NN semantic search using TF-IDF vectors
 *
 * Provides semantic similarity search for notes using sparse TF-IDF vectors.
 * Zero external dependencies — uses existing scoring.mjs utilities.
 */

import { buildDocIDF, buildDocVector, cosineSimilarity } from './scoring.mjs';

export class EmbeddingStore {
  constructor(options = {}) {
    this.k = options.maxResults ?? 10;
    this.minScore = options.minScore ?? 0.1;
    this.idf = {};              // term → idf weight
    this.vectors = new Map();   // noteId → sparse vector
    this.noteIndex = new Map(); // noteId → note metadata
  }

  /**
   * Build vector index from notes array
   * @param {Array<Object>} notes - Notes with id, title, summary, body
   */
  build(notes) {
    if (!notes || notes.length === 0) {
      this.vectors.clear();
      this.noteIndex.clear();
      return;
    }

    // Compute IDF weights from all notes
    this.idf = buildDocIDF(notes);

    // Build vectors for each note
    for (const note of notes) {
      const vector = buildDocVector(note, this.idf);
      this.vectors.set(note.id, vector);
      this.noteIndex.set(note.id, {
        id: note.id,
        title: note.title || '',
        summary: note.summary || '',
      });
    }
  }

  /**
   * k-NN search: find k most similar notes to query text
   * @param {string} queryText - User query text
   * @param {number} k - Number of results (default this.k)
   * @returns {Array<{id, title, score}>} Top k results sorted by similarity
   */
  search(queryText, k = this.k) {
    if (this.vectors.size === 0) {
      return [];
    }

    // Build query vector
    const queryVector = buildDocVector(
      { title: queryText, summary: queryText, body: queryText },
      this.idf
    );

    // Compute similarity to all notes
    const scores = [];
    for (const [noteId, vector] of this.vectors) {
      const sim = cosineSimilarity(queryVector, vector);
      if (sim >= this.minScore) {
        const metadata = this.noteIndex.get(noteId);
        scores.push({
          id: noteId,
          title: metadata.title,
          score: Math.round(sim * 1000) / 1000,
        });
      }
    }

    // Sort by similarity descending, return top k
    return scores
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  /**
   * Serialize to JSON object for persistence
   */
  toJSON() {
    return {
      idf: this.idf,
      vectors: Array.from(this.vectors.entries()),
      noteIndex: Array.from(this.noteIndex.entries()),
      k: this.k,
      minScore: this.minScore,
    };
  }

  /**
   * Restore from JSON object
   */
  static fromJSON(data) {
    const store = new EmbeddingStore({ maxResults: data.k, minScore: data.minScore });
    store.idf = data.idf || {};
    store.vectors = new Map(data.vectors || []);
    store.noteIndex = new Map(data.noteIndex || []);
    return store;
  }
}

/**
 * Convenience: save embeddings to .clausidian/embeddings.json
 */
export async function saveEmbeddings(vault, store) {
  const vaultPath = vault.root;
  const indexDir = `${vaultPath}/.clausidian`;
  const fs = await import('fs/promises');
  const path = await import('path');

  try {
    const indexPath = path.join(indexDir, 'embeddings.json');
    await fs.writeFile(indexPath, JSON.stringify(store.toJSON(), null, 2));
  } catch (e) {
    console.warn(`⚠️  Could not save embeddings: ${e.message}`);
  }
}

/**
 * Convenience: load embeddings from .clausidian/embeddings.json
 */
export async function loadEmbeddings(vault) {
  const vaultPath = vault.root;
  const indexDir = `${vaultPath}/.clausidian`;
  const fs = await import('fs/promises');
  const path = await import('path');

  try {
    const indexPath = path.join(indexDir, 'embeddings.json');
    const data = JSON.parse(await fs.readFile(indexPath, 'utf-8'));
    return EmbeddingStore.fromJSON(data);
  } catch (e) {
    return null; // File doesn't exist or corrupt
  }
}
