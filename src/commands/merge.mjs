/**
 * merge — merge two notes into one, keeping the target and deleting the source
 */
import { unlinkSync } from 'fs';
import { Vault } from '../vault.mjs';
import { IndexManager } from '../index-manager.mjs';
import { todayStr } from '../dates.mjs';

export function merge(vaultRoot, sourceName, targetName) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);

  if (!sourceName || !targetName) {
    throw new Error('Usage: clausidian merge <source-note> <target-note>');
  }

  const source = vault.findNote(sourceName);
  if (!source) throw new Error(`Source note not found: ${sourceName}`);

  const target = vault.findNote(targetName);
  if (!target) throw new Error(`Target note not found: ${targetName}`);

  if (source.file === target.file) {
    throw new Error('Cannot merge a note into itself');
  }

  // Read both notes
  const sourceContent = vault.read(source.dir, `${source.file}.md`);
  let targetContent = vault.read(target.dir, `${target.file}.md`);
  const sourceBody = vault.extractBody(sourceContent);

  // Merge tags (union)
  const mergedTags = [...new Set([...target.tags, ...source.tags])];

  // Merge related (union, excluding self-references)
  const mergedRelated = [...new Set([...target.related, ...source.related])]
    .filter(r => r !== source.file && r !== target.file);

  // Append source body to target
  targetContent = targetContent.replace(/^(updated:)\s*.*$/m, `$1 "${todayStr()}"`);
  if (mergedTags.length) {
    targetContent = targetContent.replace(/^(tags:)\s*.*$/m, `$1 [${mergedTags.join(', ')}]`);
  }
  if (mergedRelated.length) {
    targetContent = targetContent.replace(
      /^(related:)\s*.*$/m,
      `$1 [${mergedRelated.map(r => `"[[${r}]]"`).join(', ')}]`
    );
  }

  targetContent += `\n\n---\n\n<!-- Merged from: ${source.file} (${todayStr()}) -->\n\n${sourceBody}`;
  vault.write(target.dir, `${target.file}.md`, targetContent);

  // Update references: rewrite [[source]] → [[target]] in all notes
  const notes = vault.scanNotes({ includeBody: true });
  let refsUpdated = 0;
  for (const n of notes) {
    if (n.file === source.file || n.file === target.file) continue;
    const path = `${n.dir}/${n.file}.md`;
    let content = vault.read(path);
    if (!content || !content.includes(`[[${source.file}]]`)) continue;
    content = content.replaceAll(`[[${source.file}]]`, `[[${target.file}]]`);
    content = content.replace(/^(updated:)\s*.*$/m, `$1 "${todayStr()}"`);
    vault.write(path, content);
    refsUpdated++;
  }

  // Delete source
  unlinkSync(vault.path(source.dir, `${source.file}.md`));
  vault.invalidateCache();
  idx.sync();

  console.log(`Merged ${source.dir}/${source.file}.md → ${target.dir}/${target.file}.md (${refsUpdated} reference(s) redirected)`);
  return {
    status: 'merged',
    source: `${source.dir}/${source.file}.md`,
    target: `${target.dir}/${target.file}.md`,
    refsUpdated,
  };
}
