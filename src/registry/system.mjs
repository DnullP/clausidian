/**
 * System commands
 */

export default [

  // ── Utility ──
  {
    name: 'setup',
    description: 'Install MCP server + skill',
    usage: 'setup [vault-path]',
    async run(root, flags, pos) {
      const { setup } = await import('../commands/setup.mjs');
      return setup(pos[0]);
    },
  },,
  {
    name: 'watch',
    description: 'Auto-rebuild indices on file changes',
    usage: 'watch',
    noReturn: true,
    async run(root) {
      const { watch } = await import('../commands/watch.mjs');
      return watch(root);
    },
  },,
  {
    name: 'hook',
    description: 'Handle agent hook events',
    usage: 'hook <event>',
    async run(root, flags, pos) {
      const event = pos[0];

      // Centralized stdin JSON parsing for all hook events
      let payload = {};
      try {
        const stdin = readFileSync('/dev/stdin', 'utf8');
        if (stdin.trim()) {
          payload = JSON.parse(stdin);
        }
      } catch (err) {
        // Silent failure for stdin read (may not be piped)
        // JSON parse error will be caught below
      }

      try {
        const { sessionStart, sessionStop, preToolUse, dailyBackfill, noteCreated, noteUpdated, noteDeleted, indexRebuilt } = await import('../commands/hook.mjs');

        if (event === 'session-start') {
          return sessionStart(root, payload);
        } else if (event === 'session-stop') {
          return sessionStop(root, { ...payload, scanRoot: flags['scan-root'] });
        } else if (event === 'pre-tool-use') {
          return preToolUse(root, payload);
        } else if (event === 'daily-backfill') {
          return dailyBackfill(root, {
            ...payload, date: flags.date, scanRoot: flags['scan-root'], force: flags.force === true,
          });
        } else if (event === 'note-created') {
          return noteCreated(root, payload);
        } else if (event === 'note-updated') {
          return noteUpdated(root, payload);
        } else if (event === 'note-deleted') {
          return noteDeleted(root, payload);
        } else if (event === 'index-rebuilt') {
          return indexRebuilt(root, payload);
        }
        throw new Error(`Unknown hook event: ${event}\nAvailable: session-start, session-stop, pre-tool-use, daily-backfill, note-created, note-updated, note-deleted, index-rebuilt`);
      } catch (err) {
        // Hook failure doesn't block main flow (best-effort)
        console.error(`[hook error] ${err.message}`);
        return { status: 'error', event, error: err.message };
      }
    },
  },,
  {
    name: 'serve',
    description: 'Start MCP server (stdio transport)',
    usage: 'serve',
    noReturn: true,
    async run(root) {
      const { McpServer } = await import('../mcp-server.mjs');
      const server = new McpServer(root);
      server.start();
    },
  },
];
