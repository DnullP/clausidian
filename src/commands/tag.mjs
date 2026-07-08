/**
 * tag — tag management (rename, list, merge)
 */
import { Vault } from '../vault.mjs';
import { IndexManager } from '../index-manager.mjs';
import { todayStr } from '../dates.mjs';
import { formatTable } from '../table-formatter.mjs';

export function tagRename(vaultRoot, oldTag, newTag) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);

  if (!oldTag || !newTag) {
    throw new Error('Usage: clausidian tag rename <old-tag> <new-tag>');
  }

  const notes = vault.scanNotes();
  let count = 0;

  for (const note of notes) {
    if (!note.tags.includes(oldTag)) continue;
    const newTags = note.tags.map(t => t === oldTag ? newTag : t);
    vault.updateNote(note.dir, note.file, {
      tags: newTags,
      updated: todayStr(),
    });
    count++;
  }

  idx.rebuildTags();

  if (count === 0) {
    console.log(`No notes found with tag "${oldTag}"`);
  } else {
    console.log(`Renamed tag "${oldTag}" → "${newTag}" in ${count} note(s)`);
  }
  return { renamed: count, from: oldTag, to: newTag };
}

export function tagList(vaultRoot) {
  const vault = new Vault(vaultRoot);
  const notes = vault.scanNotes();
  const tagMap = {};
  for (const n of notes) {
    for (const t of n.tags) tagMap[t] = (tagMap[t] || 0) + 1;
  }

  const sorted = Object.entries(tagMap).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    console.log('No tags found.');
    return { tags: {} };
  }

  console.log(`\n${sorted.length} tag(s):\n`);
  console.log(formatTable(sorted.map(([tag, count]) => ({ tag, count })), ['tag', 'count']));

  return { tags: tagMap };
}
