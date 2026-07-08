/**
 * VaultRegistry — Global persistent vault registry
 * Location: $HOME/.clausidian/vaults.json
 *
 * Maintains a list of known vaults with names, paths, and default marker.
 * Enables multi-vault support: agents can target specific vaults with --vault flag
 * while maintaining backward compatibility with OA_VAULT environment variable.
 */

import { promises as fs, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { homedir } from 'os';

export class VaultRegistry {
  constructor(registryPath = null) {
    this.registryPath = registryPath || join(homedir(), '.clausidian', 'vaults.json');
    this.vaults = [];
    this.defaultVaultName = null;
  }

  /**
   * Load registry from disk
   * @returns {Promise<void>}
   */
  async load() {
    try {
      if (!existsSync(this.registryPath)) {
        this.vaults = [];
        this.defaultVaultName = null;
        return;
      }
      const content = await fs.readFile(this.registryPath, 'utf8');
      const data = JSON.parse(content);
      this.vaults = data.vaults || [];
      this.defaultVaultName = data.defaultVaultName || null;
    } catch (err) {
      throw new Error(`Failed to load vault registry: ${err.message}`);
    }
  }

  /**
   * Save registry to disk (atomic via temp file + rename)
   * @returns {Promise<void>}
   */
  async save() {
    const data = {
      vaults: this.vaults,
      defaultVaultName: this.defaultVaultName,
    };
    const dir = dirname(this.registryPath);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    const tmpPath = `${this.registryPath}.tmp`;
    try {
      await fs.writeFile(tmpPath, JSON.stringify(data, null, 2));
      await fs.rename(tmpPath, this.registryPath);
    } catch (err) {
      throw new Error(`Failed to save vault registry: ${err.message}`);
    }
  }

  /**
   * Register a new vault
   * @param {string} name - Vault name (globally unique)
   * @param {string} path - Vault root path
   * @param {boolean} setDefault - Whether to set as default (auto-set first vault)
   * @returns {Promise<void>}
   */
  async register(name, path, setDefault = false) {
    const absPath = resolve(path);

    // Validate path exists
    if (!existsSync(absPath)) {
      throw new Error(`Vault path does not exist: ${absPath}`);
    }

    // Check for duplicate name
    if (this.vaults.some(v => v.name === name)) {
      throw new Error(`Vault name already registered: ${name}`);
    }

    this.vaults.push({ name, path: absPath });

    // Auto-set first vault as default or explicit setDefault
    if (setDefault || this.vaults.length === 1) {
      this.defaultVaultName = name;
    }

    await this.save();
  }

  /**
   * Set default vault
   * @param {string} name - Vault name
   * @returns {Promise<void>}
   */
  async setDefault(name) {
    const vault = this.vaults.find(v => v.name === name);
    if (!vault) {
      throw new Error(`Vault not found: ${name}`);
    }
    this.defaultVaultName = name;
    await this.save();
  }

  /**
   * Get vault by name
   * @param {string} name - Vault name
   * @returns {Object|null} Vault object or null if not found
   */
  getByName(name) {
    return this.vaults.find(v => v.name === name) || null;
  }

  /**
   * Get default vault
   * @returns {Object|null} Default vault or null if not set
   */
  getDefault() {
    if (!this.defaultVaultName) return null;
    return this.getByName(this.defaultVaultName);
  }

  /**
   * List all vaults
   * @returns {Array} Array of vault objects
   */
  list() {
    return this.vaults.map(v => ({
      ...v,
      default: v.name === this.defaultVaultName,
    }));
  }

  /**
   * Resolve vault name to path using precedence order:
   * 1. --vault flag (vaultName parameter, if provided)
   * 2. OA_VAULT environment variable
   * 3. Registry default
   * 4. Error if none available
   *
   * @param {string} vaultName - Vault name from --vault flag (optional)
   * @returns {string} Resolved vault path
   * @throws {Error} If vault cannot be resolved
   */
  resolveVaultPath(vaultName = null) {
    // 1. Explicit --vault flag
    if (vaultName) {
      const vault = this.getByName(vaultName);
      if (!vault) {
        throw new Error(`Vault not found: ${vaultName}`);
      }
      return vault.path;
    }

    // 2. OA_VAULT environment variable
    const oaVault = process.env.OA_VAULT;
    if (oaVault) {
      return resolve(oaVault);
    }

    // 3. Registry default
    const defaultVault = this.getDefault();
    if (defaultVault) {
      return defaultVault.path;
    }

    // 4. Error
    throw new Error(
      'No vault selected. Provide --vault flag, set OA_VAULT, or run "clausidian vault default <name>"'
    );
  }
}
