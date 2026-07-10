#!/usr/bin/env python3
"""PreToolUse hook: block direct Write/Edit/Bash on vault notes, route to clausidian MCP.

Allows:
  - System files (_tags, _graph, _index)
  - Config files (AGENT.md, CONVENTIONS.md, templates/*.md, .gitignore)
  - Hidden dirs (.obsidian/, .claude/, .clausidian/, .cursor/, .github/)
  - Non-.md files

Denies:
  - Write/Edit on vault content .md files (projects/, areas/, resources/, journal/, ideas/)
  - Bash commands that write to vault content .md files
"""

import sys, json, os, re

VAULT = os.environ.get("OA_VAULT", os.getcwd())

# Content directories managed by clausidian
CONTENT_DIRS = ("projects/", "areas/", "resources/", "journal/", "ideas/")

# Files/dirs allowed to be edited directly
ALLOWLIST_DIRS = (
    ".obsidian", ".claude", ".clausidian", ".cursor", ".github",
    "templates",
)
ALLOWLIST_FILES = (
    "AGENT.md", "CONVENTIONS.md", ".gitignore",
    "_tags.md", "_graph.md", "_index.md",
)

MCP_GUIDE = """Direct Write/Edit on vault notes is blocked. Use clausidian MCP tools instead:

| Operation | MCP Tool |
|-----------|----------|
| Create a note | `mcp__clausidian__note` (title, type, tags, summary) |
| Read a note | `mcp__clausidian__read` (note, section?) |
| Edit any frontmatter | `mcp__clausidian__update` (note, aliases?, related?, maturity?, created?, source?, status?, tags?, summary?) |
| Edit section content | `mcp__clausidian__patch` (note, heading, append?/prepend?/replace?/match_text?, after_line?/before_line?, delete_section?, auto-creates missing headings) |
| Quick capture idea | `mcp__clausidian__capture` (idea) |
| Create journal | `mcp__clausidian__journal` (date?) |
| Rename note | `mcp__clausidian__rename` (note, new_title) |
| Move note | `mcp__clausidian__move` (note, new_type/subdir) |
| Delete note | `mcp__clausidian__delete` (note) |
| Batch update | `mcp__clausidian__batch_update` (type?, tag?, status?, set_*) |
| Batch delete | `mcp__clausidian__batch_delete` (type?, tag?, status?, dry_run?) |
| Batch tag/archive | `mcp__clausidian__batch_tag` / `mcp__clausidian__batch_archive` |
| Validate vault | `mcp__clausidian__validate` () |
| Search vault | `mcp__clausidian__search` (keyword, type?, tag?) |
| Vault health | `mcp__clausidian__health` () |
| Sync indices | `mcp__clausidian__sync` () |
| List notes | `mcp__clausidian__list` (type?, tag?, status?) |
| Backlinks/graph | `mcp__clausidian__backlinks` / `mcp__clausidian__neighbors` / `mcp__clausidian__graph` |

Exception: for operations no MCP tool covers,
use Bash with the admission marker `# clausidian-edit-ok` as a shell comment.
The marker authorizes the write without polluting file contents."""

CLI_TO_MCP_GUIDE = """Bash with clausidian CLI is blocked. Use MCP tools directly:

| CLI Command | MCP Tool |
|-------------|----------|
| clausidian search "..." | `mcp__clausidian__search` (keyword, type?, tag?) |
| clausidian read "note" | `mcp__clausidian__read` (note, section?) |
| clausidian list | `mcp__clausidian__list` (type?, tag?, status?) |
| clausidian daily | `mcp__clausidian__daily` () |
| clausidian journal | `mcp__clausidian__journal` (date?) |
| clausidian note "..." | `mcp__clausidian__note` (title, type, tags, summary) |
| clausidian review | `mcp__clausidian__review` () |
| clausidian stats | `mcp__clausidian__stats` () |
| clausidian health | `mcp__clausidian__health` () |
| clausidian sync | `mcp__clausidian__sync` () |

All vault operations go through MCP, not shell."""


def is_vault_content(file_path):
    """Check if file_path targets a vault content markdown file."""
    if not file_path.endswith(".md"):
        return False

    rel = os.path.relpath(file_path, VAULT)
    if rel.startswith(".."):
        return False  # Outside vault

    basename = os.path.basename(file_path)

    # Allow system files
    if basename in ALLOWLIST_FILES:
        return False

    # Allow hidden dirs and templates
    for d in ALLOWLIST_DIRS:
        if rel.startswith(d) or rel.startswith(d + "/"):
            return False

    # Content directories
    for d in CONTENT_DIRS:
        if rel.startswith(d):
            return True

    return False


EDIT_MARKER = "# clausidian-edit-ok:"
EDIT_MARKER_RE = re.compile(r"# clausidian-edit-ok:\s*([^\s][^\"|;&]+)")

# Whitelist of valid reasons for the admission marker.
# Agent must pick one of these — if the reason doesn't match, the hook returns
# the full list so the agent can retry with a valid one instead of guessing.
VALID_EDIT_REASONS = {
    "run scan-resources compliance check",
    "cleanup orphaned clausidian-edit-ok markers left in vault files",
}


