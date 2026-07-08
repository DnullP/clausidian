/**
 * read — read a note's full content
 */
import { Vault } from '../vault.mjs';

export function read(vaultRoot, noteName, { section } = {}) {
  const vault = new Vault(vaultRoot);

  if (!noteName) {
    throw new Error('Usage: clausidian read <note-name> [--section HEADING]');
  }

  const note = vault.findNote(noteName);
  if (!note) {
    throw new Error(`Note not found: ${noteName}`);
  }

  const content = vault.read(note.dir, `${note.file}.md`);
  if (!content) {
    throw new Error(`Cannot read: ${note.dir}/${note.file}.md`);
  }

  if (section) {
    // Extract specific section
    const lines = content.split('\n');
    const headingText = section.replace(/^#+\s*/, '');
    let startIdx = -1;
    let endIdx = lines.length;
    let matchedLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const hMatch = lines[i].match(/^(#{1,6})\s+(.+)$/);
      if (!hMatch) continue;
      if (startIdx === -1) {
        if (hMatch[2].trim().toLowerCase() === headingText.toLowerCase()) {
          startIdx = i;
          matchedLevel = hMatch[1].length;
        }
      } else if (hMatch[1].length <= matchedLevel) {
        endIdx = i;
        break;
      }
    }

    if (startIdx === -1) {
      throw new Error(`Section not found: "${section}"`);
    }

    const sectionContent = lines.slice(startIdx, endIdx).join('\n').trim();
    console.log(sectionContent);
    return { file: `${note.dir}/${note.file}.md`, section: headingText, content: sectionContent };
  }

  console.log(content);
  return {
    file: `${note.dir}/${note.file}.md`,
    title: note.title,
    type: note.type,
    tags: note.tags,
    content,
  };
}
