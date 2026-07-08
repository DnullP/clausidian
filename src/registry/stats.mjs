/**
 * Stats commands
 */

export default [

  // ── Stats & analysis ──
  {
    name: 'stats',
    description: 'Show vault statistics',
    usage: 'stats',
    mcpSchema: {},
    async run(root) {
      const { stats } = await import('../commands/stats.mjs');
      return stats(root);
    },
  },,
  {
    name: 'graph',
    description: 'Generate Mermaid knowledge graph',
    usage: 'graph',
    mcpSchema: { type: { type: 'string', description: 'Filter by note type' } },
    async run(root, flags) {
      const { graph } = await import('../commands/graph.mjs');
      return graph(root, { type: flags.type });
    },
  },,
  {
    name: 'health',
    description: 'Vault health scoring',
    usage: 'health',
    mcpSchema: {},
    async run(root) {
      const { health } = await import('../commands/health.mjs');
      return health(root);
    },
  },,
  {
    name: 'sync',
    description: 'Rebuild tag and graph indices',
    usage: 'sync',
    mcpSchema: {},
    async run(root) {
      const { sync } = await import('../commands/sync.mjs');
      return sync(root);
    },
  },
];
