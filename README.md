# Clausidian

**Claude Code's Obsidian integration** — AI agent toolkit for vault management with zero dependencies. Works seamlessly with Claude Code and all major AI agents.

**Languages:** [English](README.md) | [中文](README.zh.md)

## Documentation

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, cache layers, performance optimization |
| [CHANGELOG.md](CHANGELOG.md) | Version history and release notes |
| [docs/](docs/README.md) | Test plans, feature plans, analysis reports |
| [scaffold/AGENT.md](scaffold/AGENT.md) | Agent quick-reference (commands, conventions) |
| [skill/SKILL.md](skill/SKILL.md) | `/obsidian` skill for Claude Code |

## Claude Code Integration

**One command setup:**

```bash
clausidian setup ~/my-vault
```

This automatically:
1. Installs the `/obsidian` skill to `~/.claude/skills/obsidian/`
2. Registers the MCP server in `~/.claude/.mcp.json`
3. After restart, use `/obsidian` command in Claude Code sessions to manage your vault
4. Registers 44+ MCP tools for programmatic vault operations

All 55+ `clausidian` CLI commands are available as `/obsidian` subcommands.

## Why

AI agents are great at managing knowledge, but they need structure. `clausidian` provides:

- **Structured vault** with frontmatter conventions, templates, and auto-linking
- **CLI interface** that any agent can call — no agent-specific integration needed
- **Automatic indices** — tag index, knowledge graph, directory indexes
- **Agent configs** generated for Claude Code, Cursor, Copilot out of the box

Your agent reads the vault's `AGENT.md`, learns the conventions, and uses `clausidian` CLI to create notes, journals, reviews — all with proper metadata and bidirectional links.

## Install

```bash
npm install -g clausidian
```

## Quick Start

```bash
# Install
npm install -g clausidian

# Initialize a new vault
clausidian init ~/my-vault
cd ~/my-vault

# Setup Claude Code integration (MCP server + /obsidian skill)
clausidian setup ~/my-vault

# Create today's journal
clausidian journal

# Create a project note
clausidian note "Build API" project --tags "backend,api"

# Capture an idea
clausidian capture "Use vector search for note retrieval"

# Search notes
clausidian search "API" --type resource

# List active projects
clausidian list project --status active

# Generate weekly review
clausidian review

# Generate monthly review
clausidian review monthly

# What links to this note?
clausidian backlinks "build-api"

# Update a note's metadata
clausidian update "build-api" --status active --summary "Core API"

# Archive a completed project
clausidian archive "old-project"

# Vault statistics
clausidian stats

# Generate Mermaid knowledge graph
clausidian graph

# Find orphan notes (no inbound links)
clausidian orphans

# Tag management
clausidian tag list
clausidian tag rename "old-tag" "new-tag"

# Rebuild indices
clausidian sync

# Rename a note (updates all references)
clausidian rename "build-api" "API Gateway"

# Move note to a different type
clausidian move "my-idea" project

# Merge two notes
clausidian merge "draft-api" "build-api"

# Find duplicate notes
clausidian duplicates --threshold 0.4

# Find broken links
clausidian broken-links

# Batch operations
clausidian batch tag --type idea --add "needs-review"
clausidian batch archive --tag "deprecated"
clausidian batch update --type project --set-status active

# Export / Import
clausidian export vault-backup.json
clausidian export --format markdown --type project
clausidian import notes.json

# Regex search
clausidian search "API.*v[23]" --regex

# Smart linking
clausidian link --dry-run          # preview missing links
clausidian link                    # create bidirectional links

# Activity timeline
clausidian timeline --days 7
clausidian timeline --type project

# Vault quality
clausidian validate
clausidian relink --dry-run        # preview broken link fixes
clausidian relink                  # auto-fix broken links

# Pin favorites
clausidian pin "important-note"
clausidian pin list
clausidian unpin "important-note"

# Daily dashboard
clausidian daily

# Improvement suggestions
clausidian suggest

# Word count stats
clausidian count
clausidian count --type project

# Pending tasks
clausidian agenda
clausidian agenda --all

# Vault changelog
clausidian changelog --days 14

# Graph exploration
clausidian neighbors "my-project" --depth 3

# Serendipity
clausidian random 3
clausidian random --type idea

# What to work on
clausidian focus
```

