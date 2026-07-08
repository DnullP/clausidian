/**
 * Structure commands
 */

export default [
  {
    name: 'duplicates',
    description: 'Find potentially duplicate notes',
    usage: 'duplicates',
    mcpSchema: { threshold: { type: 'number', description: 'Similarity threshold 0-1 (default: 0.5)' } },
    async run(root, flags) {
      const { duplicates } = await import('../commands/duplicates.mjs');
      return duplicates(root, { threshold: flags.threshold ? parseFloat(flags.threshold) : undefined });
    },
  },,
  {
    name: 'broken-links',
    description: 'Find broken [[wikilinks]]',
    usage: 'broken-links',
    mcpName: 'broken_links',
    mcpSchema: {},
    async run(root) {
      const { brokenLinks } = await import('../commands/broken-links.mjs');
      return brokenLinks(root);
    },
  },
];
