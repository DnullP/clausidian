/**
 * stats — vault statistics
 */
import { Vault } from '../vault.mjs';

export function stats(vaultRoot) {
  const vault = new Vault(vaultRoot);
  const s = vault.stats();

  console.log(`\nVault Statistics\n`);
  console.log(`Total notes: ${s.total}`);

  console.log(`\nBy type:`);
  for (const [type, count] of Object.entries(s.byType).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${count}`);
  }

  console.log(`\nBy status:`);
  for (const [status, count] of Object.entries(s.byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status}: ${count}`);
  }

  console.log(`\nTop tags:`);
  const sortedTags = Object.entries(s.byTag).sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [tag, count] of sortedTags) {
    console.log(`  ${tag}: ${count}`);
  }

  console.log(`\nOrphan notes: ${s.orphans}`);

  return s;
}
