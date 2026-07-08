/**
 * duplicates — find potentially duplicate or very similar notes
 */
import { Vault } from '../vault.mjs';

function tokenize(text) {
  return text.toLowerCase().split(/[\s\-_/]+/).filter(w => w.length > 2);
}

function similarity(a, b) {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let overlap = 0;
  for (const w of setA) if (setB.has(w)) overlap++;
  return overlap / Math.max(setA.size, setB.size);
}

export function duplicates(vaultRoot, { threshold = 0.5 } = {}) {
  const vault = new Vault(vaultRoot);
  const notes = vault.scanNotes({ includeBody: true });
  const pairs = [];

  for (let i = 0; i < notes.length; i++) {
    const a = notes[i];
    const tokensA = tokenize(`${a.title} ${a.summary} ${(a.body || '').slice(0, 500)}`);
    for (let j = i + 1; j < notes.length; j++) {
      const b = notes[j];
      // Skip journal pairs
      if (a.type === 'journal' && b.type === 'journal') continue;

      const tokensB = tokenize(`${b.title} ${b.summary} ${(b.body || '').slice(0, 500)}`);
      const sim = similarity(tokensA, tokensB);
      if (sim >= threshold) {
        pairs.push({
          noteA: { file: a.file, type: a.type, title: a.title },
          noteB: { file: b.file, type: b.type, title: b.title },
          similarity: Math.round(sim * 100),
        });
      }
    }
  }

  pairs.sort((a, b) => b.similarity - a.similarity);

  if (!pairs.length) {
    console.log('No duplicate candidates found.');
    return { pairs: [] };
  }

  console.log(`\nFound ${pairs.length} potential duplicate pair(s):\n`);
  console.log('| Note A | Note B | Similarity |');
  console.log('|--------|--------|------------|');
  for (const p of pairs) {
    console.log(`| [[${p.noteA.file}]] (${p.noteA.type}) | [[${p.noteB.file}]] (${p.noteB.type}) | ${p.similarity}% |`);
  }

  return { pairs };
}
