/**
 * broken-links — find [[wikilinks]] that point to non-existent notes
 */
import { Vault } from '../vault.mjs';

export function brokenLinks(vaultRoot) {
  const vault = new Vault(vaultRoot);
  const notes = vault.scanNotes({ includeBody: true });
  const allFiles = new Set(notes.map(n => n.file));
  const broken = [];

  for (const note of notes) {
    const content = `${note.related.map(r => `[[${r}]]`).join(' ')} ${note.body || ''}`;
    const links = content.match(/\[\[([^\]]+)\]\]/g) || [];
    for (const link of links) {
      const target = link.slice(2, -2);
      // Skip date-like links (journal nav)
      if (/^\d{4}-\d{2}-\d{2}$/.test(target)) continue;
      if (!allFiles.has(target)) {
        broken.push({ source: note.file, target, sourceDir: note.dir });
      }
    }
  }

  // Deduplicate
  const seen = new Set();
  const unique = broken.filter(b => {
    const key = `${b.source}→${b.target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!unique.length) {
    console.log('No broken links found.');
    return { broken: [] };
  }

  console.log(`\nFound ${unique.length} broken link(s):\n`);
  console.log('| Source | Broken Link |');
  console.log('|--------|-------------|');
  for (const b of unique) {
    console.log(`| [[${b.source}]] | [[${b.target}]] |`);
  }

  return { broken: unique };
}
