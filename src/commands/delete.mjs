/**
 * delete — remove a note and clean up references
 */
import { unlinkSync } from 'fs';
import { Vault } from '../vault.mjs';
import { IndexManager } from '../index-manager.mjs';
import { todayStr } from '../dates.mjs';

export function deleteNote(vaultRoot, noteName) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);

  if (!noteName) {
    throw new Error('Usage: clausidian delete <note-name>');
  }

  const note = vault.findNote(noteName);
  if (!note) {
    throw new Error(`Note not found: ${noteName}`);
  }

  const filePath = vault.path(note.dir, `${note.file}.md`);
  const notes = vault.scanNotes();

  // Clean up references in other notes
  let cleaned = 0;
  for (const other of notes) {
    if (other.file === noteName) continue;
    if (!other.related.includes(noteName)) continue;

    const otherPath = `${other.dir}/${other.file}.md`;
    let content = vault.read(otherPath);
    if (!content) continue;

    // Remove from related array
    const newRelated = other.related.filter(r => r !== noteName);
    const relatedStr = newRelated.length
      ? `[${newRelated.map(r => `"[[${r}]]"`).join(', ')}]`
      : '[]';
    content = content.replace(/related: \[.*\]/, `related: ${relatedStr}`);
    content = content.replace(/updated: "\d{4}-\d{2}-\d{2}"/, `updated: "${todayStr()}"`);
    vault.write(otherPath, content);
    cleaned++;
  }

  // Delete the file
  unlinkSync(filePath);
  vault.invalidateCache();

  // Rebuild indices
  idx.sync();

  console.log(`Deleted ${note.dir}/${note.file}.md (cleaned ${cleaned} reference(s))`);
  return { status: 'deleted', file: `${note.dir}/${note.file}.md`, cleaned };
}
