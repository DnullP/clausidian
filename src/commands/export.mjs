/**
 * export — export notes from the vault
 *
 * Formats: json (default), markdown (bundled .md file)
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { Vault } from '../vault.mjs';

export function exportNotes(vaultRoot, { type, tag, status, format = 'json', output } = {}) {
  const vault = new Vault(vaultRoot);
  const notes = vault.scanNotes({ includeBody: true });

  const filtered = notes.filter(n => {
    if (type && n.type !== type) return false;
    if (tag && !n.tags.includes(tag)) return false;
    if (status && n.status !== status) return false;
    return true;
  });

  if (!filtered.length) {
    console.log('No matching notes to export.');
    return { exported: 0 };
  }

  let data;
  let ext;

  if (format === 'markdown' || format === 'md') {
    ext = 'md';
    const sections = filtered.map(n => {
      const content = vault.read(n.dir, `${n.file}.md`) || '';
      return `# ${n.title}\n\n> Type: ${n.type} | Status: ${n.status} | Tags: ${n.tags.join(', ') || 'none'}\n\n${vault.extractBody(content)}`;
    });
    data = sections.join('\n\n---\n\n');
  } else {
    ext = 'json';
    data = JSON.stringify(filtered.map(n => ({
      file: n.file,
      dir: n.dir,
      title: n.title,
      type: n.type,
      tags: n.tags,
      status: n.status,
      summary: n.summary,
      related: n.related,
      created: n.created,
      updated: n.updated,
      body: n.body,
    })), null, 2);
  }

  const outPath = output || resolve(process.cwd(), `vault-export.${ext}`);
  writeFileSync(outPath, data);

  console.log(`Exported ${filtered.length} note(s) to ${outPath}`);
  return { exported: filtered.length, path: outPath, format };
}
