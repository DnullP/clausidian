/**
 * import — import notes from JSON or markdown files into the vault
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { Vault } from '../vault.mjs';
import { IndexManager } from '../index-manager.mjs';
import { todayStr } from '../dates.mjs';

export function importNotes(vaultRoot, inputPath) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);

  if (!inputPath) {
    throw new Error('Usage: clausidian import <file.json|file.md>');
  }

  const fullPath = resolve(inputPath);
  if (!existsSync(fullPath)) {
    throw new Error(`File not found: ${fullPath}`);
  }

  const raw = readFileSync(fullPath, 'utf8');
  let notes;

  if (fullPath.endsWith('.json')) {
    notes = JSON.parse(raw);
    if (!Array.isArray(notes)) notes = [notes];
  } else if (fullPath.endsWith('.md')) {
    // Parse markdown: split by --- separator, extract frontmatter
    notes = parseMarkdownImport(raw);
  } else {
    throw new Error('Unsupported format. Use .json or .md');
  }

  let imported = 0;
  let skipped = 0;

  for (const note of notes) {
    const type = note.type || 'idea';
    const title = note.title || `Imported ${todayStr()}`;
    const filename = (note.file || title).toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const dir = vault.typeDir(type);

    if (vault.exists(dir, `${filename}.md`)) {
      skipped++;
      continue;
    }

    const tags = Array.isArray(note.tags) ? note.tags : [];
    const content = `---
title: "${title}"
type: ${type}
tags: [${tags.join(', ')}]
created: "${note.created || todayStr()}"
updated: "${todayStr()}"
status: ${note.status || 'active'}
summary: "${note.summary || ''}"
related: []
---

${note.body || ''}
`;

    vault.write(dir, `${filename}.md`, content);
    idx.updateDirIndex(dir, filename, note.summary || title);
    imported++;
  }

  idx.sync();

  console.log(`Imported ${imported} note(s), skipped ${skipped} duplicate(s)`);
  return { imported, skipped };
}

function parseMarkdownImport(raw) {
  // Split by horizontal rule separator
  const sections = raw.split(/\n---\n/).filter(s => s.trim());
  const notes = [];

  for (const section of sections) {
    const fmMatch = section.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (fmMatch) {
      // Has frontmatter
      const fm = {};
      for (const line of fmMatch[1].split('\n')) {
        const m = line.match(/^(\w[\w-]*):\s*(.*)$/);
        if (m) {
          let val = m[2].trim().replace(/^"(.*)"$/, '$1');
          if (val.startsWith('[') && val.endsWith(']')) {
            val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^"(.*)"$/, '$1')).filter(Boolean);
          }
          fm[m[1]] = val;
        }
      }
      fm.body = fmMatch[2].trim();
      notes.push(fm);
    } else {
      // Plain markdown — extract title from first heading
      const titleMatch = section.match(/^#\s+(.+)/m);
      notes.push({
        title: titleMatch ? titleMatch[1].trim() : `Imported note`,
        body: section.trim(),
      });
    }
  }

  return notes;
}
