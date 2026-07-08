/**
 * Shortcuts commands
 */

export default [
  {
    name: 'open',
    description: 'Open a note in Obsidian.app (macOS)',
    usage: 'open [note] [--reveal]',
    mcpSchema: {
      note: { type: 'string', description: 'Note filename (opens vault root if omitted)' },
      reveal: { type: 'boolean', description: 'Reveal in file explorer instead of opening' },
    },
    async run(root, flags, pos) {
      const { open } = await import('../commands/open.mjs');
      return open(root, flags.note || pos[0], { reveal: flags.reveal === true });
    },
  },,
  {
    name: 'quicknote',
    description: 'Capture from clipboard as an idea note',
    usage: 'quicknote [--title TITLE]',
    mcpSchema: {
      title: { type: 'string', description: 'Optional title override' },
    },
    async run(root, flags) {
      const { quicknote } = await import('../commands/quicknote.mjs');
      return quicknote(root, { title: flags.title });
    },
  },,
  // ── Bridge (cross-system integrations) ──
  {
    name: 'bridge',
    description: 'Sync external systems (Google Calendar, Gmail, GitHub) to vault',
    usage: 'bridge <gcal|gmail|github> [--date DATE]',
    subcommands: {
      gcal: {
        mcpName: 'bridge_gcal',
        description: 'Sync Google Calendar events to journal',
        mcpSchema: {
          date: { type: 'string', description: 'Date to sync (YYYY-MM-DD, default: today)' },
        },
        async run(root, flags) {
          const { bridgeGcal } = await import('../commands/bridge.mjs');
          return bridgeGcal(root, { date: flags.date });
        },
      },
      gmail: {
        mcpName: 'bridge_gmail',
        description: 'Sync Gmail messages to vault',
        mcpSchema: {
          label: { type: 'string', description: 'Gmail label (default: important)' },
          days: { type: 'number', description: 'Look back N days (default: 1)' },
        },
        async run(root, flags) {
          const { bridgeGmail } = await import('../commands/bridge.mjs');
          return bridgeGmail(root, { label: flags.label, days: flags.days });
        },
      },
      github: {
        mcpName: 'bridge_github',
        description: 'Sync GitHub activity to vault',
        mcpSchema: {
          repo: { type: 'string', description: 'Repository (owner/repo)' },
          days: { type: 'number', description: 'Look back N days (default: 1)' },
        },
        async run(root, flags) {
          const { bridgeGithub } = await import('../commands/bridge.mjs');
          return bridgeGithub(root, { repo: flags.repo, days: flags.days });
        },
      },
    },
  },,
  {
    name: 'cache',
    description: 'Manage search cache (stats, clear)',
    usage: 'cache <stats|clear>',
    mcpSchema: {
      subcommand: { type: 'string', enum: ['stats', 'clear'], description: 'Subcommand: stats or clear' },
    },
    mcpRequired: ['subcommand'],
    async run(root, flags) {
      const { cache } = await import('../commands/cache.mjs');
      return cache(root, { subcommand: flags.subcommand });
    },
  },
];
