/**
 * note — create a new note with automatic linking
 */
import { Vault } from '../vault.mjs';
import { TemplateEngine } from '../templates.mjs';
import { IndexManager } from '../index-manager.mjs';
import { todayStr } from '../dates.mjs';
import { updateFrontmatterField, updateFrontmatter } from '../frontmatter-helper.mjs';

export function note(vaultRoot, title, type, { tags = [], goal = '', summary = '' } = {}) {
  const vault = new Vault(vaultRoot);
  const tpl = new TemplateEngine(vaultRoot);
  const idx = new IndexManager(vault);

  if (!title || !title.trim()) {
    throw new Error('Note title cannot be empty.');
  }

  const validTypes = ['area', 'project', 'resource', 'idea'];
  const baseType = type.includes('/') ? type.split('/')[0] : type;
  if (!validTypes.includes(baseType)) {
    throw new Error(`Invalid type: ${type}. Must be one of: ${validTypes.join(', ')}`);
  }

  const filename = title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/(^-|-$)/g, '');
  const dir = vault.typeDir(type);

  if (vault.exists(dir, `${filename}.md`)) {
    console.log(`Note already exists: ${dir}/${filename}.md`);
    return { status: 'exists', file: `${dir}/${filename}.md` };
  }

  // Find related notes
  const related = vault.findRelated(title, tags);
  const relatedLinks = related.map(r => `[[${r.file}]]`);

  // Choose template — use base type or fallback to 'note'
  let templateName = baseType;
  try { tpl.load(templateName); } catch { templateName = 'note'; }

  const vars = {
    TITLE: title,
    DATE: todayStr(),
    TYPE: baseType,
    GOAL: goal,
    CONTENT: '',
  };

  let content = tpl.render(templateName, vars);

  // Inject related links and tags into frontmatter
  const fmUpdates = {};
  if (relatedLinks.length) fmUpdates.related = relatedLinks;
  if (tags.length) fmUpdates.tags = tags;
  if (summary) fmUpdates.summary = summary;
  if (Object.keys(fmUpdates).length) content = updateFrontmatter(content, fmUpdates);

  vault.write(dir, `${filename}.md`, content);
  idx.updateDirIndex(dir, filename, summary || title);
  idx.sync();

  // Update reverse links on related notes
  for (const rel of related) {
    const relPath = `${rel.dir}/${rel.file}.md`;
    const relContent = vault.read(relPath);
    if (relContent && !relContent.includes(`[[${filename}]]`)) {
      const updated = relContent.replace(
        /^(related:) \[(.*)]$/m,
        (_, prefix, inner) => {
          const existing = inner ? `${inner}, ` : '';
          return `${prefix} [${existing}"[[${filename}]]"]`;
        }
      );
      if (updated !== relContent) {
        vault.write(relPath, updateFrontmatterField(updated, 'updated', todayStr()));
      }
    }
  }

  console.log(`Created ${dir}/${filename}.md (${relatedLinks.length} related notes linked)`);
  return { status: 'created', file: `${dir}/${filename}.md`, related: relatedLinks.length };
}
