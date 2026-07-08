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
        },
        async run(root, flags) {
          const { batchUpdate } = await import('../commands/batch.mjs');
          return batchUpdate(root, {
            type: flags.type, tag: flags.tag, status: flags.status,
            setStatus: flags['set-status'] || flags.set_status,
            setSummary: flags['set-summary'] || flags.set_summary,
          });
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
