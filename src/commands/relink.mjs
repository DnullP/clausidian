/**
 * relink — fix broken links by finding closest matching notes
 */
import { Vault } from '../vault.mjs';
import { IndexManager } from '../index-manager.mjs';
import { todayStr } from '../dates.mjs';

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + (a[i-1] !== b[j-1] ? 1 : 0));
  return dp[m][n];
}

export function relink(vaultRoot, { dryRun = false } = {}) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);
  const notes = vault.scanNotes({ includeBody: true });
  const allFiles = new Set(notes.map(n => n.file));
  const fixes = [];

  for (const note of notes) {
    const content = `${note.related.map(r => `[[${r}]]`).join(' ')} ${note.body || ''}`;
    const links = content.match(/\[\[([^\]]+)\]\]/g) || [];

    for (const link of links) {
      const target = link.slice(2, -2);
      if (/^\d{4}-\d{2}-\d{2}$/.test(target)) continue;
      if (allFiles.has(target)) continue;

      // Find closest match
      let bestMatch = null;
      let bestDist = Infinity;
      for (const file of allFiles) {
        const dist = levenshtein(target.toLowerCase(), file.toLowerCase());
        if (dist < bestDist && dist <= Math.max(3, target.length * 0.4)) {
          bestDist = dist;
          bestMatch = file;
        }
      }

      if (bestMatch) {
        fixes.push({
          source: note.file,
          sourceDir: note.dir,
          broken: target,
          suggestion: bestMatch,
          distance: bestDist,
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set();
  const unique = fixes.filter(f => {
    const key = `${f.source}:${f.broken}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!unique.length) {
    console.log('No broken links to fix.');
    return { fixed: 0, fixes: [] };
  }

  if (dryRun) {
    console.log(`\nFound ${unique.length} fixable broken link(s):\n`);
    console.log('| Source | Broken | Suggested Fix |');
    console.log('|--------|--------|---------------|');
    for (const f of unique) {
      console.log(`| [[${f.source}]] | [[${f.broken}]] | [[${f.suggestion}]] |`);
    }
    return { fixed: 0, fixes: unique };
  }

  // Apply fixes
  let fixed = 0;
  const bySource = {};
  for (const f of unique) {
    if (!bySource[f.source]) bySource[f.source] = [];
    bySource[f.source].push(f);
  }

  for (const [source, sourceFixes] of Object.entries(bySource)) {
    const note = notes.find(n => n.file === source);
    if (!note) continue;
    let content = vault.read(note.dir, `${note.file}.md`);
    if (!content) continue;

    for (const fix of sourceFixes) {
      content = content.replaceAll(`[[${fix.broken}]]`, `[[${fix.suggestion}]]`);
      fixed++;
    }
    content = content.replace(/^(updated:)\s*.*$/m, `$1 "${todayStr()}"`);
    vault.write(note.dir, `${note.file}.md`, content);
  }

  idx.sync();
  console.log(`Fixed ${fixed} broken link(s)`);
  return { fixed, fixes: unique };
}
