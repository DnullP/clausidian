/**
 * orphans — find notes with no inbound links
 */
import { Vault } from '../vault.mjs';
import { formatTable } from '../table-formatter.mjs';

export function orphans(vaultRoot) {
  const vault = new Vault(vaultRoot);
  const results = vault.orphans();

  if (!results.length) {
    console.log('No orphan notes found.');
    return { results: [] };
  }

  console.log(`\n${results.length} orphan note(s) (no inbound links):\n`);
  console.log(formatTable(results, ['file', 'type', 'status', 'summary'], { wikilink: ['file'] }));

  return { results };
}
