/**
 * Io commands
 */

export default [

  // ── Import/Export ──
  {
    name: 'export',
    description: 'Export notes to JSON or markdown',
    usage: 'export [output]',
    mcpSchema: {
      type: { type: 'string' }, tag: { type: 'string' }, status: { type: 'string' },
      format: { type: 'string', enum: ['json', 'markdown'] },
      output: { type: 'string', description: 'Output file path' },
    },
    async run(root, flags, pos) {
      const { exportNotes } = await import('../commands/export.mjs');
      return exportNotes(root, {
        type: flags.type, tag: flags.tag, status: flags.status,
        format: flags.format, output: flags.output || pos[0],
      });
    },
  },,
  {
    name: 'import',
    description: 'Import notes from JSON or markdown',
    usage: 'import <file>',
    async run(root, flags, pos) {
      const { importNotes } = await import('../commands/import.mjs');
      return importNotes(root, pos[0]);
    },
  },
];
