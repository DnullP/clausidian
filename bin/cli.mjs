#!/usr/bin/env node

/**
 * clausidian CLI — AI agent toolkit for Obsidian vaults
 * v1.2.0 — multi-vault support with VaultRegistry
 */

import { getCommand, getCommandNames } from '../src/registry.mjs';
import { VaultRegistry } from '../src/vault-registry.mjs';
import { resolveVault as resolveVaultPath } from '../src/vault-resolver.mjs';
import { ClausidianError } from '../src/errors.mjs';

const args = process.argv.slice(2);
const command = args[0];

function levenshtein(a, b) {
  if (!a || !b) return Math.max((a || '').length, (b || '').length);
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = new Array(n + 1);
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] !== b[j - 1] ? 1 : 0));
    }
    prev = curr;
  }
  return prev[n];
}

function parseFlags(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const eqIdx = args[i].indexOf('=');
      if (eqIdx !== -1) {
        flags[args[i].slice(2, eqIdx)] = args[i].slice(eqIdx + 1);
      } else {
        const key = args[i].slice(2);
        flags[key] = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
      }
    } else {
      positional.push(args[i]);
    }
  }
  return { flags, positional };
}

async function resolveVaultContext(flags) {
  const registry = new VaultRegistry();
  try {
    await registry.load();
  } catch (err) {
    // E1: Registry corruption — fallback to OA_VAULT
    if (flags.vault) {
      throw new Error(
        `Failed to load vault registry: ${err.message}\n` +
        `Cannot use --vault flag. Fallback to: OA_VAULT=/path/to/vault`
      );
    }
  }

  return resolveVaultPath(flags, registry, process.cwd());
}

async function main() {
  // ── Version ──
  if (command === 'version' || command === '--version' || command === '-v') {
    const { readFileSync } = await import('fs');
    const { resolve, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    console.log(`clausidian v${pkg.version}`);
    return;
  }

  // ── Help ──
  if (command === 'help' || command === '--help' || command === '-h' || !command) {
    const { printHelp } = await import('../src/help.mjs');
    printHelp();
    return;
  }

  // ── Find command ──
  const cmd = getCommand(command);
  if (!cmd) {
    const names = getCommandNames();
    const similar = names.filter(c => c.startsWith(command?.slice(0, 2) || '') || levenshtein(c, command) <= 2);
    console.error(`Unknown command: ${command}`);
    if (similar.length) console.error(`Did you mean: ${similar.join(', ')}?`);
    else console.error('Run "clausidian help" for usage.');
    process.exit(1);
  }

  // ── Parse & run ──
  const { flags, positional } = parseFlags(args.slice(1));
  const jsonMode = flags.json === true;
  const origLog = console.log;
  if (jsonMode) console.log = () => {};

  // ── Resolve vault with registry ──
  let vaultCtx;
  try {
    vaultCtx = await resolveVaultContext(flags);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  // ── Attach vault context to flags ──
  const enhancedFlags = {
    ...flags,
    _vault: {
      name: vaultCtx.vaultName,
      source: vaultCtx.source,
    },
  };

  let result;
  if (cmd.subcommands) {
    // Dispatch to subcommand
    const subcommandName = positional[0];
    const subcommand = cmd.subcommands[subcommandName];
    if (!subcommand) {
      const available = Object.keys(cmd.subcommands).join(', ');
      console.error(`Unknown subcommand: ${subcommandName}`);
      console.error(`Available: ${available}`);
      process.exit(1);
    }
    // Remove subcommand from positional args
    positional.shift();
    result = await subcommand.run(vaultCtx.vaultPath, enhancedFlags, positional);
  } else if (cmd.run) {
    result = await cmd.run(vaultCtx.vaultPath, enhancedFlags, positional);
  } else {
    throw new Error(`Command ${command} has no run function or subcommands`);
  }

  // ── Attach vault field to result for agents ──
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    result = {
      ...result,
      _vaultName: vaultCtx.vaultName,
      _vaultSource: vaultCtx.source,
    };
  }

  if (jsonMode && result !== undefined) {
    console.log = origLog;
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch(err => {
  if (err instanceof ClausidianError && !err.message.startsWith(err.code)) {
    console.error(`[${err.code}] ${err.message}`);
  } else {
    console.error(err.message);
  }
  process.exit(1);
});
