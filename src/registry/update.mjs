/**
 * Update commands
 */

export default [

  // ── Update ──
  {
    name: 'update',
    description: 'Update note frontmatter fields',
    usage: 'update <note>',
    mcpSchema: {
      note: { type: 'string', description: 'Note filename' },
      status: { type: 'string', description: 'New status' },
      tags: { type: 'string', description: 'Comma-separated tags' },
      summary: { type: 'string', description: 'New summary' },
    },
    mcpRequired: ['note'],
    async run(root, flags, pos) {
      const { update } = await import('../commands/update.mjs');
      return update(root, flags.note || pos[0], {
        status: flags.status, tags: flags.tags, tag: flags.tag, summary: flags.summary,
      });
    },
  },,
  {
    name: 'patch',
    description: 'Edit a section of a note by heading',
    usage: 'patch <note>',
    mcpSchema: {
      note: { type: 'string', description: 'Note filename' },
      heading: { type: 'string', description: 'Target heading text' },
      append: { type: 'string', description: 'Text to append' },
      prepend: { type: 'string', description: 'Text to prepend' },
      replace: { type: 'string', description: 'Text to replace section with' },
    },
    mcpRequired: ['note', 'heading'],
    async run(root, flags, pos) {
      const { patch } = await import('../commands/patch.mjs');
      return patch(root, flags.note || pos[0], {
        heading: flags.heading, append: flags.append, prepend: flags.prepend, replace: flags.replace,
      });
    },
  },,

  // ── Structure ops ──
  {
    name: 'rename',
    description: 'Rename a note and update all references',
    usage: 'rename <note> <new-title>',
    mcpSchema: {
      note: { type: 'string', description: 'Note filename' },
      new_title: { type: 'string', description: 'New title' },
    },
    mcpRequired: ['note', 'new_title'],
    async run(root, flags, pos) {
      const { rename } = await import('../commands/rename.mjs');
      const n = flags.note || pos[0];
      const t = flags.new_title || pos[1];
      if (!n || !t) throw new Error('Usage: clausidian rename <note-name> <new-title>');
      return rename(root, n, t);
    },
  },,
  {
    name: 'move',
    description: 'Move a note to a different type/directory',
    usage: 'move <note> <new-type>',
    mcpSchema: {
      note: { type: 'string', description: 'Note filename' },
      new_type: { type: 'string', description: 'New type (area/project/resource/idea, optionally with subdirectory like resource/wiki/kubernetes)' },
    },
    mcpRequired: ['note', 'new_type'],
    async run(root, flags, pos) {
      const { move } = await import('../commands/move.mjs');
      const n = flags.note || pos[0];
      const t = flags.new_type || pos[1];
      if (!n || !t) throw new Error('Usage: clausidian move <note-name> <new-type>');
      return move(root, n, t);
    },
  },,
  {
    name: 'merge',
    description: 'Merge source note into target note',
    usage: 'merge <source> <target>',
    mcpSchema: {
      source: { type: 'string', description: 'Source note filename' },
      target: { type: 'string', description: 'Target note filename' },
    },
    mcpRequired: ['source', 'target'],
    async run(root, flags, pos) {
      const { merge } = await import('../commands/merge.mjs');
      const s = flags.source || pos[0];
      const t = flags.target || pos[1];
      if (!s || !t) throw new Error('Usage: clausidian merge <source-note> <target-note>');
      return merge(root, s, t);
    },
  },
];
