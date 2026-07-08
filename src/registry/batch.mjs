/**
 * Batch commands
 */

export default [

  // ── Batch ops ──
  {
    name: 'batch',
    description: 'Batch operations on notes',
    usage: 'batch <update|tag|archive>',
    subcommands: {
      update: {
        mcpName: 'batch_update',
        description: 'Batch update matching notes',
        mcpSchema: {
          type: { type: 'string' }, tag: { type: 'string' }, status: { type: 'string' },
          set_status: { type: 'string' }, set_summary: { type: 'string' },
          set_tags: { type: 'string', description: 'Replace all tags (comma-separated)' },
          set_aliases: { type: 'string', description: 'Set aliases' },
          set_related: { type: 'string', description: 'Set related wikilinks' },
          set_maturity: { type: 'string', description: 'Set maturity level' },
          set_source: { type: 'string', description: 'Set source URL' },
          set_created: { type: 'string', description: 'Set creation date' },
        },
        async run(root, flags) {
          const { batchUpdate } = await import('../commands/batch.mjs');
          return batchUpdate(root, flags);
        },
      },
      tag: {
        mcpName: 'batch_tag',
        description: 'Batch add/remove tags',
        mcpSchema: {
          type: { type: 'string' }, tag: { type: 'string' }, status: { type: 'string' },
          add: { type: 'string' }, remove: { type: 'string' },
        },
        async run(root, flags) {
          const { batchTag } = await import('../commands/batch.mjs');
          return batchTag(root, {
            type: flags.type, tag: flags.tag, status: flags.status,
            add: flags.add, remove: flags.remove,
          });
        },
      },
      delete: {
        mcpName: 'batch_delete',
        description: 'Batch delete matching notes',
        mcpSchema: {
          type: { type: 'string' }, tag: { type: 'string' }, status: { type: 'string' },
          dry_run: { type: 'boolean', description: 'Preview only, do not delete' },
        },
        async run(root, flags) {
          const { batchDelete } = await import('../commands/batch.mjs');
          return batchDelete(root, {
            type: flags.type, tag: flags.tag, status: flags.status,
            dryRun: flags['dry-run'] || flags.dry_run,
          });
        },
      },
      archive: {
        mcpName: 'batch_archive',
        description: 'Batch archive matching notes',
        mcpSchema: {
          type: { type: 'string' }, tag: { type: 'string' }, status: { type: 'string' },
        },
        async run(root, flags) {
          const { batchArchive } = await import('../commands/batch.mjs');
          return batchArchive(root, { type: flags.type, tag: flags.tag, status: flags.status });
        },
      },
    },
  },
];
