/**
 * pin / unpin — mark notes as pinned (favorites)
 * list pinned — show all pinned notes
 */
import { Vault } from '../vault.mjs';
import { todayStr } from '../dates.mjs';

export function pin(vaultRoot, noteName) {
  const vault = new Vault(vaultRoot);

  if (!noteName) {
    throw new Error('Usage: clausidian pin <note-name>');
  }

  const note = vault.findNote(noteName);
  if (!note) throw new Error(`Note not found: ${noteName}`);

  const filePath = `${note.dir}/${note.file}.md`;
  let content = vault.read(filePath);

  if (content.includes('pinned: true')) {
    console.log(`Already pinned: ${note.file}`);
    return { status: 'already_pinned', file: filePath };
  }

  // Add pinned field after status line
  if (content.match(/^pinned:/m)) {
    content = content.replace(/^pinned:.*$/m, 'pinned: true');
  } else {
    content = content.replace(/^(status:.*$)/m, '$1\npinned: true');
  }
  content = content.replace(/^(updated:)\s*.*$/m, `$1 "${todayStr()}"`);

  vault.write(filePath, content);
  console.log(`Pinned: ${note.file}`);
  return { status: 'pinned', file: filePath };
}

export function unpin(vaultRoot, noteName) {
  const vault = new Vault(vaultRoot);

  if (!noteName) {
    throw new Error('Usage: clausidian unpin <note-name>');
  }

  const note = vault.findNote(noteName);
  if (!note) throw new Error(`Note not found: ${noteName}`);

  const filePath = `${note.dir}/${note.file}.md`;
  let content = vault.read(filePath);

  if (!content.includes('pinned: true')) {
    console.log(`Not pinned: ${note.file}`);
    return { status: 'not_pinned', file: filePath };
  }

  content = content.replace(/^pinned: true\n?/m, '');
  content = content.replace(/^(updated:)\s*.*$/m, `$1 "${todayStr()}"`);

  vault.write(filePath, content);
  console.log(`Unpinned: ${note.file}`);
  return { status: 'unpinned', file: filePath };
}

export function listPinned(vaultRoot) {
  const vault = new Vault(vaultRoot);
  const notes = vault.scanNotes();
  const pinned = [];

  for (const note of notes) {
    const content = vault.read(note.dir, `${note.file}.md`);
    if (content && content.includes('pinned: true')) {
      pinned.push(note);
    }
  }

  if (!pinned.length) {
    console.log('No pinned notes.');
    return { pinned: [] };
  }

  console.log(`\n${pinned.length} pinned note(s):\n`);
  console.log('| File | Type | Summary |');
  console.log('|------|------|---------|');
  for (const p of pinned) {
    console.log(`| [[${p.file}]] | ${p.type} | ${p.summary || '-'} |`);
  }

  return { pinned };
}
