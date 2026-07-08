/**
 * count — vault word/line/note count statistics
 */
import { Vault } from '../vault.mjs';

export function count(vaultRoot, { type } = {}) {
  const vault = new Vault(vaultRoot);
  const notes = vault.scanNotes({ includeBody: true });

  let filtered = notes;
  if (type) filtered = notes.filter(n => n.type === type);

  let totalWords = 0;
  let totalLines = 0;
  const byType = {};

  for (const n of filtered) {
    const body = n.body || '';
    const words = body.split(/\s+/).filter(Boolean).length;
    const lines = body.split('\n').length;
    totalWords += words;
    totalLines += lines;

    if (!byType[n.type]) byType[n.type] = { notes: 0, words: 0, lines: 0 };
    byType[n.type].notes++;
    byType[n.type].words += words;
    byType[n.type].lines += lines;
  }

  console.log(`\nVault Word Count\n`);
  console.log(`Total: ${filtered.length} notes, ${totalWords.toLocaleString()} words, ${totalLines.toLocaleString()} lines\n`);
  console.log('| Type | Notes | Words | Lines | Avg Words/Note |');
  console.log('|------|-------|-------|-------|----------------|');
  for (const [t, s] of Object.entries(byType).sort((a, b) => b[1].words - a[1].words)) {
    const avg = s.notes ? Math.round(s.words / s.notes) : 0;
    console.log(`| ${t} | ${s.notes} | ${s.words.toLocaleString()} | ${s.lines.toLocaleString()} | ${avg} |`);
  }

  return { total: { notes: filtered.length, words: totalWords, lines: totalLines }, byType };
}
