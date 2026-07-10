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
      aliases: { type: 'string', description: 'Aliases (comma-separated or JSON array)' },
      related: { type: 'string', description: 'Related wikilinks (comma-separated or JSON array)' },
      maturity: { type: 'string', description: 'Maturity level' },
      created: { type: 'string', description: 'Creation date (YYYY-MM-DD)' },
      source: { type: 'string', description: 'Source URL or reference' },
    },
    mcpRequired: ['note'],
    async run(root, flags, pos) {
      const { update } = await import('../commands/update.mjs');
      return update(root, flags.note || pos[0], flags);
    },
  },,
  {
    name: 'patch',
    description: 'Edit a section of a note by heading. Auto-creates missing headings. Inline text replacement with match_text + replace. Supports prefix heading matching.',
    usage: 'patch <note>',
    mcpSchema: {
      note: { type: 'string', description: 'Note filename' },
      heading: { type: 'string', description: 'Target heading text. Prefix matching: "Description" matches "Description — 概述". Can include ## prefix or omit it.' },
      append: { type: 'string', description: 'Text to append to end of section' },
      prepend: { type: 'string', description: 'Text to prepend to start of section' },
      replace: { type: 'string', description: 'Replacement text. With match_text: replaces first occurrence inline. Without match_text: replaces entire section content.' },
      match_text: { type: 'string', description: 'Text to find and replace within the section (used with replace). First occurrence only.' },
      delete_section: { type: 'boolean', description: 'Delete the entire heading section (heading + content)' },
      create_if_missing: { type: 'boolean', description: 'Auto-create heading if not found (default: true). New headings placed before Connections/See Also.' },
      after_line: { type: 'string', description: 'Insert text after the line containing this pattern (within the target section)' },
      before_line: { type: 'string', description: 'Insert text before the line containing this pattern (within the target section)' },
    },
    mcpRequired: ['note', 'heading'],
    async run(root, flags, pos) {
      const { patch } = await import('../commands/patch.mjs');
      return patch(root, flags.note || pos[0], {
        heading: flags.heading,
        append: flags.append,
        prepend: flags.prepend,
        replace: flags.replace,
        match_text: flags.match_text,
        delete_section: flags.delete_section,
        create_if_missing: flags.create_if_missing,
        after_line: flags.after_line,
        before_line: flags.before_line,
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
