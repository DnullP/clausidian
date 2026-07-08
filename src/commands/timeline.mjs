/**
 * timeline — show chronological activity feed
 */
import { Vault } from '../vault.mjs';

export function timeline(vaultRoot, { days = 30, type, limit = 50 } = {}) {
  const vault = new Vault(vaultRoot);
  const notes = vault.scanNotes();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  let filtered = notes.filter(n => n.updated >= cutoffStr || n.created >= cutoffStr);
  if (type) filtered = filtered.filter(n => n.type === type);

  // Build timeline entries
  const entries = [];
  for (const n of filtered) {
    if (n.created >= cutoffStr) {
      entries.push({ date: n.created, action: 'created', file: n.file, type: n.type, summary: n.summary });
    }
    if (n.updated !== n.created && n.updated >= cutoffStr) {
      entries.push({ date: n.updated, action: 'updated', file: n.file, type: n.type, summary: n.summary });
    }
  }

  entries.sort((a, b) => b.date.localeCompare(a.date));
  const limited = entries.slice(0, limit);

  if (!limited.length) {
    console.log(`No activity in the last ${days} day(s).`);
    return { entries: [] };
  }

  console.log(`\nTimeline (last ${days} days, ${limited.length} events):\n`);

  let lastDate = '';
  for (const e of limited) {
    if (e.date !== lastDate) {
      console.log(`\n### ${e.date}`);
      lastDate = e.date;
    }
    const icon = e.action === 'created' ? '+' : '~';
    console.log(`  ${icon} [[${e.file}]] (${e.type}) ${e.summary ? '— ' + e.summary : ''}`);
  }

  return { entries: limited, total: entries.length };
}
