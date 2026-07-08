/**
 * suggest — AI-friendly vault improvement suggestions
 *
 * Analyzes vault state and returns actionable suggestions:
 * - Orphan notes that should be linked
 * - Stale notes that need updating
 * - Tags that could be consolidated
 * - Notes missing summaries
 * - Broken links to fix
 */
import { Vault } from '../vault.mjs';

export function suggest(vaultRoot, { limit = 10 } = {}) {
  const vault = new Vault(vaultRoot);
  const notes = vault.scanNotes({ includeBody: true });
  const allFiles = new Set(notes.map(n => n.file));
  const suggestions = [];

  // 1. Orphan notes (non-journal, no inbound links)
  const linked = new Set();
  for (const n of notes) {
    for (const rel of n.related) linked.add(rel);
    const wikilinks = (n.body || '').match(/\[\[([^\]]+)\]\]/g) || [];
    for (const wl of wikilinks) linked.add(wl.slice(2, -2));
  }
  const orphans = notes.filter(n => !linked.has(n.file) && n.type !== 'journal');
  for (const o of orphans.slice(0, 3)) {
    suggestions.push({
      type: 'orphan',
      priority: 'medium',
      note: o.file,
      action: `Link [[${o.file}]] to related notes or archive it`,
      command: `clausidian link`,
    });
  }

  // 2. Stale active notes (>30 days old)
  const now = Date.now();
  const stale = notes.filter(n => {
    if (n.status !== 'active' || n.type === 'journal') return false;
    const updated = new Date(n.updated);
    return (now - updated) / 86400000 > 30;
  }).sort((a, b) => a.updated.localeCompare(b.updated));
  for (const s of stale.slice(0, 3)) {
    const days = Math.floor((now - new Date(s.updated)) / 86400000);
    suggestions.push({
      type: 'stale',
      priority: 'low',
      note: s.file,
      action: `Update or archive [[${s.file}]] (${days} days stale)`,
      command: `clausidian update "${s.file}" --summary "..."`,
    });
  }

  // 3. Missing summaries (non-journal)
  const noSummary = notes.filter(n => !n.summary && n.type !== 'journal' && n.status !== 'archived');
  if (noSummary.length > 0) {
    suggestions.push({
      type: 'missing_summary',
      priority: 'medium',
      note: noSummary.map(n => n.file).slice(0, 5).join(', '),
      action: `${noSummary.length} note(s) missing summaries — summaries improve search quality`,
      command: `clausidian update "<note>" --summary "..."`,
    });
  }

  // 4. No tags (non-journal)
  const noTags = notes.filter(n => n.tags.length === 0 && n.type !== 'journal' && n.status !== 'archived');
  if (noTags.length > 0) {
    suggestions.push({
      type: 'missing_tags',
      priority: 'low',
      note: noTags.map(n => n.file).slice(0, 5).join(', '),
      action: `${noTags.length} note(s) have no tags`,
      command: `clausidian batch tag --add "<tag>"`,
    });
  }

  // 5. Tag consolidation (similar tags)
  const tagMap = {};
  for (const n of notes) for (const t of n.tags) tagMap[t] = (tagMap[t] || 0) + 1;
  const tags = Object.keys(tagMap);
  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) {
      const a = tags[i], b = tags[j];
      // Check if one is singular/plural of the other
      if (a + 's' === b || b + 's' === a || a.replace(/-/g, '') === b.replace(/-/g, '')) {
        suggestions.push({
          type: 'tag_consolidation',
          priority: 'low',
          note: `${a} (${tagMap[a]}) / ${b} (${tagMap[b]})`,
          action: `Consider merging tags "${a}" and "${b}"`,
          command: `clausidian tag rename "${tagMap[a] < tagMap[b] ? a : b}" "${tagMap[a] >= tagMap[b] ? a : b}"`,
        });
      }
    }
  }

  // 6. Broken links
  let brokenCount = 0;
  for (const note of notes) {
    const content = `${note.related.map(r => `[[${r}]]`).join(' ')} ${note.body || ''}`;
    const links = content.match(/\[\[([^\]]+)\]\]/g) || [];
    for (const link of links) {
      const target = link.slice(2, -2);
      if (/^\d{4}-\d{2}-\d{2}$/.test(target)) continue;
      if (!allFiles.has(target)) brokenCount++;
    }
  }
  if (brokenCount > 0) {
    suggestions.push({
      type: 'broken_links',
      priority: 'high',
      note: '',
      action: `${brokenCount} broken link(s) found`,
      command: `clausidian relink`,
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  const limited = suggestions.slice(0, limit);

  if (!limited.length) {
    console.log('Vault looks great! No suggestions.');
    return { suggestions: [] };
  }

  console.log(`\n${limited.length} suggestion(s):\n`);
  for (const s of limited) {
    const icon = s.priority === 'high' ? '!' : s.priority === 'medium' ? '*' : '-';
    console.log(`  ${icon} [${s.type}] ${s.action}`);
    if (s.command) console.log(`    → ${s.command}`);
  }

  return { suggestions: limited };
}
