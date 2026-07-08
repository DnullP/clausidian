/**
 * Integration commands — Memory system + CLAUDE.md management
 * v3.6.0: Dynamic memory graph, session memory, bidirectional sync
 */

export default [
  // ── Memory System (legacy + enhanced) ──
  {
    name: 'memory',
    description: 'Dynamic vault-memory management (sync, graph, session, lifecycle, semantic search)',
    usage: 'memory <sync|push|status|full-sync|graph|session|lifecycle|context|semantic>',
    subcommands: {
      sync: {
        mcpName: 'memory_sync',
        description: 'Sync all memory:true notes to Claude memory',
        mcpSchema: { dry_run: { type: 'boolean', description: 'Preview without writing' } },
        async run(root, flags) {
          const { memorySync } = await import('../commands/memory.mjs');
          return memorySync(root, { dryRun: flags.dry_run === true });
        },
      },
      push: {
        mcpName: 'memory_push',
        description: 'Push a specific note to Claude memory',
        mcpSchema: { note: { type: 'string', description: 'Note filename' } },
        mcpRequired: ['note'],
        async run(root, flags, pos) {
          const { memoryPush } = await import('../commands/memory.mjs');
          return memoryPush(root, flags.note || pos[0]);
        },
      },
      status: {
        mcpName: 'memory_status',
        description: 'Show vault-memory sync status',
        mcpSchema: {},
        async run(root) {
          const { memoryStatus } = await import('../commands/memory.mjs');
          return memoryStatus(root);
        },
      },
      'full-sync': {
        mcpName: 'memory_full_sync',
        description: 'Full bidirectional sync with graph + lifecycle',
        mcpSchema: {},
        async run(root) {
          const { memoryFullSync } = await import('../commands/memory.mjs');
          return memoryFullSync(root);
        },
      },
      graph: {
        mcpName: 'memory_graph',
        description: 'Memory graph operations (stats|sync|neighbors|query|connections|hubs|decay)',
        mcpSchema: {
          action: { type: 'string', enum: ['stats', 'sync', 'neighbors', 'query', 'connections', 'hubs', 'decay'], description: 'Graph action' },
          node: { type: 'string', description: 'Node ID for neighbors/connections' },
          query: { type: 'string', description: 'Search query' },
          depth: { type: 'number', description: 'Traversal depth (default: 2)' },
          limit: { type: 'number', description: 'Max results (default: 10)' },
        },
        mcpRequired: ['action'],
        async run(root, flags, pos) {
          const { memoryGraph } = await import('../commands/memory.mjs');
          const action = flags.action || pos[0] || 'stats';
          return memoryGraph(root, action, flags);
        },
      },
      session: {
        mcpName: 'memory_session',
        description: 'Session memory operations (start|end|stats|recent|pending|learnings|context|cleanup)',
        mcpSchema: {
          action: { type: 'string', enum: ['start', 'end', 'stats', 'recent', 'pending', 'learnings', 'context', 'cleanup'], description: 'Session action' },
          topic: { type: 'string', description: 'Session topic' },
          notes: { type: 'string', description: 'Comma-separated active notes' },
          decisions: { type: 'string', description: 'Semicolon-separated decisions' },
          learnings: { type: 'string', description: 'Semicolon-separated learnings' },
          steps: { type: 'string', description: 'Semicolon-separated next steps' },
          days: { type: 'number', description: 'Days to look back (default: 7)' },
        },
        mcpRequired: ['action'],
        async run(root, flags, pos) {
          const { memorySession } = await import('../commands/memory.mjs');
          const action = flags.action || pos[0] || 'stats';
          return memorySession(root, action, flags);
        },
      },
      lifecycle: {
        mcpName: 'memory_lifecycle',
        description: 'Memory lifecycle operations (promote|stale|maintenance|diagnostics)',
        mcpSchema: {
          action: { type: 'string', enum: ['promote', 'stale', 'maintenance', 'diagnostics'], description: 'Lifecycle action' },
          days: { type: 'number', description: 'Age threshold in days (default: 30)' },
        },
        mcpRequired: ['action'],
        async run(root, flags, pos) {
          const { memoryLifecycle } = await import('../commands/memory.mjs');
          const action = flags.action || pos[0] || 'diagnostics';
          return memoryLifecycle(root, action, flags);
        },
      },
      context: {
        mcpName: 'memory_context',
        description: 'Get unified context for a topic (graph + sessions + vault)',
        mcpSchema: {
          topic: { type: 'string', description: 'Topic to search for' },
          depth: { type: 'number', description: 'Relationship depth (default: 2)' },
          max_results: { type: 'number', description: 'Max results (default: 10)' },
        },
        mcpRequired: ['topic'],
        async run(root, flags, pos) {
          const { contextForTopic } = await import('../commands/memory.mjs');
          return contextForTopic(root, flags.topic || pos[0], { depth: flags.depth, maxResults: flags.max_results });
        },
      },
      semantic: {
        mcpName: 'memory_semantic_search',
        description: 'Semantic similarity search — find notes by meaning using TF-IDF vectors',
        mcpSchema: {
          query: { type: 'string', description: 'Search query text' },
          k: { type: 'number', description: 'Max results (default: 10)' },
        },
        mcpRequired: ['query'],
        async run(root, flags, pos) {
          const { memorySemanticSearch } = await import('../commands/memory.mjs');
          const query = flags.query || pos[0];
          if (!query) throw new Error('Query text is required');
          const result = memorySemanticSearch(root, query, { k: flags.k || 10 });
          console.log(JSON.stringify(result, null, 2));
          return result;
        },
      },
    },
    async run(root, flags, pos) {
      const subcmd = pos[0] || 'status';
      if (!this.subcommands[subcmd]) throw new Error(`Unknown subcommand: ${subcmd}. Available: ${Object.keys(this.subcommands).join(', ')}`);
      return this.subcommands[subcmd].run(root, flags, pos.slice(1));
    },
  },
  // ── CLAUDE.md Management ──
  {
    name: 'claude-md',
    description: 'Manage vault context in CLAUDE.md files',
    usage: 'claude-md <generate|inject|remove>',
    subcommands: {
      generate: {
        mcpName: 'claude_md_generate',
        description: 'Output vault CLAUDE.md block to stdout',
        mcpSchema: {},
        async run(root) {
          const { generate } = await import('../commands/claude-md.mjs');
          return generate(root);
        },
      },
      inject: {
        mcpName: 'claude_md_inject',
        description: 'Inject vault block into CLAUDE.md',
        mcpSchema: {
          global: { type: 'boolean', description: 'Target ~/.claude/CLAUDE.md' },
          path: { type: 'string', description: 'Target CLAUDE.md path' },
        },
        async run(root, flags) {
          const { inject } = await import('../commands/claude-md.mjs');
          return inject(root, { global: flags.global === true, path: flags.path });
        },
      },
      remove: {
        mcpName: 'claude_md_remove',
        description: 'Remove clausidian block from CLAUDE.md',
        mcpSchema: {
          global: { type: 'boolean' },
          path: { type: 'string' },
        },
        async run(root, flags) {
          const { remove } = await import('../commands/claude-md.mjs');
          return remove(root, { global: flags.global === true, path: flags.path });
        },
      },
    },
    async run(root, flags, pos) {
      const subcmd = pos[0] || 'generate';
      if (!this.subcommands[subcmd]) throw new Error(`Unknown subcommand: ${subcmd}`);
      return this.subcommands[subcmd].run(root, flags, pos.slice(1));
    },
  },
];
