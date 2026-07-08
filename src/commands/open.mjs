/**
 * open — open a note in Obsidian.app via obsidian:// URI scheme (macOS)
 */
import { execSync } from 'child_process';
import { basename } from 'path';
import { Vault } from '../vault.mjs';

export function open(vaultRoot, noteName, { reveal = false } = {}) {
  const vault = new Vault(vaultRoot);

  if (!noteName) {
    // Open the vault root in Obsidian
    const vaultName = basename(vaultRoot);
    const uri = `obsidian://open?vault=${encodeURIComponent(vaultName)}`;
    execSync(`open "${uri}"`);
    console.log(`Opened vault "${vaultName}" in Obsidian`);
    return { status: 'opened', target: 'vault', vault: vaultName };
  }

  const note = vault.findNote(noteName);
  if (!note) {
    throw new Error(`Note not found: ${noteName}`);
  }

  const vaultName = basename(vaultRoot);
  const filePath = `${note.dir}/${note.file}`;

  if (reveal) {
    // Reveal in Finder instead
    execSync(`open -R "${vault.path(note.dir, note.file + '.md')}"`);
    console.log(`Revealed ${filePath}.md in Finder`);
    return { status: 'revealed', file: filePath };
  }

  const uri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(filePath)}`;
  execSync(`open "${uri}"`);
  console.log(`Opened ${filePath} in Obsidian`);
  return { status: 'opened', target: 'note', file: filePath };
}
