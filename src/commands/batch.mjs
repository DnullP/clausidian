/**
 * batch — batch operations on multiple notes
 *
 * Subcommands:
 *   batch update --type <type> --status <status>    Update all matching notes
 *   batch tag --type <type> --add <tag>             Add tag to matching notes
 *   batch tag --type <type> --remove <tag>          Remove tag from matching notes
 *   batch archive --type <type>                     Archive all matching notes
 */
import { Vault } from '../vault.mjs';
import { IndexManager } from '../index-manager.mjs';
import { todayStr } from '../dates.mjs';

function filterNotes(vault, { type, tag, status }) {
  const notes = vault.scanNotes();
  return notes.filter(n => {
    if (type && n.type !== type) return false;
    if (tag && !n.tags.includes(tag)) return false;
    if (status && n.status !== status) return false;
    return true;
  });
}

export function batchUpdate(vaultRoot, { type, tag, status, setStatus, setSummary }) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);
  const notes = filterNotes(vault, { type, tag, status });

  if (!notes.length) {
    console.log('No matching notes found.');
    return { updated: 0 };
  }

  const updates = { updated: todayStr() };
  if (setStatus) updates.status = setStatus;
  if (setSummary) updates.summary = setSummary;

  let count = 0;
  for (const note of notes) {
    vault.updateNote(note.dir, note.file, updates);
    count++;
  }

  idx.rebuildTags();
  console.log(`Updated ${count} note(s)`);
  return { updated: count, changes: updates };
}

export function batchTag(vaultRoot, { type, tag, status, add, remove }) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);
  const notes = filterNotes(vault, { type, tag, status });

  if (!notes.length) {
    console.log('No matching notes found.');
    return { updated: 0 };
  }

  let count = 0;
  for (const note of notes) {
    let newTags = [...note.tags];
    if (add && !newTags.includes(add)) newTags.push(add);
    if (remove) newTags = newTags.filter(t => t !== remove);
    if (newTags.join(',') !== note.tags.join(',')) {
      vault.updateNote(note.dir, note.file, { tags: newTags, updated: todayStr() });
      count++;
    }
  }

  idx.rebuildTags();
  const action = add ? `added "${add}"` : `removed "${remove}"`;
  console.log(`${action} — ${count} note(s) changed`);
  return { updated: count, action };
}

export function batchArchive(vaultRoot, { type, tag, status }) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);
  const notes = filterNotes(vault, { type, tag, status }).filter(n => n.status !== 'archived');

  if (!notes.length) {
    console.log('No matching notes to archive.');
    return { archived: 0 };
  }

  for (const note of notes) {
    vault.updateNote(note.dir, note.file, { status: 'archived', updated: todayStr() });
  }

  idx.rebuildTags();
  console.log(`Archived ${notes.length} note(s)`);
  return { archived: notes.length };
}
