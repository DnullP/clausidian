/**
 * patch — heading-level edits on existing notes
 */
import { Vault } from '../vault.mjs';
import { todayStr } from '../dates.mjs';
import { updateFrontmatterField } from '../frontmatter-helper.mjs';
import { NoteNotFoundError, HeadingNotFoundError } from '../errors.mjs';

export function patch(vaultRoot, noteName, { heading, append, prepend, replace } = {}) {
  const vault = new Vault(vaultRoot);

  if (!noteName || !heading) {
    throw new Error('Usage: clausidian patch <note> --heading "Section" [--append|--prepend|--replace TEXT]');
  }

  const note = vault.findNote(noteName);
  if (!note) {
    throw new NoteNotFoundError(noteName);
  }

  const filePath = `${note.dir}/${note.file}.md`;
  let content = vault.read(filePath);
  if (!content) {
    throw new Error(`Cannot read: ${filePath}`);
  }

  // Find heading and its content boundaries
  const lines = content.split('\n');
  const headingLevel = heading.startsWith('#') ? heading.split(' ')[0].length : null;
  const headingText = heading.replace(/^#+\s*/, '');

  let startIdx = -1;
  let endIdx = lines.length;
  let matchedLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const hMatch = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (!hMatch) continue;
    const level = hMatch[1].length;
    const text = hMatch[2].trim();

    if (startIdx === -1) {
      if (text.toLowerCase() === headingText.toLowerCase() &&
          (headingLevel === null || level === headingLevel)) {
        startIdx = i;
        matchedLevel = level;
      }
    } else {
      // End at next heading of same or higher level
      if (level <= matchedLevel) {
        endIdx = i;
        break;
      }
    }
  }

  if (startIdx === -1) {
    throw new HeadingNotFoundError(heading);
  }

  // Extract section content (lines between heading and next heading)
  const sectionStart = startIdx + 1;
  const sectionLines = lines.slice(sectionStart, endIdx);
  const sectionContent = sectionLines.join('\n').trim();

  let newSection;
  if (replace !== undefined) {
    newSection = replace;
  } else if (append) {
    newSection = sectionContent ? `${sectionContent}\n${append}` : append;
  } else if (prepend) {
    newSection = sectionContent ? `${prepend}\n${sectionContent}` : prepend;
  } else {
    // No operation — just show current section content
    console.log(sectionContent || '(empty)');
    return { status: 'read', heading: headingText, content: sectionContent };
  }

  // Rebuild the file
  const before = lines.slice(0, sectionStart).join('\n');
  const after = lines.slice(endIdx).join('\n');
  const newContent = `${before}\n\n${newSection}\n\n${after}`.replace(/\n{3,}/g, '\n\n');

  // Update the `updated` field
  const final = updateFrontmatterField(newContent, 'updated', todayStr());
  vault.write(filePath, final);

  const op = replace !== undefined ? 'replaced' : append ? 'appended' : 'prepended';
  console.log(`Patched ${note.dir}/${note.file}.md → ${op} to "${headingText}"`);
  return { status: 'patched', file: filePath, heading: headingText, operation: op };
}
