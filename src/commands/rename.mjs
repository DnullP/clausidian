/**
 * rename — rename a note and update all references across the vault
 */
import { renameSync } from 'fs';
import { Vault } from '../vault.mjs';
import { IndexManager } from '../index-manager.mjs';
import { todayStr } from '../dates.mjs';
import { updateFrontmatter } from '../frontmatter-helper.mjs';
import { NoteNotFoundError } from '../errors.mjs';

export function rename(vaultRoot, noteName, newTitle) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);

  if (!noteName || !newTitle) {
    throw new Error('Usage: clausidian rename <note-name> <new-title>');
  }

  const note = vault.findNote(noteName);
  if (!note) {
    throw new NoteNotFoundError(noteName);
  }

  const newFile = newTitle.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/(^-|-$)/g, '');
  if (newFile === note.file) {
    console.log('Note already has this name.');
    return { status: 'unchanged', file: `${note.dir}/${note.file}.md` };
  }

  if (vault.exists(note.dir, `${newFile}.md`)) {
    throw new Error(`A note named "${newFile}" already exists in ${note.dir}/`);
  }

  const oldPath = vault.path(note.dir, `${note.file}.md`);
  const newPath = vault.path(note.dir, `${newFile}.md`);

  // Update title and filename in the note itself
  let content = vault.read(note.dir, `${note.file}.md`);
  content = updateFrontmatter(content, { title: newTitle, updated: todayStr() });
  vault.write(note.dir, `${note.file}.md`, content);

  // Rename the file
  renameSync(oldPath, newPath);
  vault.invalidateCache();

  // Update all references in other notes
  const notes = vault.scanNotes({ includeBody: true });
  let updated = 0;
  for (const other of notes) {
    if (other.file === newFile) continue;
    const otherPath = `${other.dir}/${other.file}.md`;
    let otherContent = vault.read(otherPath);
    if (!otherContent) continue;

    const oldRef = `[[${note.file}]]`;
    const newRef = `[[${newFile}]]`;
    if (!otherContent.includes(oldRef)) continue;

    otherContent = otherContent.replaceAll(oldRef, newRef);
    otherContent = updateFrontmatter(otherContent, { updated: todayStr() });
    vault.write(otherPath, otherContent);
    updated++;
  }

  idx.sync();

  console.log(`Renamed ${note.dir}/${note.file}.md → ${note.dir}/${newFile}.md (${updated} reference(s) updated)`);
  return { status: 'renamed', from: `${note.dir}/${note.file}.md`, to: `${note.dir}/${newFile}.md`, refsUpdated: updated };
}
