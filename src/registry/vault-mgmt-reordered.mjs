/**
 * Vault Mgmt Reordered commands
 */

export default [
  {
    name: 'vault',
    description: 'Manage registered vaults',
    usage: 'vault <list|register|default|info|remove>',
    subcommands: {
      list: {
        mcpName: 'vault_list',
        description: 'List all registered vaults',
        mcpSchema: {},
        async run(root, flags) {
          const { vault } = await import('../commands/vault.mjs');
          return vault(root, { subcommand: 'list' });
        },
      },
      register: {
        mcpName: 'vault_register',
        description: 'Register a new vault',
        mcpSchema: {
          name: { type: 'string', description: 'Vault name' },
          path: { type: 'string', description: 'Vault path' },
        },
        mcpRequired: ['name', 'path'],
        async run(root, flags, pos) {
          const { vault } = await import('../commands/vault.mjs');
          return vault(root, { subcommand: 'register', name: flags.name || pos[0], path: flags.path || pos[1] });
        },
      },
      default: {
        mcpName: 'vault_default',
        description: 'Set default vault',
        mcpSchema: {
          name: { type: 'string', description: 'Vault name' },
        },
        mcpRequired: ['name'],
        async run(root, flags, pos) {
          const { vault } = await import('../commands/vault.mjs');
          return vault(root, { subcommand: 'default', name: flags.name || pos[0] });
        },
      },
      info: {
        mcpName: 'vault_info',
        description: 'Get vault info',
        mcpSchema: {
          name: { type: 'string', description: 'Vault name' },
        },
        mcpRequired: ['name'],
        async run(root, flags, pos) {
          const { vault } = await import('../commands/vault.mjs');
          return vault(root, { subcommand: 'info', name: flags.name || pos[0] });
        },
      },
      remove: {
        mcpName: 'vault_remove',
        description: 'Remove a vault',
        mcpSchema: {
          name: { type: 'string', description: 'Vault name' },
        },
        mcpRequired: ['name'],
        async run(root, flags, pos) {
          const { vault } = await import('../commands/vault.mjs');
          return vault(root, { subcommand: 'remove', name: flags.name || pos[0] });
        },
      },
    },
  },,
  {
    name: 'launchd',
    description: 'Install/uninstall macOS LaunchAgents for automated vault maintenance',
    usage: 'launchd <install|uninstall|status>',
    async run(root, flags, pos) {
      const { launchd } = await import('../commands/launchd.mjs');
      return launchd(root, pos[0], flags);
    },
  },,

  // ── v3.5 Event System ──
  {
    name: 'events',
    description: 'View and query vault events',
    usage: 'events <list|query|stats>',
    subcommands: {
      list: {
        mcpName: 'events_list',
        description: 'List recent vault events',
        mcpSchema: {
          count: { type: 'integer', description: 'Number of recent events to show (default: 20)' },
        },
        async run(root, flags) {
          const { eventsList } = await import('../commands/events.mjs');
          return eventsList(root, { count: flags.count ? parseInt(flags.count) : 20 });
        },
      },
      query: {
        mcpName: 'events_query',
        description: 'Query events by type or time range',
        mcpSchema: {
          event_type: { type: 'string', description: 'Event type pattern (e.g., note:* or note:created)' },
          start_time: { type: 'string', description: 'ISO 8601 start time' },
          end_time: { type: 'string', description: 'ISO 8601 end time' },
        },
        async run(root, flags) {
          const { eventsQuery } = await import('../commands/events.mjs');
          return eventsQuery(root, {
            eventType: flags.event_type,
            startTime: flags.start_time,
            endTime: flags.end_time,
          });
        },
      },
      stats: {
        mcpName: 'events_stats',
        description: 'Show event statistics',
        mcpSchema: {},
        async run(root) {
          const { eventsStats } = await import('../commands/events.mjs');
          return eventsStats(root);
        },
      },
    },
  },,
  {
    name: 'subscribe',
    description: 'Subscribe to vault events (streaming)',
    usage: 'subscribe <pattern>',
    mcpSchema: {
      pattern: { type: 'string', description: 'Event pattern (e.g., note:*, index:*)' },
      count: { type: 'integer', description: 'Max events to receive before closing' },
    },
    mcpRequired: ['pattern'],
    async run(root, flags, pos) {
      const { subscribe } = await import('../commands/subscribe.mjs');
      const pattern = flags.pattern || pos[0];
      if (!pattern) throw new Error('Usage: clausidian subscribe <pattern>');
      return subscribe(root, pattern, { count: flags.count ? parseInt(flags.count) : undefined });
    },
  },
];
