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
import { unlinkSync } from 'fs';

function filterNotes(vault, { type, tag, status }) {
  const notes = vault.scanNotes();
  return notes.filter(n => {
    if (type && n.type !== type) return false;
    if (tag && !n.tags.includes(tag)) return false;
    if (status && n.status !== status) return false;
    return true;
  });
}

export function batchUpdate(vaultRoot, { type, tag, status, setStatus, setSummary, ...rest }) {
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

  // Pass through all set_* fields (set_aliases, set_maturity, set_related, etc.)
  for (const [key, val] of Object.entries(rest)) {
    if (!val) continue;
    const field = key.startsWith('set_') ? key.slice(4) : key;
    // Parse string values that look like JSON arrays/objects
    if (typeof val === 'string') {
      if ((val.startsWith('[') || val.startsWith('{')) && (val.endsWith(']') || val.endsWith('}'))) {
        try { updates[field] = JSON.parse(val); } catch { updates[field] = val; }
      } else {
        updates[field] = val;
      }
    } else {
      updates[field] = val;
    }
  }

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

export function batchDelete(vaultRoot, { type, tag, status, dryRun }) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);
  const notes = filterNotes(vault, { type, tag, status });

  if (!notes.length) {
    console.log('No matching notes found.');
    return { deleted: 0 };
  }

  if (dryRun) {
    console.log(`[DRY RUN] Would delete ${notes.length} note(s):`);
    for (const note of notes) {
      console.log(`  ${note.dir}/${note.file}.md`);
    }
    return { deleted: 0, dryRun: true, wouldDelete: notes.length, files: notes.map(n => `${n.dir}/${n.file}.md`) };
  }

  const deleted = [];
  for (const note of notes) {
    const filePath = vault.path(note.dir, `${note.file}.md`);
    unlinkSync(filePath);
    deleted.push(`${note.dir}/${note.file}.md`);
  }

  vault.invalidateCache();
  idx.sync();
  console.log(`Deleted ${deleted.length} note(s)`);
  return { deleted: deleted.length, files: deleted };
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