## Vault Structure

After `clausidian init`, your vault looks like:

```
my-vault/
├── areas/          # Long-term focus areas
├── projects/       # Concrete projects with goals
├── resources/      # Reference materials
├── journal/        # Daily logs & weekly reviews
├── ideas/          # Draft ideas
├── templates/      # Note templates ({{}} placeholders)
├── _index.md       # Vault index
├── _tags.md        # Tag → note mapping (auto-generated)
├── _graph.md       # Knowledge graph (auto-generated)
├── CONVENTIONS.md  # Writing & agent rules
├── AGENT.md        # Agent instructions
├── .claude/commands/  # Claude Code slash commands
├── .cursor/rules/     # Cursor rules
└── .github/copilot/   # Copilot instructions
```

## How It Works

### For Humans
1. Open the vault in Obsidian
2. Start your AI agent in the vault directory
3. The agent reads `AGENT.md` and knows how to operate

### For Agents
The agent uses CLI commands to manage notes:

```bash
# The agent runs these commands in your terminal
clausidian note "Learn Rust" project --tags "coding,learning"
clausidian capture "Idea for a new feature"
clausidian sync
```

Each command:
- Creates notes with proper frontmatter
- Automatically finds and links related notes
- Updates tag index (`_tags.md`) and knowledge graph (`_graph.md`)
- Maintains bidirectional `related` links

### Frontmatter Schema

Every note has structured YAML frontmatter:

```yaml
---
title: "My Note"
type: project          # area | project | resource | journal | idea
tags: [backend, api]
created: 2026-03-27
updated: 2026-03-27
status: active         # active | draft | archived
summary: "One-line description for agent retrieval"
related: ["[[other-note]]", "[[another-note]]"]
---
```

## Commands

| Command | Description |
|---------|-------------|
| `init <path>` | Initialize a new vault with templates & agent configs |
| `journal` | Create/open today's journal entry |
| `note <title> <type>` | Create a note (area/project/resource/idea) |
| `capture <idea>` | Quick idea capture to `ideas/` |
| `read <note>` | Read a note's full content (supports `--section`) |
| `recent [days]` | Show recently updated notes (default: 7 days) |
| `delete <note>` | Delete a note and clean up references |
| `search <keyword>` | Full-text search across all notes |
| `list [type]` | List notes with filters |
| `review` | Generate weekly review from journals |
| `review monthly` | Generate monthly review from weekly reviews & journals |
| `sync` | Rebuild `_tags.md` and `_graph.md` indices |
| `backlinks <note>` | Show notes that link to a given note |
| `update <note>` | Update note frontmatter (status, tags, summary) |
| `archive <note>` | Set note status to archived |
| `stats` | Show vault statistics (counts, top tags, orphans) |
| `graph` | Generate Mermaid knowledge graph diagram |
| `orphans` | Find notes with no inbound links |
| `tag list` | List all tags with counts |
| `tag rename <old> <new>` | Rename a tag across the vault |
| `patch <note>` | Edit a section by heading (`--heading`, `--append/--prepend/--replace`) |
| `rename <note> <title>` | Rename a note and update all references |
| `move <note> <type>` | Move note to a different type/directory |
| `merge <source> <target>` | Merge source note into target (body + tags + refs) |
| `duplicates` | Find potentially duplicate notes by similarity |
| `broken-links` | Find broken `[[wikilinks]]` pointing to non-existent notes |
| `batch update` | Batch update matching notes (`--set-status`, `--set-summary`) |
| `batch tag` | Batch add/remove tags (`--add`, `--remove`) |
| `batch archive` | Batch archive matching notes |
| `export [output]` | Export notes to JSON or markdown (`--format json\|markdown`) |
| `import <file>` | Import notes from JSON or markdown file |
| `link` | Auto-link related but unlinked notes (`--dry-run`, `--threshold`) |
| `timeline` | Chronological activity feed (`--days`, `--type`, `--limit`) |
| `validate` | Check frontmatter completeness and find issues |
| `pin <note>` | Pin a note as favorite |
| `unpin <note>` | Unpin a note |
| `pin list` | Show all pinned notes |
| `relink` | Fix broken links with closest matches (`--dry-run`) |
| `suggest` | Actionable vault improvement suggestions (orphans, stale notes, tag consolidation) |
| `daily` | Daily dashboard (journal status, activity, pinned, projects) |
| `count` | Word/line/note count statistics (`--type`) |
| `agenda` | Pending TODO items from journals & projects (`--days`, `--all`) |
| `changelog [output]` | Generate vault changelog from recent activity (`--days`) |
| `neighbors <note>` | Show connected notes within N hops (`--depth`) |
| `random [count]` | Pick random note(s) for serendipitous review |
| `focus` | Suggest what to work on next (pinned > momentum > stale > ideas) |
| `health` | Vault health scoring (completeness, connectivity, freshness, organization) |
| `setup [vault-path]` | Install MCP server + `/obsidian` skill for Claude Code |
| `watch` | Auto-rebuild indices on file changes |
| `serve` | Start MCP server (stdio transport) |
| `hook <event>` | Handle agent hook events |

