/**
 * link — find and create missing links using TF-IDF weighted scoring
 *
 * Uses SimilarityEngine to find highest-value unlinked pairs,
 * then creates bidirectional related links.
 */
import { Vault } from '../vault.mjs';
import { IndexManager } from '../index-manager.mjs';
import { SimilarityEngine } from '../similarity-engine.mjs';
import { todayStr } from '../dates.mjs';

function scorePairs(notes) {
  const engine = new SimilarityEngine(null, { includeBody: true, maxResults: 1000 });
  const suggested = engine.scorePairs(notes);

  // Transform to the format used by link command
  return suggested.map(s => ({
    noteA: { file: s.a, dir: '', type: '' },
    noteB: { file: s.b, dir: '', type: '' },
    score: s.score,
    sharedTags: s.shared,
  }));
}

export function link(vaultRoot, { dryRun = false, threshold = 1.5, top = 10 } = {}) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);
  const notes = vault.scanNotes({ includeBody: true });
  const suggestions = scorePairs(notes).filter(s => s.score >= threshold);

  if (!suggestions.length) {
    console.log('No missing links found above threshold.');
    return { linked: 0, suggestions: [] };
  }

  if (dryRun) {
    console.log(`\nFound ${suggestions.length} potential link(s) (showing top ${Math.min(top, suggestions.length)}):\n`);
    console.log('| Note A | Note B | Score | Shared Tags |');
    console.log('|--------|--------|-------|-------------|');
    for (const s of suggestions.slice(0, top)) {
      console.log(`| [[${s.noteA.file}]] | [[${s.noteB.file}]] | ${s.score} | ${s.sharedTags.join(', ')} |`);
    }
    return { linked: 0, suggestions };
  }

  // Apply top N links
  let linked = 0;
  for (const s of suggestions.slice(0, top)) {
    const { noteA, noteB } = s;

    // Add B to A's related
    const contentA = vault.read(noteA.dir, `${noteA.file}.md`);
    if (contentA && !contentA.includes(`[[${noteB.file}]]`)) {
      const updated = contentA.replace(
        /^(related:)\s*\[(.*)]/m,
        (_, prefix, inner) => {
          const existing = inner.trim() ? `${inner}, ` : '';
          return `${prefix} [${existing}"[[${noteB.file}]]"]`;
        }
      ).replace(/^(updated:)\s*.*$/m, `$1 ${todayStr()}`);
      if (updated !== contentA) vault.write(noteA.dir, `${noteA.file}.md`, updated);
    }

    // Add A to B's related
    const contentB = vault.read(noteB.dir, `${noteB.file}.md`);
    if (contentB && !contentB.includes(`[[${noteA.file}]]`)) {
      const updated = contentB.replace(
        /^(related:)\s*\[(.*)]/m,
        (_, prefix, inner) => {
          const existing = inner.trim() ? `${inner}, ` : '';
          return `${prefix} [${existing}"[[${noteA.file}]]"]`;
        }
      ).replace(/^(updated:)\s*.*$/m, `$1 ${todayStr()}`);
      if (updated !== contentB) vault.write(noteB.dir, `${noteB.file}.md`, updated);
    }

    linked++;
  }

  idx.sync();
  console.log(`Created ${linked} bidirectional link(s) from ${suggestions.length} candidates`);
  return { linked, suggestions };
}
