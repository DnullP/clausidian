/**
 * Command registry — single source of truth for CLI + MCP
 * Commands are defined in src/registry/*.mjs and aggregated here.
 */

import { readFileSync } from 'fs';

// ── Aggregate commands from all registry groups ──────────

const groups = await Promise.all([
  import('./registry/crud.mjs'),
  import('./registry/search.mjs'),
  import('./registry/update.mjs'),
  import('./registry/structure.mjs'),
  import('./registry/batch.mjs'),
  import('./registry/io.mjs'),
  import('./registry/smart.mjs'),
  import('./registry/timeline.mjs'),
  import('./registry/pin.mjs'),
  import('./registry/stats.mjs'),
  import('./registry/discovery.mjs'),
  import('./registry/tags.mjs'),
  import('./registry/system.mjs'),
  import('./registry/shortcuts.mjs'),
  import('./registry/vault-mgmt-reordered.mjs'),
  import('./registry/integration.mjs'),
]);

const COMMANDS = groups.flatMap(m => m.default);

// ── Lookup helpers ──────────────────────────────────────

const _byName = new Map();
for (const cmd of COMMANDS) _byName.set(cmd.name, cmd);

export function getCommand(name) {
  return _byName.get(name);
}

export function getAllCommands() {
  return COMMANDS;
}

export function getCommandNames() {
  return COMMANDS.map(c => c.name);
}

// ── MCP tool definitions (generated from registry) ─────

export function getMcpTools() {
  const tools = [];
  for (const cmd of COMMANDS) {
    if (cmd.mcpSchema) {
      tools.push({
        name: cmd.mcpName || cmd.name,
        description: cmd.description,
        inputSchema: {
          type: 'object',
          properties: cmd.mcpSchema,
          ...(cmd.mcpRequired ? { required: cmd.mcpRequired } : {}),
        },
      });
    }
    // Flatten subcommands into MCP tools
    if (cmd.subcommands) {
      for (const [, sub] of Object.entries(cmd.subcommands)) {
        if (sub.mcpSchema) {
          tools.push({
            name: sub.mcpName,
            description: sub.description,
            inputSchema: {
              type: 'object',
              properties: sub.mcpSchema,
              ...(sub.mcpRequired ? { required: sub.mcpRequired } : {}),
            },
          });
        }
      }
    }
  }
  return tools;
}

// ── MCP dispatch (tool name → handler) ─────────────────

export function getMcpDispatch() {
  const dispatch = {};
  for (const cmd of COMMANDS) {
    if (cmd.mcpSchema) {
      const name = cmd.mcpName || cmd.name;
      dispatch[name] = (root, args) => cmd.run(root, args, []);
    }
    if (cmd.subcommands) {
      for (const [, sub] of Object.entries(cmd.subcommands)) {
        if (sub.mcpName) {
          dispatch[sub.mcpName] = (root, args) => sub.run(root, args, []);
        }
      }
    }
  }
  return dispatch;
}
