/**
 * agenda — extract pending TODO items from journals and project notes
 */
import { Vault } from '../vault.mjs';
import { todayStr } from '../dates.mjs';

export function agenda(vaultRoot, { days = 7, all = false } = {}) {
  const vault = new Vault(vaultRoot);
  // Always load body to find TODO items
  const notes = vault.scanNotes({ includeBody: true });
  const today = todayStr();
  const items = [];

  // Scan journals for unchecked TODOs
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  for (const note of notes) {
    if (!all && note.type === 'journal' && note.updated < cutoffStr) continue;
    const body = note.body || '';
    const lines = body.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- [ ]')) {
        items.push({
          task: trimmed.replace('- [ ] ', ''),
          source: note.file,
          type: note.type,
          date: note.updated,
        });
      }
    }
  }

  // Sort: journal items by date (newest first), then project items
  items.sort((a, b) => {
    if (a.type === 'journal' && b.type !== 'journal') return -1;
    if (a.type !== 'journal' && b.type === 'journal') return 1;
    return b.date.localeCompare(a.date);
  });

  if (!items.length) {
    console.log('No pending tasks found.');
    return { items: [] };
  }

  console.log(`\n${items.length} pending task(s):\n`);

  let lastSource = '';
  for (const item of items) {
    if (item.source !== lastSource) {
      console.log(`\n[[${item.source}]] (${item.type}):`);
      lastSource = item.source;
    }
    console.log(`  - [ ] ${item.task}`);
  }

  return { items, total: items.length };
}
