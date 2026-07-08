/**
 * stale — detect notes inactive for N days (default 30)
 *
 * Reuses logic from daily.mjs
 * Supports --threshold N and --auto-archive
 */
import { Vault } from '../vault.mjs';

export function stale(vaultRoot, options = {}) {
  const vault = new Vault(vaultRoot);
  const threshold = options.threshold ? parseInt(options.threshold) : 30;
  const autoArchive = options['auto-archive'] || options.autoArchive;

  try {
    const notes = vault.scanNotes();
    const now = Date.now();

    // Find stale notes: active status + more than threshold days since update
    const staleNotes = notes.filter(n => {
      if (n.status !== 'active' || n.type === 'journal') return false;
      const daysOld = (now - new Date(n.updated)) / 86400000;
      return daysOld > threshold;
    })
      .map(n => ({
        file: n.file,
        type: n.type,
        updated: n.updated,
        daysOld: Math.floor((now - new Date(n.updated)) / 86400000),
      }))
      .sort((a, b) => b.daysOld - a.daysOld);

    if (staleNotes.length === 0) {
      console.log(`✓ No stale notes (threshold: ${threshold} days)`);
      return { status: 'success', count: 0, threshold, notes: [] };
    }

    // Display results
    console.log(`📊 過期筆記（${threshold} 天以上未更新）\n`);
    for (const note of staleNotes) {
      console.log(`${note.file} [${note.type}] | 最後更新: ${note.updated} | ${note.daysOld} 天`);
    }

    // Archive if requested
    let archived = 0;
    if (autoArchive) {
      console.log(`Archiving ${staleNotes.length} notes...`);
      for (const note of staleNotes) {
        const content = vault.read(note.type, `${note.file}.md`);
        if (content) {
          const updated = content.replace(/status:\s*active/, 'status: archived');
          vault.write(note.type, `${note.file}.md`, updated);
          archived++;
        }
      }
      console.log(`✓ Archived ${archived} note(s)`);
    }

    return {
      status: 'success',
      count: staleNotes.length,
      threshold,
      archived,
      notes: staleNotes,
    };
  } catch (err) {
    console.error(`[stale error] ${err.message}`);
    return { status: 'error', error: err.message };
  }
}
