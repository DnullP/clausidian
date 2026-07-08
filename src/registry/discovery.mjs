/**
 * Discovery commands
 */

export default [
  {
    name: 'suggest',
    description: 'Actionable vault improvement suggestions',
    usage: 'suggest',
    mcpSchema: { limit: { type: 'number', description: 'Max suggestions (default: 10)' } },
    async run(root, flags) {
      const { suggest } = await import('../commands/suggest.mjs');
      return suggest(root, { limit: flags.limit ? parseInt(flags.limit) : undefined });
    },
  },,
  {
    name: 'daily',
    description: 'Daily dashboard (journal status, activity, pinned, projects)',
    usage: 'daily',
    mcpSchema: {},
    async run(root) {
      const { daily } = await import('../commands/daily.mjs');
      return daily(root);
    },
  },,
  {
    name: 'auto-tag',
    description: 'Auto-suggest TF-IDF tags for untagged notes',
    usage: 'auto-tag [--dry-run]',
    mcpSchema: { dry_run: { type: 'boolean', description: 'Preview suggestions only' } },
    async run(root, flags) {
      const { autoTag } = await import('../commands/auto-tag.mjs');
      return autoTag(root, { dryRun: flags['dry-run'] === true || flags.dry_run === true });
    },
  },,
  {
    name: 'stale',
    description: 'Find notes inactive for N days',
    usage: 'stale [--threshold N] [--auto-archive]',
    mcpSchema: {
      threshold: { type: 'number', description: 'Days threshold (default: 30)' },
      auto_archive: { type: 'boolean', description: 'Archive stale notes' },
    },
    async run(root, flags) {
      const { stale } = await import('../commands/stale.mjs');
      return stale(root, {
        threshold: flags.threshold ? parseInt(flags.threshold) : undefined,
        autoArchive: flags['auto-archive'] === true || flags.auto_archive === true,
      });
    },
  },,
  {
    name: 'count',
    description: 'Word/line/note count statistics',
    usage: 'count',
    mcpSchema: { type: { type: 'string', description: 'Filter by note type' } },
    async run(root, flags) {
      const { count } = await import('../commands/count.mjs');
      return count(root, { type: flags.type });
    },
  },,
  {
    name: 'agenda',
    description: 'Pending TODO items from journals and projects',
    usage: 'agenda',
    mcpSchema: {
      days: { type: 'number', description: 'Days to scan (default: 7)' },
      all: { type: 'boolean', description: 'Scan all notes, not just recent' },
    },
    async run(root, flags) {
      const { agenda } = await import('../commands/agenda.mjs');
      return agenda(root, {
        days: flags.days ? parseInt(flags.days) : undefined,
        all: flags.all === true,
      });
    },
  },,
  {
    name: 'changelog',
    description: 'Generate vault changelog from recent activity',
    usage: 'changelog [output]',
    mcpSchema: { days: { type: 'number', description: 'Days (default: 7)' } },
    async run(root, flags, pos) {
      const { changelog } = await import('../commands/changelog.mjs');
      return changelog(root, { days: flags.days ? parseInt(flags.days) : undefined, output: pos[0] });
    },
  },,
  {
    name: 'neighbors',
    description: 'Show connected notes within N hops',
    usage: 'neighbors <note>',
    mcpSchema: {
      note: { type: 'string' },
      depth: { type: 'number', description: 'Max hops (default: 2)' },
    },
    mcpRequired: ['note'],
    async run(root, flags, pos) {
      const { neighbors } = await import('../commands/neighbors.mjs');
      return neighbors(root, flags.note || pos[0], {
        depth: flags.depth ? parseInt(flags.depth) : undefined,
      });
    },
  },,
  {
    name: 'random',
    description: 'Pick random note(s) for serendipitous review',
    usage: 'random [count]',
    mcpSchema: {
      count: { type: 'number', description: 'How many (default: 1)' },
      type: { type: 'string' }, status: { type: 'string' },
    },
    async run(root, flags, pos) {
      const { random } = await import('../commands/random.mjs');
      return random(root, {
        count: flags.count ? parseInt(flags.count) : pos[0] ? parseInt(pos[0]) : undefined,
        type: flags.type, status: flags.status,
      });
    },
  },,
  {
    name: 'focus',
    description: 'Suggest what to work on next',
    usage: 'focus',
    mcpSchema: {},
    async run(root) {
      const { focus } = await import('../commands/focus.mjs');
      return focus(root);
    },
  },
];
