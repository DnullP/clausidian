/**
 * Tags commands
 */

export default [

  // ── Tags ──
  {
    name: 'tag',
    description: 'Tag operations',
    usage: 'tag <list|rename>',
    subcommands: {
      list: {
        mcpName: 'tag_list',
        description: 'List all tags with counts',
        mcpSchema: {},
        async run(root) {
          const { tagList } = await import('../commands/tag.mjs');
          return tagList(root);
        },
      },
      rename: {
        mcpName: 'tag_rename',
        description: 'Rename a tag across the vault',
        mcpSchema: { old_tag: { type: 'string' }, new_tag: { type: 'string' } },
        mcpRequired: ['old_tag', 'new_tag'],
        async run(root, flags, pos) {
          const { tagRename } = await import('../commands/tag.mjs');
          return tagRename(root, flags.old_tag || pos[0], flags.new_tag || pos[1]);
        },
      },
    },
    async run(root, flags, pos) {
      const sub = pos[0];
      if (sub === 'rename') {
        const { tagRename } = await import('../commands/tag.mjs');
        return tagRename(root, pos[1], pos[2]);
      } else if (sub === 'list') {
        const { tagList } = await import('../commands/tag.mjs');
        return tagList(root);
      }
      throw new Error('Usage: clausidian tag <rename|list>');
    },
  },
];
