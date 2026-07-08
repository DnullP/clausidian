/**
 * update — update frontmatter fields on an existing note
 */
import { Vault } from '../vault.mjs';
import { IndexManager } from '../index-manager.mjs';
import { todayStr } from '../dates.mjs';

const RESERVED = new Set(['note', 'vault', 'tag', 'tags', 'status', 'summary', '_vault']);

function parseField(val) {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'string') {
    // Try YAML-like arrays: "[a, b, c]" or JSON arrays
    if (val.startsWith('[') && val.endsWith(']')) {
      try { return JSON.parse(val); } catch {}
    }
    // Try JSON objects/values
    if (val.startsWith('{') || val.startsWith('"')) {
      try { return JSON.parse(val); } catch {}
    }
  }
  return val;
}

export function update(vaultRoot, noteName, params = {}) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);

  if (!noteName) {
    throw new Error('Usage: clausidian update <note-name> [--status STATUS] [--tags TAG1,TAG2] [--summary TEXT] [--aliases "alias1,alias2"] [--related "[[a]],[[b]]"] ...');
  }

  const note = vault.findNote(noteName);
  if (!note) {
    throw new Error(`Note not found: ${noteName}`);
  }

  const { status, tags, summary, tag, ...rest } = params;
  const updates = { updated: todayStr() };
  if (status) updates.status = status;
  if (summary) updates.summary = summary;
  if (tags) updates.tags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;
  if (tag) {
    const existing = note.tags;
    if (!existing.includes(tag)) {
      updates.tags = [...existing, tag];
    }
  }

  // Pass through all extra frontmatter fields
  for (const [key, val] of Object.entries(rest)) {
    if (RESERVED.has(key)) continue;
    const parsed = parseField(val);
    if (parsed !== undefined) updates[key] = parsed;
  }

  vault.updateNote(note.dir, note.file, updates);
  idx.rebuildTags();

  const changed = Object.keys(updates).filter(k => k !== 'updated').join(', ') || 'updated';
  console.log(`Updated ${note.dir}/${note.file}.md (${changed})`);
  return { status: 'updated', file: `${note.dir}/${note.file}.md`, changes: updates };
}