### Flags

| Flag | Description |
|------|-------------|
| `--vault <path>` | Vault root (default: cwd or `$OA_VAULT`) |
| `--type <type>` | Filter by note type |
| `--tag <tag>` | Filter by tag |
| `--status <status>` | Filter by status |
| `--recent <days>` | Show notes updated in last N days |
| `--date <YYYY-MM-DD>` | Specify date for journal/review |
| `--year <YYYY>` | Year for monthly review |
| `--month <MM>` | Month for monthly review (1-12) |
| `--summary <text>` | Set note summary (for update) |
| `--tags <a,b,c>` | Set tags (for note/update) |
| `--regex` | Treat search keyword as regex pattern |
| `--threshold <0-1>` | Duplicate similarity threshold (default: 0.5) |
| `--format <json\|md>` | Export format (default: json) |
| `--set-status <status>` | New status for batch update |
| `--add <tag>` | Tag to add (batch tag) |
| `--remove <tag>` | Tag to remove (batch tag) |
| `--all` | Scan all notes for agenda (not just recent) |
| `--depth <N>` | Max hops for neighbors (default: 2) |
| `--dry-run` | Preview changes without applying (for link, relink) |
| `--days <N>` | Days to look back for timeline (default: 30) |
| `--limit <N>` | Max entries for timeline (default: 50) |

## Fuzzy Note Lookup

Commands that take a note name support fuzzy matching — no need to type the exact filename:

```bash
# Exact
clausidian read build-api

# Case-insensitive
clausidian read Build-API

# Partial match
clausidian read vector          # finds "vector-search"

# Title match
clausidian read "Build API"     # finds "build-api"
```

Works with: `read`, `delete`, `update`, `archive`, `patch`, `backlinks`, `rename`, `move`, `merge`, `pin`, `unpin`.

## Search Relevance

Search results are ranked by relevance score:

| Match Location | Score |
|---------------|-------|
| Title | 10 |
| Filename | 8 |
| Tags | 5 |
| Summary | 3 |
| Body text | 1 |

```bash
clausidian search "API"         # title matches appear first
clausidian search "API.*v2" --regex   # regex pattern matching
```

## JSON Output

All commands support `--json` for machine-readable output:

```bash
clausidian search "API" --json
clausidian stats --json
clausidian list project --status active --json
```

## Heading-Level Edits

Edit specific sections of a note without rewriting the whole file:

