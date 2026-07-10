/**
 * patch — heading-level edits on existing notes
 *
 * Key design decisions for agent usability:
 * - Auto-creates missing headings by default (create_if_missing: true)
 * - Heading prefix matching: "## Description" matches "## Description — 直白介绍"
 * - after_line / before_line for paragraph-level targeting within a section
 * - match_text + replace for inline text substitution (most common edit pattern)
 * - delete_section to remove an entire heading section
 */
import { Vault } from '../vault.mjs';
import { todayStr } from '../dates.mjs';
import { updateFrontmatterField } from '../frontmatter-helper.mjs';
import { NoteNotFoundError } from '../errors.mjs';

/**
 * Check if a heading matches the user's query.
 * Supports prefix matching: "Description" matches "Description — 概述"
 */
function headingMatches(headingText, query, headingLevel, actualLevel) {
  const text = headingText.trim().toLowerCase();
  const q = query.trim().toLowerCase();
  // Exact match
  if (text === q) return true;
  // Prefix match (handles "Description — comment" style headings)
  if (text.startsWith(q)) return true;
  // Prefix match with em-dash separator
  const emDashIdx = text.indexOf('—');
  if (emDashIdx !== -1 && text.substring(0, emDashIdx).trim() === q) return true;
  return false;
}

/**
 * Find the best position to insert a new heading at the end of the body.
 * Places it before Connections/See Also section if present, otherwise at end.
 */
function findInsertPosition(lines) {
  // Try to find Connections or See Also heading
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      const text = m[2].trim().toLowerCase();
      if (text === 'connections' || text === 'see also' || text.startsWith('connections') || text.startsWith('see also')) {
        return i; // Insert before Connections
      }
    }
  }
  return lines.length; // Append at end
}

