/**
 * daily — one-command daily dashboard
 *
 * Shows: today's journal status, recent activity, pinned notes,
 * pending suggestions, and vault health grade.
 */
import { Vault } from '../vault.mjs';
import { todayStr } from '../dates.mjs';

export function daily(vaultRoot) {
  const vault = new Vault(vaultRoot);
  const today = todayStr();
  const notes = vault.scanNotes();

  // Journal status
  const journalExists = vault.exists('journal', `${today}.md`);

  // Recent activity (last 24h)
  const recentNotes = notes.filter(n => n.updated === today);

  // Pinned notes
  const pinned = [];
  for (const note of notes) {
    const content = vault.read(note.dir, `${note.file}.md`);
    if (content && content.includes('pinned: true')) {
      pinned.push(note);
    }
  }

  // Active projects
  const activeProjects = notes.filter(n => n.type === 'project' && n.status === 'active');

  // Quick stats
  const total = notes.length;
  const byStatus = {};
  for (const n of notes) byStatus[n.status] = (byStatus[n.status] || 0) + 1;

  // Stale count
  const now = Date.now();
  const staleCount = notes.filter(n => {
    if (n.status !== 'active' || n.type === 'journal') return false;
    return (now - new Date(n.updated)) / 86400000 > 30;
  }).length;

  console.log(`\n=== Daily Dashboard (${today}) ===\n`);

  // Journal
  console.log(`Journal: ${journalExists ? 'exists' : 'not yet created'}`);
  if (!journalExists) console.log(`  → clausidian journal`);

  // Today's activity
  console.log(`\nToday: ${recentNotes.length} note(s) updated`);
  for (const n of recentNotes.slice(0, 5)) {
    console.log(`  ~ [[${n.file}]] (${n.type})`);
  }
  if (recentNotes.length > 5) console.log(`  ... and ${recentNotes.length - 5} more`);

  // Pinned
  if (pinned.length) {
    console.log(`\nPinned (${pinned.length}):`);
    for (const p of pinned) {
      console.log(`  * [[${p.file}]] — ${p.summary || p.title}`);
    }
  }

  // Active projects
  if (activeProjects.length) {
    console.log(`\nActive Projects (${activeProjects.length}):`);
    for (const p of activeProjects) {
      console.log(`  > [[${p.file}]] — ${p.summary || p.title}`);
    }
  }

  // Quick stats
  console.log(`\nVault: ${total} notes | active: ${byStatus.active || 0} | draft: ${byStatus.draft || 0} | archived: ${byStatus.archived || 0}`);
  if (staleCount > 0) console.log(`  ! ${staleCount} stale note(s) (>30 days)`);

  return {
    date: today,
    journalExists,
    todayUpdated: recentNotes.length,
    pinned: pinned.length,
    activeProjects: activeProjects.length,
    total,
    stale: staleCount,
  };
}