def extract_target_path(data):
    """Extract the file path being written to."""
    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {})

    if tool_name in ("Write", "Edit"):
        return tool_input.get("file_path", "")

    if tool_name == "Bash":
        command = tool_input.get("command", "")
        # Shell comment marker authorizes writes — must include a reason
        # (marker itself contains "clausidian", so check it first)
        m = EDIT_MARKER_RE.search(command)
        if m:
            reason = m.group(1).strip()
            if reason in VALID_EDIT_REASONS:
                return ""  # Allow
            if len(reason) < 5:
                return "__EDIT_MARKER_NO_REASON__"
            return "__EDIT_MARKER_INVALID_REASON__"
        # Python scripts that touch vault .md files must also carry the marker
        m_py = re.search(r'python3\s+(\S+\.py)', command)
        if m_py:
            script_path = m_py.group(1)
            if not os.path.isabs(script_path):
                script_path = os.path.join(VAULT, script_path)
            # Exempt our own compliance tooling
            script_rel = os.path.relpath(script_path, VAULT) if os.path.isabs(script_path) else script_path
            if not script_rel.startswith((".claude/", ".clausidian/", ".obsidian/")):
                try:
                    with open(script_path) as sf:
                        script_src = sf.read()
                    if re.search(r'["\x27](?:' + VAULT.replace('/', r'\/') + r')?[^"\x27]*/(?:' +
                                 '|'.join(CONTENT_DIRS).replace('/', r'\/') +
                                 r')[^"\x27]*\.md["\x27]', script_src):
                        return "__PYTHON_SCRIPT_VAULT_WRITE__"
                except (FileNotFoundError, PermissionError, OSError):
                    pass

        # Block all clausidian CLI usage — must go through MCP
        if "clausidian" in command:
            return "__CLAUSIDIAN_CLI__"
        # Allow mv/cp within vault content dirs — these are reorganization, not content creation
        # Needed because clausidian move only supports cross-type moves, not same-type subdirectory moves
        for pat in [
            r"\bmv\s+.*?([\w./-]+\.md)",
            r"\bcp\s+.*?([\w./-]+\.md)",
        ]:
            m = re.search(pat, command)
            if m:
                target = m.group(1)
                target_abs = os.path.join(VAULT, target) if not os.path.isabs(target) else target
                if is_vault_content(target_abs):
                    return ""  # Allow — just reorganization
                return target

        # Block destructive writes: >, >>, cat, echo, tee, touch, install, etc
        for pat in [
            r"(?:^|[|;])\s*(?:cat|echo|tee|printf|touch|install)\s+.*?([\w./-]+\.md)",
            r">\s*([\w./-]+\.md)",
            r">>\s*([\w./-]+\.md)",
        ]:
            m = re.search(pat, command)
            if m:
                return m.group(1)
        return ""

    return ""


def main():
    try:
        data = json.loads(sys.stdin.read())
    except (json.JSONDecodeError, Exception):
        sys.exit(0)

    tool_name = data.get("tool_name", "")
    file_path = extract_target_path(data)

    # Block clausidian CLI usage in Bash → must use MCP
    if file_path == "__CLAUSIDIAN_CLI__":
        command = data.get("tool_input", {}).get("command", "")
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": (
                    f"BLOCKED: clausidian CLI in Bash (`{command}`).\n\n"
                    f"{CLI_TO_MCP_GUIDE}"
                ),
            }
        }
        print(json.dumps(output))
        sys.exit(0)

    # Python script writes to vault without marker
    if file_path == "__PYTHON_SCRIPT_VAULT_WRITE__":
        command = data.get("tool_input", {}).get("command", "")
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": (
                    "BLOCKED: Python script writes to vault .md files without admission marker.\n"
                    f"Add `# clausidian-edit-ok: <reason>` to your Bash command.\n"
                    f"Command: `{command[:120]}{'...' if len(command) > 120 else ''}`"
                ),
            }
        }
        print(json.dumps(output))
        sys.exit(0)

    # Edit marker without a real reason
    if file_path == "__EDIT_MARKER_NO_REASON__":
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": (
                    "BLOCKED: `# clausidian-edit-ok:` requires a specific reason.\n"
                    "Format: `# clausidian-edit-ok: <reason>`\n"
                    "Pick one of the valid reasons listed below."
                ),
            }
        }
        print(json.dumps(output))
        sys.exit(0)

    # Edit marker with a reason not in the whitelist → return valid reasons
    if file_path == "__EDIT_MARKER_INVALID_REASON__":
        cmd = data.get("tool_input", {}).get("command", "")
        m = EDIT_MARKER_RE.search(cmd)
        used_reason = m.group(1).strip() if m else "?"
        valid_list = "\n".join(f"  - {r}" for r in sorted(VALID_EDIT_REASONS))
        output = {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": (
                    f"BLOCKED: `# clausidian-edit-ok:` reason \"{used_reason}\" is not in the whitelist.\n"
                    f"Valid reasons:\n"
                    f"{valid_list}"
                ),
            }
        }
        print(json.dumps(output))
        sys.exit(0)

    if not file_path:
        sys.exit(0)

    # Resolve relative paths against vault root
    if not os.path.isabs(file_path):
        file_path = os.path.join(VAULT, file_path)

    if not is_vault_content(file_path):
        sys.exit(0)

    # Deny Write/Edit on vault content — route to MCP
    # (Bash writes with # clausidian-edit-ok marker are already allowed above)
    rel = os.path.relpath(file_path, VAULT)
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                f"BLOCKED: Direct {tool_name} on `{rel}`.\n\n"
                f"{MCP_GUIDE}"
            ),
        }
    }
    print(json.dumps(output))
    sys.exit(0)


if __name__ == "__main__":
    main()
