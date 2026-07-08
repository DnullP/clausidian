/**
 * Help text for CLI
 */
export function printHelp() {
  console.log(`
clausidian — AI agent toolkit for Obsidian vaults

Commands:
  init <path>              Initialize a new agent-friendly vault
  journal [--date DATE]    Create/open today's journal
  note <title> <type>      Create a note (area/project/resource/idea)
  capture <idea>           Quick idea capture
  read <note>              Read a note's content
  recent [days]            Show recently updated notes (default: 7 days)
  delete <note>            Delete a note and clean up references
  search <keyword>         Full-text search (supports --regex)
  list [type]              List notes with filters
  review                   Generate weekly review
  review monthly           Generate monthly review
  sync                     Rebuild tag & graph indices
  backlinks <note>         Show notes that link to a note
  update <note>            Update note frontmatter fields
  archive <note>           Set note status to archived
  stats                    Show vault statistics
  graph                    Generate Mermaid knowledge graph
  orphans                  Find notes with no inbound links
  patch <note>             Edit a section by heading
  tag list                 List all tags with counts
  tag rename <old> <new>   Rename a tag across the vault

  rename <note> <title>    Rename a note and update all references
  move <note> <type>       Move note to a different type/directory
  merge <source> <target>  Merge source note into target
  duplicates               Find potentially duplicate notes
  broken-links             Find broken [[wikilinks]]

  batch update [filters]   Batch update notes (--set-status, --set-summary)
  batch tag [filters]      Batch add/remove tags (--add, --remove)
  batch archive [filters]  Batch archive matching notes

  export [output]          Export notes (--format json|markdown)
  import <file>            Import notes from JSON or markdown

  link                     Auto-link related but unlinked notes
  timeline                 Chronological activity feed
  validate                 Check frontmatter completeness
  pin <note>               Pin a note as favorite
  unpin <note>             Unpin a note
  pin list                 Show all pinned notes
  relink                   Fix broken links with closest matches
  suggest                  Actionable vault improvement suggestions
  daily                    Daily dashboard (journal, activity, pinned)
  count                    Word/line/note count statistics
  agenda                   Pending TODO items from journals & projects
  changelog [output]       Generate vault changelog from recent activity
  neighbors <note>         Show connected notes within N hops (--depth)
  random [count]           Pick random note(s) for review
  focus                    Suggest what to work on next

  setup [vault-path]       Install MCP server + skill
  watch                    Auto-rebuild indices on file changes
  health                   Vault health scoring report
  serve                    Start MCP server (stdio transport)
  hook <event>             Handle agent hook events

Flags:
  --vault <path>           Vault root (default: cwd or $OA_VAULT)
  --type <type>            Filter by note type
  --tag <tag>              Filter by tag
  --status <status>        Filter by status
  --recent <days>          Show notes updated in last N days
  --date <YYYY-MM-DD>      Specify date for journal/review
  --regex                  Treat search keyword as regex
  --threshold <0-1>        Duplicate similarity threshold (default: 0.5)
  --format <json|md>       Export format (default: json)
  --set-status <status>    For batch update
  --add <tag>              For batch tag (add tag)
  --remove <tag>           For batch tag (remove tag)
  --json                   Output as JSON (machine-readable)
`);
}