```bash
# Append to a section
clausidian patch "my-project" --heading "TODO" --append "- [ ] New task"

# Replace section content
clausidian patch "my-project" --heading "Notes" --replace "Updated notes here"

# Read a section
clausidian patch "my-project" --heading "TODO"
```

## MCP Server

Run as an [MCP](https://modelcontextprotocol.io/) server for AI assistants (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "clausidian": {
      "command": "clausidian",
      "args": ["serve", "--vault", "/path/to/vault"]
    }
  }
}
```

Exposes 44 tools: journal, note, capture, search, list, read, recent, delete, backlinks, update, archive, patch, stats, orphans, graph, health, sync, tag_list, tag_rename, rename, move, merge, duplicates, broken_links, batch_update, batch_tag, batch_archive, export, neighbors, random, focus, and more.

## Vault Health

```bash
clausidian health
```

Scores your vault across 4 dimensions (0-100 each):
- **Completeness** — frontmatter quality (title, type, tags, summary, created)
- **Connectivity** — links and relationships between notes
- **Freshness** — how recently notes were updated
- **Organization** — tags, types, naming conventions, summaries

## Agent Hooks

Integrate with your agent's hook system for automatic journaling:

### Claude Code

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "clausidian hook session-stop --vault ~/my-vault"
          }
        ]
      }
    ]
  }
}
```

### Cron / LaunchD

```bash
# Daily backfill — creates journal from git history
clausidian hook daily-backfill --vault ~/my-vault --scan-root ~/projects

# Weekly review
clausidian review --vault ~/my-vault

# Monthly review
clausidian review monthly --vault ~/my-vault
```

## Knowledge Precipitation (v0.9+)

Five automated rules that help knowledge settle from journals into permanent notes:

| Rule | Command | What it does |
|------|---------|-------------|
| A1: Promotion Suggestions | `review` | Scans weekly journals for topics appearing 2+ days → suggests promotion to projects/resources |
| A2: Idea Temperature | `health` | Tracks idea freshness: new, active, frozen (14d), archive (30d) |
| A3: Staleness Detection | `review monthly` | Flags resources >60d stale, active projects >30d dormant, dead ideas |
| A4: Conclusion Extraction | `hook session-stop` | Auto-tags journals with #conclusion or #resolved based on content |
| A5: Link Suggestions | `sync` | Finds note pairs sharing 2+ tags but missing related links |

These rules run automatically as part of existing commands — no extra setup needed. Over time, they ensure your vault stays organized: ideas get promoted or archived, stale notes get flagged, and connections between notes are surfaced.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OA_VAULT` | Default vault path | cwd |
| `OA_TIMEZONE` | Timezone for dates | UTC |

## Customization

### Templates
Edit files in `templates/` to customize note structure. Use `{{PLACEHOLDER}}` syntax.

### Conventions
Edit `CONVENTIONS.md` to change frontmatter rules, naming conventions, or agent behavior.

### Language
Templates ship in English. Replace template content with your preferred language — the CLI doesn't care about content language, only the `{{}}` placeholders.

## Migration from obsidian-agent

If you're upgrading from `obsidian-agent`:

```bash
npm uninstall -g obsidian-agent
npm install -g clausidian
```

The CLI commands and vault structure are fully compatible — only the binary name changed.

## Development

```bash
npm test
```

Requires Node.js >= 18. Tests use `node:test` — zero dev dependencies.

<details>
<summary><strong>Other AI Agents (Cursor, Copilot, etc.)</strong></summary>

`clausidian init` generates config files for multiple AI agents:

| Agent | Config Location |
|-------|----------------|
| Cursor | `.cursor/rules/obsidian.md` |
| GitHub Copilot | `.github/copilot/instructions.md` |
| Any agent | `AGENT.md` (universal instructions) |

All agents read `AGENT.md` which tells them to use the `clausidian` CLI. No agent-specific code needed.

</details>

## License

MIT
