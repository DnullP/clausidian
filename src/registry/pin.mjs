/**
 * Pin commands
 */

export default [

  // ── Pin ──
  {
    name: 'pin',
    description: 'Pin a note as favorite',
    usage: 'pin <note|list>',
    mcpSchema: { note: { type: 'string' } },
    mcpRequired: ['note'],
    subcommands: {
      list: {
        mcpName: 'pin_list',
        description: 'Show all pinned notes',
        mcpSchema: {},
        async run(root) {
          const { listPinned } = await import('../commands/pin.mjs');
          return listPinned(root);
        },
      },
    },
    async run(root, flags, pos) {
      if (pos[0] === 'list') {
        const { listPinned } = await import('../commands/pin.mjs');
        return listPinned(root);
      }
      const { pin } = await import('../commands/pin.mjs');
      return pin(root, flags.note || pos[0]);
    },
  },,
  {
    name: 'unpin',
    description: 'Unpin a note',
    usage: 'unpin <note>',
    mcpSchema: { note: { type: 'string' } },
    mcpRequired: ['note'],
    async run(root, flags, pos) {
      const { unpin } = await import('../commands/pin.mjs');
      return unpin(root, flags.note || pos[0]);
    },
  },
];
