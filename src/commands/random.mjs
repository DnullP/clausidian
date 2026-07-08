/**
 * random — pick random note(s) for serendipitous review
 */
import { Vault } from '../vault.mjs';

export function random(vaultRoot, { count = 1, type, status } = {}) {
  const vault = new Vault(vaultRoot);
  let notes = vault.scanNotes();

  if (type) notes = notes.filter(n => n.type === type);
  if (status) notes = notes.filter(n => n.status === status);
  // Exclude journals by default
  if (!type) notes = notes.filter(n => n.type !== 'journal');

  if (!notes.length) {
    console.log('No matching notes found.');
    return { notes: [] };
  }

  const picked = [];
  const available = [...notes];
  const n = Math.min(count, available.length);

  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * available.length);
    picked.push(available.splice(idx, 1)[0]);
  }

  console.log(`\n${picked.length} random note(s):\n`);
  for (const p of picked) {
    console.log(`  [[${p.file}]] (${p.type}) ${p.summary ? '— ' + p.summary : ''}`);
  }

  return { notes: picked };
}
