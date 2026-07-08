/**
 * setup — configure Claude Code MCP server + install /obsidian skill
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_SRC = resolve(__dirname, '..', '..', 'skill', 'SKILL.md');

export function setup(vaultPath) {
  const vault = resolve(vaultPath || process.env.OA_VAULT || '.');
  const home = process.env.HOME || process.env.USERPROFILE;
  const results = [];

  // 1. Verify vault exists
  if (!existsSync(join(vault, '_index.md')) && !existsSync(join(vault, 'AGENT.md'))) {
    console.log(`"${vault}" doesn't look like an clausidian vault.`);
    console.log('Run: clausidian init <path> first.');
    return { status: 'error', reason: 'not a vault' };
  }

  // 2. Install /obsidian skill to ~/.claude/skills/obsidian/
  const skillDir = join(home, '.claude', 'skills', 'obsidian');
  if (!existsSync(skillDir)) mkdirSync(skillDir, { recursive: true });
  const skillDest = join(skillDir, 'SKILL.md');
  if (existsSync(SKILL_SRC)) {
    copyFileSync(SKILL_SRC, skillDest);
    results.push('Skill installed: ~/.claude/skills/obsidian/SKILL.md');
  } else {
    results.push('Skill source not found (npm package may be missing skill/)');
  }

  // 3. Configure MCP server in ~/.claude/.mcp.json
  const mcpPath = join(home, '.claude', '.mcp.json');
  let mcpConfig = { mcpServers: {} };
  if (existsSync(mcpPath)) {
    try { mcpConfig = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch {}
  }
  if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};

  mcpConfig.mcpServers['clausidian'] = {
    command: 'clausidian',
    args: ['serve', '--vault', vault],
  };
  if (!existsSync(dirname(mcpPath))) mkdirSync(dirname(mcpPath), { recursive: true });
  writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2) + '\n');
  results.push(`MCP server configured: clausidian serve --vault "${vault}"`);

  // 4. Set OA_VAULT in shell profile (suggest, don't force)
  const shellNote = `export OA_VAULT="${vault}"`;

  console.log('\n✨ Claude Code Integration Setup Complete!\n');
  for (const r of results) console.log(`  ✓ ${r}`);
  console.log(`\nTo set OA_VAULT permanently, add to your shell profile:`);
  console.log(`  ${shellNote}\n`);
  console.log('✨ Claude Code — Next Steps:');
  console.log('  1. Restart Claude Code (load MCP server + /obsidian skill)');
  console.log('  2. Use /obsidian in sessions to manage your vault');
  console.log('  3. Enable hooks in ~/.claude/settings.json:');
  console.log('     - session-start: load today\'s context');
  console.log('     - pre-tool-use: track file edits');
  console.log('     - session-stop: capture learnings & decisions');
  console.log('  4. Optional — enhance workflow:');
  console.log('     clausidian memory sync --dry-run       # sync vault → Claude memory');
  console.log('     clausidian claude-md inject --global   # add vault context to CLAUDE.md\n');

  return { status: 'ok', vault, results };
}
