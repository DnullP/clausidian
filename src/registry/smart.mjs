/**
 * Smart commands
 */

export default [

  // ── Smart maintenance ──
  {
    name: 'link',
    description: 'Auto-link related but unlinked notes (TF-IDF weighted)',
    usage: 'link [--dry-run] [--threshold N] [--top N]',
    mcpSchema: {
      dry_run: { type: 'boolean', description: 'Preview only, do not write' },
      threshold: { type: 'number', description: 'Min TF-IDF score (default: 1.5)' },
      top: { type: 'number', description: 'Max links to create (default: 10)' },
    },
    async run(root, flags) {
      const { link } = await import('../commands/link.mjs');
      return link(root, {
        dryRun: flags['dry-run'] === true || flags.dry_run === true,
        threshold: flags.threshold ? parseFloat(flags.threshold) : undefined,
        top: flags.top ? parseInt(flags.top) : undefined,
      });
    },
  },,
  {
    name: 'validate',
    description: 'Check frontmatter completeness',
    usage: 'validate',
    mcpSchema: {},
    async run(root) {
      const { validate } = await import('../commands/validate.mjs');
      return validate(root);
    },
  },,
  {
    name: 'relink',
    description: 'Fix broken links with closest matches',
    usage: 'relink',
    mcpSchema: { dry_run: { type: 'boolean', description: 'Preview only' } },
    async run(root, flags) {
      const { relink } = await import('../commands/relink.mjs');
      return relink(root, { dryRun: flags['dry-run'] === true || flags.dry_run === true });
    },
  },
];
