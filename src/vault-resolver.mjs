/**
 * Vault Resolution & Precedence (I2)
 * Applies precedence order to resolve vault path from multiple sources
 *
 * Precedence order:
 * 1. --vault flag (flags.vault)
 * 2. OA_VAULT environment variable
 * 3. Registry default
 * 4. Fallback path (usually process.cwd())
 *
 * Error taxonomy:
 * E1: Registry corruption (handled by VaultRegistry.load())
 * E2: Invalid vault path → path does not exist
 * E3: No vault selected → suggest 3 ways to select
 * E4: Vault not found → list available vaults
 */

import { existsSync } from 'fs';
import { resolve } from 'path';
import { VaultError } from './errors.mjs';

/**
 * Resolves vault path using precedence order with comprehensive error handling
 * @param {Object} flags - Command-line flags object { vault?: string }
 * @param {VaultRegistry} registry - Loaded VaultRegistry instance
 * @param {string} fallbackPath - Fallback path (typically process.cwd())
 * @returns {Object} { vaultPath, vaultName, source }
 *   - vaultPath: Absolute path to vault
 *   - vaultName: Name of vault (or null if from env/fallback)
 *   - source: One of 'flag', 'env', 'registry', 'fallback'
 * @throws {Error} E2, E3, or E4 errors with recovery suggestions
 */
export function resolveVault(flags, registry, fallbackPath) {
  // 1. Check --vault flag
  if (flags?.vault) {
    const vault = registry.getByName(flags.vault);
    if (!vault) {
      const available = registry.list().map(v => v.name).join(', ') || '(none)';
      throw new VaultError(
        'E4',
        `Vault not found: "${flags.vault}"\n\n` +
        `Available vaults: ${available}\n` +
        `Tip: Use 'clausidian vault list' to see all registered vaults, ` +
        `or 'clausidian vault register <name> <path>'`
      );
    }
    if (!existsSync(vault.path)) {
      throw new VaultError(
        'E2',
        `Invalid vault path: vault "${flags.vault}" points to non-existent path\n\n` +
        `Path: ${vault.path}\n` +
        `Tip: Vault may have been moved or deleted. ` +
        `Run 'clausidian vault unregister ${flags.vault}' to remove it.`
      );
    }
    return {
      vaultPath: vault.path,
      vaultName: flags.vault,
      source: 'flag',
    };
  }

  // 2. Check OA_VAULT environment variable
  const oaVault = process.env.OA_VAULT;
  if (oaVault) {
    const absPath = resolve(oaVault);
    if (!existsSync(absPath)) {
      throw new VaultError(
        'E2',
        `Invalid vault path from OA_VAULT environment variable\n\n` +
        `Path: ${absPath}\n` +
        `Tip: Update OA_VAULT to point to an existing vault directory, ` +
        `or unset it to use registry default.`
      );
    }
    return {
      vaultPath: absPath,
      vaultName: null,
      source: 'env',
    };
  }

  // 3. Check registry default
  const defaultVault = registry.getDefault();
  if (defaultVault) {
    if (!existsSync(defaultVault.path)) {
      throw new VaultError(
        'E2',
        `Invalid vault path: default vault "${defaultVault.name}" points to non-existent path\n\n` +
        `Path: ${defaultVault.path}\n` +
        `Tip: Registry default may be corrupted. ` +
        `Run 'clausidian vault list' to check status.`
      );
    }
    return {
      vaultPath: defaultVault.path,
      vaultName: defaultVault.name,
      source: 'registry',
    };
  }

  // 4. Use fallback path (if provided and valid)
  if (fallbackPath && existsSync(fallbackPath)) {
    return {
      vaultPath: resolve(fallbackPath),
      vaultName: null,
      source: 'fallback',
    };
  }

  // E3: No vault available
  const hasRegistry = registry.list().length > 0;
  const suggestions = [
    '1. Use --vault flag: clausidian <cmd> --vault <name>',
    '2. Set OA_VAULT env var: export OA_VAULT=/path/to/vault',
    '3. Set registry default: clausidian vault default <name>',
  ];

  throw new VaultError(
    'E3',
    `No vault selected and no fallback available\n\n` +
    (hasRegistry
      ? `Registered vaults: ${registry.list().map(v => v.name).join(', ')}\n\n`
      : `No vaults registered. Register one with: clausidian vault register <name> <path>\n\n`) +
    `Select a vault by:\n${suggestions.join('\n')}\n\n` +
    `Tip: Run 'clausidian vault --help' for more information.`
  );
}
