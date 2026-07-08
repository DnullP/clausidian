/**
 * init — scaffold a new agent-friendly Obsidian vault
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, cpSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const SCAFFOLD_DIR = resolve(fileURLToPath(import.meta.url), '..', '..', '..', 'scaffold');

export function init(targetDir) {
  const root = resolve(targetDir);

  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }

  // Copy scaffold structure
  copyRecursive(SCAFFOLD_DIR, root);

  // Create .gitignore (npm excludes dotfiles from packages)
  const gitignorePath = join(root, '.gitignore');
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, `# Obsidian
.obsidian/workspace.json
.obsidian/workspace-mobile.json
.obsidian/plugins/*/main.js
.obsidian/plugins/*/styles.css
.obsidian/plugins/*/manifest.json
.obsidian/cache/

# OS
.DS_Store
.trash/
Thumbs.db

# Dependencies
node_modules/
`);
  }

  // Create directories
  const dirs = ['areas', 'projects', 'resources', 'journal', 'ideas'];
  const subdirs = ['resources/wiki'];
  for (const dir of dirs) {
    const p = join(root, dir);
    if (!existsSync(p)) mkdirSync(p, { recursive: true });

    // Create _index.md for each directory
    const indexPath = join(p, '_index.md');
    if (!existsSync(indexPath)) {
      writeFileSync(indexPath, `---
title: ${dir} index
type: index
updated: ${new Date().toISOString().slice(0, 10)}
---

# ${dir.charAt(0).toUpperCase() + dir.slice(1)}

| File | Summary |
|------|---------|
`);
    }
  }

  // Create subdirectories (resources/wiki/ for wiki entries)
  for (const dir of subdirs) {
    const p = join(root, dir);
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
    const indexPath = join(p, '_index.md');
    if (!existsSync(indexPath)) {
      const dirName = dir.split('/').pop();
      writeFileSync(indexPath, `---
title: ${dirName} index
type: index
updated: ${new Date().toISOString().slice(0, 10)}
---

# Wiki Entries

| File | Summary |
|------|---------|
`);
    }
  }

  // Create _tags.md
  if (!existsSync(join(root, '_tags.md'))) {
    writeFileSync(join(root, '_tags.md'), `---
title: Tags Index
type: index
updated: ${new Date().toISOString().slice(0, 10)}
---

# Tags Index

(Run \`clausidian sync\` to populate)
`);
  }

  // Create _graph.md
  if (!existsSync(join(root, '_graph.md'))) {
    writeFileSync(join(root, '_graph.md'), `---
title: Knowledge Graph
type: index
updated: ${new Date().toISOString().slice(0, 10)}
---

# Knowledge Graph

(Run \`clausidian sync\` to populate)
`);
  }

  // Create _index.md (vault root)
  if (!existsSync(join(root, '_index.md'))) {
    writeFileSync(join(root, '_index.md'), `---
title: Vault Index
type: index
updated: ${new Date().toISOString().slice(0, 10)}
---

# Knowledge Base

| Directory | Purpose |
|-----------|---------|
| areas/ | Long-term focus areas |
| projects/ | Concrete projects with goals |
| resources/ | Reference materials |
| journal/ | Daily logs and weekly reviews |
| ideas/ | Draft ideas to explore |

## Quick Links

- [[_tags]] — Tag index
- [[_graph]] — Knowledge graph
`);
  }

  // Generate .claude/settings.json with hook enforcement
  const claudeDir = join(root, '.claude');
  if (!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true });
  const settingsPath = join(claudeDir, 'settings.json');
  if (!existsSync(settingsPath)) {
    let clausidianBin = 'clausidian';
    try { clausidianBin = execSync('zsh -ic "which clausidian" 2>/dev/null', { encoding: 'utf8' }).trim(); } catch {}
    if (!clausidianBin || clausidianBin === 'clausidian') {
      try { clausidianBin = execSync('which clausidian', { encoding: 'utf8' }).trim(); } catch {}
    }
    const settings = {
      permissions: {
        allow: [
          "Skill(update-config)",
          "Skill(update-config:*)",
          `Bash(OA_VAULT="${root}" ${clausidianBin} hook session-start)`,
          `Bash(OA_VAULT="${root}" ${clausidianBin} validate)`,
          `Bash(OA_VAULT="${root}" ${clausidianBin} hook session-stop)`,
          `Bash(python3 ${join(root, '.claude/scripts/enforce-clausidian.py')})`,
          "Bash(python3:*)",
          "Read(//Users/**/.claude/**)",
        ],
      },
      hooks: {
        SessionStart: [
          {
            hooks: [
              {
                type: "command",
                command: `OA_VAULT="${root}" ${clausidianBin} hook session-start`,
                statusMessage: "Loading today's vault context...",
              },
              {
                type: "command",
                command: `OA_VAULT="${root}" ${clausidianBin} validate`,
                statusMessage: "Checking vault health and wiki compliance...",
              },
            ],
          },
        ],
        PreToolUse: [
          {
            matcher: "Write|Edit|Bash",
            hooks: [
              {
                type: "command",
                command: `python3 ${join(root, '.claude/scripts/enforce-clausidian.py')}`,
                statusMessage: "Routing through clausidian MCP...",
              },
            ],
          },
        ],
        Stop: [
          {
            hooks: [
              {
                type: "command",
                command: `OA_VAULT="${root}" ${clausidianBin} hook session-stop`,
                statusMessage: "Capturing learnings & decisions...",
              },
            ],
          },
        ],
      },
    };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }

  console.log(`\n✅ Vault initialized at: ${root}\n`);
  console.log('Structure:');
  console.log('  areas/            — MOC aggregation pages');
  console.log('  projects/         — Goal-driven projects');
  console.log('  resources/wiki/   — Wiki entries (atomic evergreen notes)');
  console.log('  resources/        — Articles (long-form reading)');
  console.log('  journal/          — Daily logs & weekly reviews');
  console.log('  ideas/            — Fleeting notes');
  console.log('  templates/        — Note templates (wiki resource.md with 5-section body)');
  console.log('  CONVENTIONS.md    — Full wiki writing conventions');
  console.log('');
  console.log('Agent configs generated:');
  console.log('  .claude/settings.json  — PreToolUse enforcement + SessionStart/Stop hooks');
  console.log('  .claude/scripts/       — enforce-clausidian.py (MCP-only gate)');
  console.log('  .claude/commands/      — Claude Code slash commands');
  console.log('  AGENT.md               — Universal agent instructions');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Open the vault in Obsidian');
  console.log('  2. cd into this directory and start Claude Code');
  console.log('  3. The agent reads AGENT.md and CONVENTIONS.md automatically');
  console.log('  4. All Write/Edit/Bash on vault .md files → routed to clausidian MCP');
  console.log('');
  console.log('Try: clausidian journal');
}

function copyRecursive(src, dest) {
  if (!existsSync(src)) return;
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      if (!existsSync(destPath)) mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      if (!existsSync(destPath)) {
        writeFileSync(destPath, readFileSync(srcPath));
      }
    }
  }
}
