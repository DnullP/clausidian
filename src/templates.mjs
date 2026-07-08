/**
 * Template engine — resolves {{PLACEHOLDER}} in templates
 */
import { resolve, join, dirname } from 'path';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const BUILTIN_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'scaffold', 'templates');

export class TemplateEngine {
  constructor(vaultRoot) {
    this.vaultDir = join(vaultRoot, 'templates');
    this._cache = {};
  }

  /**
   * Load a template by name (cached)
   * Prefers vault's templates/ over built-in scaffold/templates/
   */
  load(name) {
    if (this._cache[name]) return this._cache[name];
    const vaultPath = join(this.vaultDir, `${name}.md`);
    if (existsSync(vaultPath)) {
      this._cache[name] = readFileSync(vaultPath, 'utf8');
      return this._cache[name];
    }
    const builtinPath = join(BUILTIN_DIR, `${name}.md`);
    if (existsSync(builtinPath)) {
      this._cache[name] = readFileSync(builtinPath, 'utf8');
      return this._cache[name];
    }
    throw new Error(`Template not found: ${name}`);
  }

  render(name, vars = {}) {
    let content = this.load(name);
    content = content.replace(/<!--\s*AGENT[\s\S]*?-->\n?/g, '');
    for (const [key, val] of Object.entries(vars)) {
      content = content.replaceAll(`{{${key}}}`, val);
    }
    return content;
  }
}
