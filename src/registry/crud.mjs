/**
 * Crud commands
 */

export default [
  // ── CRUD ──
  {
    name: 'init',
    description: 'Initialize a new agent-friendly vault',
    usage: 'init <path>',
    async run(root, flags, pos) {
      const { init } = await import('../commands/init.mjs');
      return init(pos[0] || '.');
    },
  },,
  {
    name: 'journal',
    description: 'Create or open today\'s journal entry',
    usage: 'journal [--date DATE]',
    mcpSchema: { date: { type: 'string', description: 'Date in YYYY-MM-DD format (default: today)' } },
    async run(root, flags) {
      const { journal } = await import('../commands/journal.mjs');
      return journal(root, { date: flags.date });
    },
  },,
  {
    name: 'note',
    description: 'Create a new note with automatic linking',
    usage: 'note <title> <type>',
    mcpSchema: {
      title: { type: 'string', description: 'Note title' },
      type: { type: 'string', description: 'Note type (area/project/resource/idea, optionally with subdirectory like resource/wiki/kubernetes)' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags' },
      summary: { type: 'string', description: 'One-line summary' },
    },
    mcpRequired: ['title', 'type'],
    async run(root, flags, pos) {
      const { note } = await import('../commands/note.mjs');
      const title = flags.title || pos[0];
      const type = flags.type || pos[1];
      if (!title || !type) throw new Error('Usage: clausidian note <title> <type>');
      const tags = flags.tags ? (Array.isArray(flags.tags) ? flags.tags : flags.tags.split(',')) : [];
      return note(root, title, type, { tags, goal: flags.goal, summary: flags.summary });
    },
  },,
  {
    name: 'capture',
    description: 'Quick idea capture',
    usage: 'capture <idea>',
    mcpSchema: { idea: { type: 'string', description: 'Idea text' } },
    mcpRequired: ['idea'],
    async run(root, flags, pos) {
      const { capture } = await import('../commands/capture.mjs');
      const idea = flags.idea || pos.join(' ');
      if (!idea) throw new Error('Usage: clausidian capture <idea text>');
      return capture(root, idea);
    },
  },,
  {
    name: 'read',
    description: 'Read a note\'s full content',
    usage: 'read <note>',
    mcpSchema: {
      note: { type: 'string', description: 'Note filename (without .md)' },
      section: { type: 'string', description: 'Optional: read only this heading section' },
    },
    mcpRequired: ['note'],
    async run(root, flags, pos) {
      const { read } = await import('../commands/read.mjs');
      return read(root, flags.note || pos[0], { section: flags.section });
    },
  },,
  {
    name: 'delete',
    description: 'Delete a note and clean up references',
    usage: 'delete <note>',
    mcpSchema: { note: { type: 'string', description: 'Note filename' } },
    mcpRequired: ['note'],
    async run(root, flags, pos) {
      const { deleteNote } = await import('../commands/delete.mjs');
      return deleteNote(root, flags.note || pos[0]);
    },
  },,
  {
    name: 'archive',
    description: 'Set note status to archived',
    usage: 'archive <note>',
    mcpSchema: { note: { type: 'string', description: 'Note filename' } },
    mcpRequired: ['note'],
    async run(root, flags, pos) {
      const { archive } = await import('../commands/archive.mjs');
      return archive(root, flags.note || pos[0]);
    },
  },
];
