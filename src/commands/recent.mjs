/**
 * recent — show recently updated notes
 */
import { Vault } from '../vault.mjs';
import { filterRecentNotes } from '../dates.mjs';
import { formatTable } from '../table-formatter.mjs';

export function recent(vaultRoot, { days = 7 } = {}) {
  const vault = new Vault(vaultRoot);
  const notes = vault.scanNotes();

  const recentNotes = filterRecentNotes(notes, days)
    .sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));

  if (!recentNotes.length) {
    console.log(`No notes updated in the last ${days} day(s).`);
    return { notes: [], days };
  }

  console.log(`\n${recentNotes.length} note(s) updated in the last ${days} day(s):\n`);
  console.log(formatTable(recentNotes, ['file', 'type', 'updated', 'summary'], { wikilink: ['file'] }));

  return { notes: recentNotes, days };
}
