/**
 * vault — manage registered vaults
 * Subcommands: list, register, default, info, remove
 */

import { VaultRegistry } from '../vault-registry.mjs';

/**
 * Main vault command dispatcher
 * @param {string} vaultRoot - Current vault root path (not used for vault management)
 * @param {Object} flags - Command flags
 * @param {string} flags.subcommand - Subcommand: list|register|default|info|remove
 * @param {string} flags.name - Vault name (for register, default, info, remove)
 * @param {string} flags.path - Vault path (for register)
 * @param {string} flags.registryPath - Optional custom registry path (for testing)
 * @returns {Promise<Object>} JSON response
 */
export async function vault(vaultRoot, flags = {}) {
  const { subcommand, name, path, registryPath } = flags;
  const registry = new VaultRegistry(registryPath);

  try {
    await registry.load();

    switch (subcommand) {
      case 'list':
        return vaultList(registry);
      case 'register':
        return await vaultRegister(registry, name, path);
      case 'default':
        return await vaultSetDefault(registry, name);
      case 'info':
        return vaultInfo(registry, name);
      case 'remove':
        return await vaultRemove(registry, name);
      default:
        throw new Error(
          `Unknown vault subcommand: ${subcommand}. Use 'list', 'register', 'default', 'info', or 'remove'.`
        );
    }
  } catch (err) {
    throw new Error(`Vault error: ${err.message}`);
  }
}

/**
 * List all vaults
 * @param {VaultRegistry} registry
 * @returns {Object} JSON response
 */
function vaultList(registry) {
  const vaults = registry.list();
  return {
    status: 'list',
    vaults: vaults.map(v => ({
      name: v.name,
      path: v.path,
      default: v.default,
    })),
  };
}

/**
 * Register a new vault
 * @param {VaultRegistry} registry
 * @param {string} name - Vault name
 * @param {string} path - Vault path
 * @returns {Promise<Object>} JSON response
 */
async function vaultRegister(registry, name, path) {
  if (!name) {
    throw new Error('Missing required argument: vault name');
  }
  if (!path) {
    throw new Error('Missing required argument: vault path');
  }

  await registry.register(name, path);
  const vault = registry.getByName(name);
  const isDefault = vault.name === registry.defaultVaultName;

  return {
    status: 'registered',
    name: vault.name,
    path: vault.path,
    isDefault,
  };
}

/**
 * Set default vault
 * @param {VaultRegistry} registry
 * @param {string} name - Vault name
 * @returns {Promise<Object>} JSON response
 */
async function vaultSetDefault(registry, name) {
  if (!name) {
    throw new Error('Missing required argument: vault name');
  }

  await registry.setDefault(name);
  return {
    status: 'set-default',
    name,
  };
}

/**
 * Get vault info
 * @param {VaultRegistry} registry
 * @param {string} name - Vault name
 * @returns {Object} JSON response
 */
function vaultInfo(registry, name) {
  if (!name) {
    throw new Error('Missing required argument: vault name');
  }

  const vault = registry.getByName(name);
  if (!vault) {
    throw new Error(`Vault not found: ${name}`);
  }

  return {
    status: 'info',
    name: vault.name,
    path: vault.path,
    default: vault.name === registry.defaultVaultName,
  };
}

/**
 * Remove vault
 * @param {VaultRegistry} registry
 * @param {string} name - Vault name
 * @returns {Promise<Object>} JSON response
 */
async function vaultRemove(registry, name) {
  if (!name) {
    throw new Error('Missing required argument: vault name');
  }

  const vault = registry.getByName(name);
  if (!vault) {
    throw new Error(`Vault not found: ${name}`);
  }

  // Remove from vaults array
  registry.vaults = registry.vaults.filter(v => v.name !== name);

  // If removing default, clear it
  if (registry.defaultVaultName === name) {
    registry.defaultVaultName = null;
  }

  await registry.save();
  return {
    status: 'removed',
    name,
  };
}