export function patch(vaultRoot, noteName, {
  heading, append, prepend, replace,
  create_if_missing = true,
  after_line, before_line,
  match_text, delete_section,
} = {}) {
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
    const text = hMatch[2];

    if (startIdx === -1) {
      if (headingMatches(text, headingText, headingLevel, level)) {
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

  // ── Heading not found ──
  if (startIdx === -1) {
    if (!create_if_missing) {
      throw new Error(`Heading "${heading}" not found in "${noteName}". Use create_if_missing=true to auto-create.`);
    }

    // No operation specified — nothing to do
    if (!append && !prepend && replace === undefined) {
      console.log(`(section "${headingText}" does not exist yet; use --append/--prepend/--replace to create it)`);
      return { status: 'missing', heading: headingText, content: '' };
    }

    // Determine heading level to create
    const level = headingLevel || 2; // Default to ## if not specified
    const prefix = '#'.repeat(level);
    const newHeading = `${prefix} ${headingText}`;

    // Determine insertion point
    const insertAt = findInsertPosition(lines);

    // Build new content with heading and body
    const newSectionContent = replace !== undefined ? replace :
      append ? append :
      prepend ? prepend : '';
    const newLines = ['', newHeading, '', newSectionContent];
    lines.splice(insertAt, 0, ...newLines);

    const newContent = lines.join('\n').replace(/\n{3,}/g, '\n\n');
    const final = updateFrontmatterField(newContent, 'updated', todayStr());
    vault.write(filePath, final);

    console.log(`Patched ${note.dir}/${note.file}.md → created heading "${headingText}"`);
    return { status: 'created', file: filePath, heading: headingText, operation: 'created' };
  }

  // ── Heading found — extract section content ──
  const sectionStart = startIdx + 1;
  const sectionLines = lines.slice(sectionStart, endIdx);
  let sectionContent = sectionLines.join('\n');

  // ── delete_section: remove the entire heading section ──
  if (delete_section) {
    // Remove heading line + section content
    lines.splice(startIdx, endIdx - startIdx);
    const newContent = lines.join('\n').replace(/\n{3,}/g, '\n\n');
    const final = updateFrontmatterField(newContent, 'updated', todayStr());
    vault.write(filePath, final);

    console.log(`Patched ${note.dir}/${note.file}.md → deleted section "${headingText}"`);
    return { status: 'deleted', file: filePath, heading: headingText, operation: 'deleted_section' };
  }

  // No operation — just read
  if (!append && !prepend && replace === undefined && !after_line && !before_line) {
    const trimmed = sectionContent.trim();
    console.log(trimmed || '(empty)');
    return { status: 'read', heading: headingText, content: trimmed };
  }

  // ── match_text + replace: inline text substitution within section ──
  if (match_text && replace !== undefined) {
    const idx = sectionContent.indexOf(match_text);
    if (idx === -1) {
      throw new Error(`match_text "${match_text}" not found within section "${headingText}"`);
    }
    sectionContent = sectionContent.substring(0, idx) +
                     replace +
                     sectionContent.substring(idx + match_text.length);
    return writeSection(vault, filePath,
      lines.slice(0, sectionStart).join('\n'),
      sectionContent,
      lines.slice(endIdx).join('\n'),
      headingText, note, 'replaced_inline', append);
  }

  // ── Line-level targeting: after_line / before_line within the section ──
  if (after_line || before_line) {
    const targetPattern = after_line || before_line;
    let targetIdx = -1;

    for (let i = 0; i < sectionLines.length; i++) {
      if (sectionLines[i].trim().toLowerCase().includes(targetPattern.toLowerCase())) {
        targetIdx = i;
        break;
      }
    }

    if (targetIdx === -1) {
      throw new Error(`Line pattern "${targetPattern}" not found within section "${headingText}"`);
    }

    const insertIdx = after_line ? targetIdx + 1 : targetIdx;
    const insertText = append || prepend || replace || '';
    sectionLines.splice(insertIdx, 0, insertText);

    sectionContent = sectionLines.join('\n');
  } else {
    // ── Section-level operations ──
    const trimmed = sectionContent.trim();
    let newSection;
    if (replace !== undefined) {
      newSection = replace;
    } else if (append) {
      newSection = trimmed ? `${trimmed}\n${append}` : append;
    } else if (prepend) {
      newSection = trimmed ? `${prepend}\n${trimmed}` : prepend;
    }
    sectionContent = newSection;
  }

  // ── Rebuild the file ──
  let newLines;
  if (after_line || before_line) {
    // sectionLines already contains the modified section
    newLines = [
      ...lines.slice(0, sectionStart),
      ...sectionLines,
      ...lines.slice(endIdx),
    ];
  } else {
    const before = lines.slice(0, sectionStart).join('\n');
    const after = lines.slice(endIdx).join('\n');
    return writeSection(vault, filePath, before, sectionContent, after, headingText, note, replace, append);
  }

  const newContent = newLines.join('\n').replace(/\n{3,}/g, '\n\n');
  const final = updateFrontmatterField(newContent, 'updated', todayStr());
  vault.write(filePath, final);

  const op = after_line ? `after "${after_line}"` :
             before_line ? `before "${before_line}"` :
             replace !== undefined ? 'replaced' :
             append ? 'appended' : 'prepended';
  console.log(`Patched ${note.dir}/${note.file}.md → ${op} in "${headingText}"`);
  return { status: 'patched', file: filePath, heading: headingText, operation: op };
}

function writeSection(vault, filePath, before, sectionContent, after, headingText, note, replace, append) {
  const newContent = `${before}\n${sectionContent}\n${after}`
    .replace(/\n{3,}/g, '\n\n');
  const final = updateFrontmatterField(newContent, 'updated', todayStr());
  vault.write(filePath, final);

  const op = replace === 'replaced_inline' ? 'replaced text' :
             replace !== undefined ? 'replaced section' :
             append ? 'appended' : 'prepended';
  console.log(`Patched ${note.dir}/${note.file}.md → ${op} in "${headingText}"`);
  return { status: 'patched', file: filePath, heading: headingText, operation: op };
}
