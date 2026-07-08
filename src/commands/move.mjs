/**
 * move — move a note to a different type/directory
 */
import { renameSync } from 'fs';
import { Vault } from '../vault.mjs';
import { IndexManager } from '../index-manager.mjs';
import { todayStr } from '../dates.mjs';

export function move(vaultRoot, noteName, newType) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);

  if (!noteName || !newType) {
    throw new Error('Usage: clausidian move <note-name> <new-type>');
  }

  const validTypes = ['area', 'project', 'resource', 'idea'];
  if (!validTypes.includes(newType)) {
    throw new Error(`Invalid type: ${newType}. Must be one of: ${validTypes.join(', ')}`);
  }

  const note = vault.findNote(noteName);
  if (!note) {
    throw new Error(`Note not found: ${noteName}`);
  }

  const newDir = vault.typeDir(newType);
  if (note.dir === newDir) {
    console.log(`Note is already in ${newDir}/`);
    return { status: 'unchanged', file: `${note.dir}/${note.file}.md` };
  }

  if (vault.exists(newDir, `${note.file}.md`)) {
    throw new Error(`A note named "${note.file}" already exists in ${newDir}/`);
  }

  // Update type in frontmatter
  let content = vault.read(note.dir, `${note.file}.md`);
  content = content.replace(/^(type:)\s*.*$/m, `$1 ${newType}`);
  content = content.replace(/^(updated:)\s*.*$/m, `$1 "${todayStr()}"`);
  vault.write(note.dir, `${note.file}.md`, content);

  // Move the file
  const oldPath = vault.path(note.dir, `${note.file}.md`);
  const newPath = vault.path(newDir, `${note.file}.md`);
  renameSync(oldPath, newPath);
  vault.invalidateCache();
  idx.sync();

  console.log(`Moved ${note.dir}/${note.file}.md → ${newDir}/${note.file}.md (type: ${newType})`);
  return { status: 'moved', from: `${note.dir}/${note.file}.md`, to: `${newDir}/${note.file}.md`, newType };
}
