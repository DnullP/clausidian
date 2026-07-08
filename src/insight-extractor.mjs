import { Vault } from './vault.mjs';
import { PatternDetector } from './pattern-detector.mjs';

/**
 * Loads all notes from the vault for analysis.
 */
export function loadVaultNotes(vaultRoot) {
  const vault = new Vault(vaultRoot);
  return vault.scanNotes({ includeBody: true });
}

/**
 * Extracts insights from vault notes.
 */
export async function extractInsights(vaultRoot, { maxCandidates = 50 } = {}) {
  const vault = new Vault(vaultRoot);
  const notes = vault.scanNotes({ includeBody: true });
  const detector = new PatternDetector();

  const clusterResult = detector.clusterByContent(notes);
  const painPointsResult = detector.detectPainPoints(notes);

  return {
    clusters: clusterResult.clusters,
    painPoints: painPointsResult.painPoints,
    metadata: {
      totalNotes: notes.length,
      filtered: notes.filter(n => (n.body || '').length > 100).length,
      overallQuality: clusterResult.overallQuality,
      topPains: painPointsResult.topPains,
    }
  };
}
