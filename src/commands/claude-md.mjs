/**
 * claude-md — manage vault context in CLAUDE.md files
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { Vault } from '../vault.mjs';

const BLOCK_START = '<!-- clausidian:start -->';
const BLOCK_END = '<!-- clausidian:end -->';

export function generateBlock(vaultRoot) {
  const vault = new Vault(vaultRoot);
  const notes = vault.scanNotes();

  // Get vault info
  const dirs = ['areas', 'projects', 'resources', 'journal', 'ideas'];
  const activeProjects = notes
    .filter(n => n.type === 'project' && n.status === 'active')
    .slice(0, 3)
    .map(p => `[[${p.file}]]`)
    .join(', ');

  const block = [
    BLOCK_START,
    `## Obsidian Vault (managed by clausidian)`,
    ``,
    `- **Path**: \`${vaultRoot}\``,
    `- **Structure**: PARA (${dirs.join('/')})`,
    `- **Access**: \`/obsidian\` skill or MCP clausidian tools`,
    `- **Search**: \`clausidian search "keyword"\``,
    `- **Today**: \`clausidian daily\``,
    `- **Memory**: \`clausidian memory sync\` to sync to Claude memory`,
    activeProjects ? `- **Active Projects**: ${activeProjects}` : null,
    ``,
    BLOCK_END,
  ].filter(Boolean).join('\n');

  return block;
}

export function generate(vaultRoot, options = {}) {
  const block = generateBlock(vaultRoot);
  console.log(block);
  return { status: 'generated', block };
}

export function inject(vaultRoot, options = {}) {
  const home = process.env.HOME || process.env.USERPROFILE;
  const isGlobal = options.global === true;
  const targetPath = options.path || (isGlobal
    ? join(home, '.claude', 'CLAUDE.md')
    : join(process.cwd(), 'CLAUDE.md'));

  // Read existing file or create empty
  let existing = '';
  if (existsSync(targetPath)) {
    existing = readFileSync(targetPath, 'utf8');
  }

  const newBlock = generateBlock(vaultRoot);

  // Check if block already exists
  if (existing.includes(BLOCK_START)) {
    // Update existing block
    const updated = existing.replace(
      new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}`, 'g'),
      newBlock
    );
    writeFileSync(targetPath, updated);
    return { status: 'updated', path: targetPath };
  }

  // Append to end
  const newContent = existing.trimEnd() + (existing ? '\n\n' : '') + newBlock + '\n';
  const dir = dirname(targetPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(targetPath, newContent);

  return { status: 'injected', path: targetPath };
}

export function remove(vaultRoot, options = {}) {
  const home = process.env.HOME || process.env.USERPROFILE;
  const isGlobal = options.global === true;
  const targetPath = options.path || (isGlobal
    ? join(home, '.claude', 'CLAUDE.md')
    : join(process.cwd(), 'CLAUDE.md'));

  if (!existsSync(targetPath)) {
    return { status: 'skipped', reason: 'file does not exist' };
  }

  const existing = readFileSync(targetPath, 'utf8');

  if (!existing.includes(BLOCK_START)) {
    return { status: 'skipped', reason: 'clausidian block not found' };
  }

  const updated = existing.replace(
    new RegExp(`${BLOCK_START}[\\s\\S]*?${BLOCK_END}\n?`, 'g'),
    ''
  );

  writeFileSync(targetPath, updated);
  return { status: 'removed', path: targetPath };
}
