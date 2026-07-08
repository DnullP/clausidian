/**
 * init — scaffold a new agent-friendly Obsidian vault
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, cpSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

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

  console.log(`\n✅ Vault initialized at: ${root}\n`);
  console.log('Structure:');
  console.log('  areas/       — Long-term focus areas');
  console.log('  projects/    — Concrete projects');
  console.log('  resources/   — Reference materials');
  console.log('  journal/     — Daily logs & weekly reviews');
  console.log('  ideas/       — Draft ideas');
  console.log('  templates/   — Note templates');
  console.log('  CONVENTIONS.md — Writing & agent rules');
  console.log('');
  console.log('Agent configs generated:');
  console.log('  .claude/commands/  — Claude Code slash commands');
  console.log('  AGENT.md           — Universal agent instructions');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Open the vault in Obsidian');
  console.log('  2. Start your AI agent in this directory');
  console.log('  3. The agent reads AGENT.md and uses `clausidian` CLI');
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
