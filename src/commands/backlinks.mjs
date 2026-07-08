/**
 * backlinks — show notes that link to a given note
 */
import { Vault } from '../vault.mjs';
import { formatTable } from '../table-formatter.mjs';

export function backlinks(vaultRoot, noteName) {
  const vault = new Vault(vaultRoot);

  if (!noteName) {
    throw new Error('Usage: clausidian backlinks <note-name>');
  }

  const results = vault.backlinks(noteName);

  if (!results.length) {
    console.log(`No backlinks found for "${noteName}"`);
    return { results: [] };
  }

  console.log(`\n${results.length} note(s) link to [[${noteName}]]:\n`);
  console.log(formatTable(results, ['file', 'type', 'summary'], { wikilink: ['file'] }));

  return { results };
}
