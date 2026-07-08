/**
 * Timeline commands
 */

export default [

  // ── Timeline & review ──
  {
    name: 'timeline',
    description: 'Chronological activity feed',
    usage: 'timeline',
    mcpSchema: {
      days: { type: 'number', description: 'Days to look back (default: 30)' },
      type: { type: 'string' },
      limit: { type: 'number', description: 'Max entries (default: 50)' },
    },
    async run(root, flags) {
      const { timeline } = await import('../commands/timeline.mjs');
      return timeline(root, {
        days: flags.days ? parseInt(flags.days) : undefined,
        type: flags.type,
        limit: flags.limit ? parseInt(flags.limit) : undefined,
      });
    },
  },,
  {
    name: 'review',
    description: 'Generate weekly or monthly review',
    usage: 'review [monthly]',
    async run(root, flags, pos) {
      if (pos[0] === 'monthly') {
        const { monthlyReview } = await import('../commands/review.mjs');
        return monthlyReview(root, {
          year: flags.year ? parseInt(flags.year) : undefined,
          month: flags.month ? parseInt(flags.month) : undefined,
        });
      }
      const { review } = await import('../commands/review.mjs');
      return review(root, { date: flags.date });
    },
  },
];
