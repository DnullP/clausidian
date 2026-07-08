/**
 * auto-tag — suggest TF-IDF based tags for notes with empty tags
 *
 * Supports --dry-run to preview suggestions without writing
 */
import { Vault } from '../vault.mjs';
import { IndexManager } from '../index-manager.mjs';
import { buildTagIDF, scoreRelatedness } from '../scoring.mjs';

export function autoTag(vaultRoot, options = {}) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);
  const dryRun = options.dryRun || options['dry-run'];

  try {
    const allNotes = vault.scanNotes({ includeBody: true });

    // Find notes with empty tags
    const untagged = allNotes.filter(n => n.type !== 'journal' && n.tags.length === 0);
    if (untagged.length === 0) {
      console.log('✓ All notes have tags assigned.');
      return { status: 'success', processed: 0, dryRun, suggestions: [] };
    }

    // Build tag IDF from all notes
    const tagIDF = buildTagIDF(allNotes, 'journal');

    // Get all tagged notes
    const tagged = allNotes.filter(t => t.type !== 'journal' && t.tags.length > 0);

    // Process each untagged note
    const suggestions = [];
    for (const untagNote of untagged) {
      const candidates = tagged.filter(t => t.file !== untagNote.file);
      const scored = candidates
        .map(c => ({ file: c.file, ...scoreRelatedness(untagNote, c, tagIDF) }))
        .filter(s => s.score >= 1.5)
        .sort((a, b) => b.score - a.score);

      // Extract top 3 tags from related notes
      const tagCounts = {};
      for (const s of scored.slice(0, 5)) {
        for (const tag of s.shared) {
          tagCounts[tag] = (tagCounts[tag] || 0) + s.score;
        }
      }

      const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag]) => `suggested-${tag}`);

      if (topTags.length > 0) {
        suggestions.push({
          file: untagNote.file,
          type: untagNote.type,
          suggestedTags: topTags,
        });

        if (!dryRun) {
          // Update note frontmatter with suggested tags
          const content = vault.read(untagNote.dir, `${untagNote.file}.md`);
          if (content) {
            const updated = content.replace(
              /tags:\s*\[\s*\]/,
              `tags: [${topTags.join(', ')}]`
            );
            if (updated !== content) {
              vault.write(untagNote.dir, `${untagNote.file}.md`, updated);
            }
          }
        }
      }
    }

    // Output results
    if (dryRun) {
      console.log(`📋 auto-tag 建議`);
      let index = 1;
      for (const s of suggestions) {
        console.log(`${index}. ${s.file}`);
        console.log(`   → ${s.suggestedTags.join(', ')}`);
        index++;
      }
      if (suggestions.length === 0) {
        console.log('(No tag suggestions found)');
      }
    }

    return {
      status: 'success',
      processed: suggestions.length,
      dryRun,
      suggestions,
    };
  } catch (err) {
    console.error(`[auto-tag error] ${err.message}`);
    return { status: 'error', error: err.message };
  }
}
