/**
 * errors — structured error classes for Clausidian
 *
 * Error codes:
 *   E1  Registry corruption (VaultRegistry.load)
 *   E2  Invalid vault path (path does not exist)
 *   E3  No vault selected (no flag / env / registry / fallback)
 *   E4  Vault not found by name
 *   E10 Note not found
 *   E11 Heading not found in note
 */

export class ClausidianError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'ClausidianError';
  }
}

export class VaultError extends ClausidianError {
  constructor(code, message) {
    super(code, `${code}: ${message}`);
    this.name = 'VaultError';
  }
}

export class NoteNotFoundError extends ClausidianError {
  constructor(noteName) {
    super('E10', `Note not found: ${noteName}`);
    this.name = 'NoteNotFoundError';
    this.noteName = noteName;
  }
}

export class HeadingNotFoundError extends ClausidianError {
  constructor(heading) {
    super('E11', `Heading not found: "${heading}"`);
    this.name = 'HeadingNotFoundError';
    this.heading = heading;
  }
}
