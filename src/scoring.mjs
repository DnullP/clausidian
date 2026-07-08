/**
 * Shared scoring utilities — TF-IDF, keyword extraction, relatedness scoring
 * Consolidates scoring logic used across index-manager, vault, and commands
 */

// Common English stopwords for document vectorization
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'must', 'this', 'that', 'these', 'those',
  'it', 'its', 'i', 'you', 'he', 'she', 'we', 'they', 'what', 'which',
  'who', 'as', 'by', 'from', 'up', 'into', 'then', 'all', 'more', 'no',
  'not', 'so', 'too', 'just', 'me', 'my', 'our', 'his', 'her', 'their',
]);

/**
 * Tokenize a note's text content into lowercased terms, excluding stopwords
 * @param {Object} note - Note with title, summary, body fields
 * @returns {Array<string>} Array of tokens
 */
export function tokenizeDoc(note) {
  const text = `${note.title || ''} ${note.summary || ''} ${note.body || ''}`.toLowerCase();
  const tokens = text.match(/[a-z\u4e00-\u9fff]{2,}/g) || [];
  return tokens.filter(w => !STOPWORDS.has(w));
}

/**
 * Build IDF weights from a collection of notes (document-level)
 * @param {Array<Object>} notes - Notes with text content
 * @returns {Object} term -> IDF weight map
 */
export function buildDocIDF(notes) {
  const df = {};
  const total = notes.length;
  for (const note of notes) {
    const terms = new Set(tokenizeDoc(note));
    for (const term of terms) {
      df[term] = (df[term] || 0) + 1;
    }
  }
  const idf = {};
  for (const [term, count] of Object.entries(df)) {
    // Smoothed IDF to avoid log(0)
    idf[term] = Math.log((total + 1) / (count + 1));
  }
  return idf;
}

/**
 * Build a sparse TF-IDF vector for a single note
 * @param {Object} note - Note with text content
 * @param {Object} idf - IDF weights from buildDocIDF
 * @returns {Object} Sparse vector: term -> tf*idf weight
 */
export function buildDocVector(note, idf) {
  const tokens = tokenizeDoc(note);
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  const len = tokens.length || 1;
  const vec = {};
  for (const [term, count] of Object.entries(tf)) {
    // Skip terms with zero IDF (appear in all docs — not discriminating)
    if (idf[term] > 0) {
      vec[term] = (count / len) * idf[term];
    }
  }
  return vec;
}

/**
 * Compute cosine similarity between two sparse TF-IDF vectors
 * @param {Object} vec1 - Sparse vector A
 * @param {Object} vec2 - Sparse vector B
 * @returns {number} Similarity score in [0, 1]
 */
export function cosineSimilarity(vec1, vec2) {
  let dot = 0, norm1 = 0, norm2 = 0;
  for (const [term, v] of Object.entries(vec1)) {
    dot += v * (vec2[term] || 0);
    norm1 += v * v;
  }
  for (const v of Object.values(vec2)) {
    norm2 += v * v;
  }
  const denom = Math.sqrt(norm1) * Math.sqrt(norm2);
  return denom > 0 ? dot / denom : 0;
}

/**
 * Build TF-IDF weights from notes
 * @param {Array<Object>} notes - All notes with tags
 * @param {string} excludeType - Note type to exclude (e.g., 'journal')
 * @returns {Object} tagIDF map with tag -> IDF weight
 */
export function buildTagIDF(notes, excludeType = 'journal') {
  const filtered = notes.filter(n => n.type !== excludeType && n.tags.length > 0);
  const tagDF = {};

  for (const n of filtered) {
    for (const t of n.tags) {
      tagDF[t] = (tagDF[t] || 0) + 1;
    }
  }

  const totalNotes = filtered.length || 1;
  const tagIDF = {};
  for (const [tag, df] of Object.entries(tagDF)) {
    tagIDF[tag] = Math.log(totalNotes / df);
  }

  return tagIDF;
}

/**
 * Extract keywords from text (3+ chars, including CJK)
 * @param {string} text - Text to extract from
 * @param {number} maxWords - Max words to return (null = no limit)
 * @returns {Set<string>} Set of keywords
 */
export function extractKeywords(text, maxWords = null) {
  const words = text.toLowerCase().match(/[a-z\u4e00-\u9fff]{3,}/g) || [];
  const set = new Set(maxWords ? words.slice(0, maxWords) : words);
  return set;
}

/**
 * Score relatedness between two notes
 * @param {Object} note1 - First note (must have tags, optional body)
 * @param {Object} note2 - Second note (must have tags, optional body)
 * @param {Object} tagIDF - TF-IDF weights from buildTagIDF
 * @returns {Object} {score, shared} where score is float and shared is array of tags
 */
export function scoreRelatedness(note1, note2, tagIDF) {
  let score = 0;
  const shared = [];

  // Tag overlap with TF-IDF weighting
  for (const t of note1.tags) {
    if (note2.tags.includes(t)) {
      score += tagIDF[t] || 1;
      shared.push(t);
    }
  }

  // Keyword co-occurrence in body (if available)
  if (note1.body && note2.body) {
    const words1 = extractKeywords(note1.body, 500);
    const words2 = extractKeywords(note2.body, 500);
    let overlap = 0;
    for (const w of words1) {
      if (words2.has(w)) overlap++;
    }
    // Cap keyword bonus at +2
    score += Math.min(overlap * 0.1, 2);
  }

  return { score, shared };
}

/**
 * Calculate keyword co-occurrence bonus
 * @param {Set<string>} kwA - Keyword set A
 * @param {Set<string>} kwB - Keyword set B
 * @returns {number} Overlap count (capped at +2 when multiplied by 0.1)
 */
export function calculateKeywordOverlap(kwA, kwB) {
  if (!kwA || !kwB) return 0;
  let overlap = 0;
  for (const w of kwA) {
    if (kwB.has(w)) overlap++;
  }
  return Math.min(overlap * 0.1, 2);
}
