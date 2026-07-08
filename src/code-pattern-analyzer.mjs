import { PatternDetector } from './pattern-detector.mjs';

/**
 * Analyzes code patterns in vault notes.
 */
export function analyzeCodePatterns(notes, { topN = 15 } = {}) {
  const detector = new PatternDetector();
  const result = detector.extractCodePatterns(notes);

  return {
    patterns: result.patterns.slice(0, topN),
    totalPatterns: result.totalPatterns,
    totalSavings: result.totalSavings,
  };
}
