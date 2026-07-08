/**
 * capture — quick idea capture
 */
import { Vault } from '../vault.mjs';
import { TemplateEngine } from '../templates.mjs';
import { IndexManager } from '../index-manager.mjs';
import { todayStr } from '../dates.mjs';

export function capture(vaultRoot, ideaText) {
  const vault = new Vault(vaultRoot);
  const tpl = new TemplateEngine(vaultRoot);
  const idx = new IndexManager(vault);

  // Extract title: first sentence or first 50 chars
  const title = ideaText.split(/[。.!！?\n]/)[0].trim().slice(0, 60) || 'Untitled idea';
  const filename = title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/(^-|-$)/g, '');

  if (vault.exists('ideas', `${filename}.md`)) {
    console.log(`Idea already exists: ideas/${filename}.md`);
    return { status: 'exists' };
  }

  const related = vault.findRelated(title);
  const relatedLinks = related.map(r => `[[${r.file}]]`);

  let content = tpl.render('idea', {
    TITLE: title,
    DATE: todayStr(),
    CONTENT: ideaText,
  });

  if (relatedLinks.length) {
    content = content.replace(/related: \[\]/, `related: [${relatedLinks.map(l => `"${l}"`).join(', ')}]`);
  }

  vault.write('ideas', `${filename}.md`, content);
  idx.updateDirIndex('ideas', filename, title);
  idx.sync();

  console.log(`Captured: ideas/${filename}.md`);
  return { status: 'created', file: `ideas/${filename}.md` };
}
