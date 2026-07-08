/**
 * focus — suggest what to work on next based on vault state
 *
 * Priority: pinned active projects > stale active projects >
 * recent ideas with no follow-up > orphan notes
 */
import { Vault } from '../vault.mjs';
import { todayStr } from '../dates.mjs';

export function focus(vaultRoot) {
  const vault = new Vault(vaultRoot);
  const notes = vault.scanNotes({ includeBody: true });
  const today = todayStr();
  const now = Date.now();
  const suggestions = [];

  // 1. Pinned active projects (highest priority)
  for (const n of notes) {
    if (n.type !== 'project' || n.status !== 'active') continue;
    const content = vault.read(n.dir, `${n.file}.md`);
    if (content && content.includes('pinned: true')) {
      const body = n.body || '';
      const todos = (body.match(/- \[ \]/g) || []).length;
      suggestions.push({
        priority: 1,
        reason: 'pinned project',
        file: n.file,
        type: n.type,
        summary: n.summary,
        pendingTodos: todos,
      });
    }
  }

  // 2. Active projects updated recently (momentum)
  const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
  for (const n of notes) {
    if (n.type !== 'project' || n.status !== 'active') continue;
    if (suggestions.some(s => s.file === n.file)) continue;
    if (n.updated >= sevenDaysAgo) {
      suggestions.push({
        priority: 2,
        reason: 'active project with momentum',
        file: n.file,
        type: n.type,
        summary: n.summary,
      });
    }
  }

  // 3. Stale active projects (need attention)
  const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString().slice(0, 10);
  for (const n of notes) {
    if (n.type !== 'project' || n.status !== 'active') continue;
    if (suggestions.some(s => s.file === n.file)) continue;
    if (n.updated < thirtyDaysAgo) {
      const days = Math.floor((now - new Date(n.updated)) / 86400000);
      suggestions.push({
        priority: 3,
        reason: `stale ${days} days — update or archive`,
        file: n.file,
        type: n.type,
        summary: n.summary,
      });
    }
  }

  // 4. Recent ideas worth exploring
  for (const n of notes) {
    if (n.type !== 'idea' || n.status !== 'draft') continue;
    if (n.updated >= sevenDaysAgo) {
      suggestions.push({
        priority: 4,
        reason: 'recent idea — worth exploring?',
        file: n.file,
        type: n.type,
        summary: n.summary,
      });
    }
  }

  suggestions.sort((a, b) => a.priority - b.priority);
  const top = suggestions.slice(0, 5);

  if (!top.length) {
    console.log('Nothing urgent. Vault is well-maintained.');
    return { suggestions: [] };
  }

  console.log(`\nFocus suggestions:\n`);
  for (const s of top) {
    const icon = s.priority <= 2 ? '>' : s.priority === 3 ? '!' : '*';
    console.log(`  ${icon} [[${s.file}]] — ${s.reason}`);
    if (s.summary) console.log(`    ${s.summary}`);
    if (s.pendingTodos) console.log(`    ${s.pendingTodos} pending TODO(s)`);
  }

  return { suggestions: top };
}
