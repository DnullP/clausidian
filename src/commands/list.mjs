/**
 * list — list notes with filtering
 */
import { Vault } from '../vault.mjs';
import { filterRecentNotes } from '../dates.mjs';
import { formatTable } from '../table-formatter.mjs';

export function list(vaultRoot, { type, tag, status, recent } = {}) {
  const vault = new Vault(vaultRoot);
  let notes = vault.scanNotes();

  // Filters
  if (type) notes = notes.filter(n => n.type === type);
  if (tag) notes = notes.filter(n => n.tags.includes(tag));
  if (status) {
    notes = notes.filter(n => n.status === status);
  } else {
    notes = notes.filter(n => n.status !== 'archived');
  }
  if (recent) {
    notes = filterRecentNotes(notes, recent);
  }

  // Sort by updated desc
  notes.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));

  if (!notes.length) {
    console.log('No notes found.');
    return { notes: [] };
  }

  console.log(`\n${notes.length} note(s):\n`);
  console.log(formatTable(notes, ['file', 'title', 'type', 'status', 'summary', 'updated'], { wikilink: ['file'] }));

  // Stats
  const types = {};
  for (const n of notes) types[n.type] = (types[n.type] || 0) + 1;
  console.log(`\nBy type: ${Object.entries(types).map(([t, c]) => `${t}(${c})`).join(', ')}`);

  return { notes };
}
