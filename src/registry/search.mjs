/**
 * Search commands
 */

export default [

  // ── Search & List ──
  {
    name: 'search',
    description: 'Full-text search across all notes (supports regex)',
    usage: 'search <keyword>',
    mcpSchema: {
      keyword: { type: 'string', description: 'Search keyword or regex pattern' },
      type: { type: 'string', description: 'Filter by note type' },
      tag: { type: 'string', description: 'Filter by tag' },
      status: { type: 'string', description: 'Filter by status' },
      regex: { type: 'boolean', description: 'Treat keyword as regex pattern' },
    },
    mcpRequired: ['keyword'],
    async run(root, flags, pos) {
      const { search } = await import('../commands/search.mjs');
      return search(root, flags.keyword || pos[0], {
        type: flags.type, tag: flags.tag, status: flags.status,
        regex: flags.regex === true,
      });
    },
  },,
  {
    name: 'list',
    description: 'List notes with optional filters',
    usage: 'list [type]',
    mcpSchema: {
      type: { type: 'string', description: 'Filter by type' },
      tag: { type: 'string', description: 'Filter by tag' },
      status: { type: 'string', description: 'Filter by status' },
      recent: { type: 'number', description: 'Show notes updated in last N days' },
    },
    async run(root, flags, pos) {
      const { list } = await import('../commands/list.mjs');
      return list(root, {
        type: flags.type || pos[0], tag: flags.tag, status: flags.status,
        recent: flags.recent ? parseInt(flags.recent) : undefined,
      });
    },
  },,
  {
    name: 'recent',
    description: 'Show recently updated notes',
    usage: 'recent [days]',
    mcpSchema: { days: { type: 'number', description: 'Number of days (default: 7)' } },
    async run(root, flags, pos) {
      const { recent } = await import('../commands/recent.mjs');
      return recent(root, {
        days: flags.days ? parseInt(flags.days) : pos[0] ? parseInt(pos[0]) : 7,
      });
    },
  },,
  {
    name: 'backlinks',
    description: 'Show notes that link to a given note',
    usage: 'backlinks <note>',
    mcpSchema: { note: { type: 'string', description: 'Note filename (without .md)' } },
    mcpRequired: ['note'],
    async run(root, flags, pos) {
      const { backlinks } = await import('../commands/backlinks.mjs');
      return backlinks(root, flags.note || pos[0]);
    },
  },,
  {
    name: 'orphans',
    description: 'Find notes with no inbound links',
    usage: 'orphans',
    mcpSchema: {},
    async run(root) {
      const { orphans } = await import('../commands/orphans.mjs');
      return orphans(root);
    },
  },
];
