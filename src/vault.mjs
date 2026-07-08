/**
 * Vault — core operations for reading/writing Obsidian notes
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync, openSync, readSync, closeSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'crypto';
import { SimilarityEngine } from './similarity-engine.mjs';
import { updateFrontmatter } from './frontmatter-helper.mjs';
import { VaultIndexer } from './vault-indexer.mjs';
import EventBus from './events/event-bus.mjs';
import EventHistory from './events/event-history.mjs';

const DEFAULT_DIRS = ['areas', 'projects', 'resources', 'journal', 'ideas'];

export class Vault {
  constructor(root, { dirs, vaultName = null, searchCache = null, enableParallel = true } = {}) {
    this.root = resolve(root);
    this.vaultName = vaultName || 'default';
    this.dirs = dirs || this._detectDirs() || DEFAULT_DIRS;
    this._notesCache = null;
    this._notesCacheWithBody = null;
    this.searchCache = searchCache;

    // v3.5 Event System
    this.eventBus = new EventBus(this);
    this.eventHistory = new EventHistory(this);

    // Initiative B Integration
    this.indexer = null;               // B2.1: Lazy initialized

    // Metrics tracking for search operations
    this.searchMetrics = {
      queries: 0,
      cacheHits: 0,
      parallelUsed: 0
    };
  }

  _detectDirs() {
    const configPath = this.path('.clausidian.json');
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf8'));
        if (Array.isArray(config.dirs)) return config.dirs;
      } catch { /* ignore */ }
    }
    return null;
  }

  invalidateCache() {
    this._notesCache = null;
    this._notesCacheWithBody = null;
  }

  // ── Path helpers ─────────────────────────────────────

  path(...segments) {
    return join(this.root, ...segments);
  }

  exists(...segments) {
    return existsSync(this.path(...segments));
  }

  // ── Read/Write ───────────────────────────────────────

  read(...segments) {
    const p = this.path(...segments);
    return existsSync(p) ? readFileSync(p, 'utf8') : null;
  }

  /**
   * Read only the frontmatter portion of a file (first ~4KB).
   * Returns the full frontmatter string or empty string if none.
   * Much faster than read() for large notes when body is not needed.
   */
  readFrontmatter(...segments) {
    const p = this.path(...segments);
    if (!existsSync(p)) return '';
    const buf = Buffer.allocUnsafe(4096);
    let fd;
    try {
      fd = openSync(p, 'r');
      const bytes = readSync(fd, buf, 0, 4096, 0);
      return buf.toString('utf8', 0, bytes);
    } catch { return ''; }
    finally { if (fd !== undefined) closeSync(fd); }
  }

  write(...args) {
    const content = args.pop().replace(/\r\n/g, '\n');
    const p = this.path(...args);
    const dir = dirname(p);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const isNew = !existsSync(p);
    writeFileSync(p, content);
    this.invalidateCache();

    // Emit event (v3.5)
    if (isNew) {
      const filename = args[args.length - 1].replace('.md', '');
      this.eventBus.emit('note:created', { note: filename, dir: args[0] });
      this.eventHistory.append('note:created', { note: filename, dir: args[0] });
    } else {
      const filename = args[args.length - 1].replace('.md', '');
      this.eventBus.emit('note:updated', { note: filename, dir: args[0] });
      this.eventHistory.append('note:updated', { note: filename, dir: args[0] });
    }
  }

  // ── Frontmatter parsing ──────────────────────────────

  parseFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};
    const fm = match[1];
    const result = {};
    for (const line of fm.split('\n')) {
      // Match key: value, allowing colons in value portion
      const m = line.match(/^(\w[\w-]*):\s*(.*)$/);
      if (!m) continue;
      let [, key, val] = m;
      val = val.trim();
      if (!val) continue;
      val = val.replace(/^"(.*)"$/, '$1');
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map(s =>
          s.trim().replace(/^"(.*)"$/, '$1').replace(/^\[\[(.*)\]\]$/, '$1')
        ).filter(Boolean);
      }
      result[key] = val;
    }
    return result;
  }

  // ── Extract body (content after frontmatter) ────────

  extractBody(content) {
    return content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
  }

  // ── Scan all notes (cached) ──────────────────────────

  scanNotes({ includeBody = false } = {}) {
    const cacheKey = includeBody ? '_notesCacheWithBody' : '_notesCache';
    if (this[cacheKey]) return this[cacheKey];

    const notes = [];
    for (const dir of this.dirs) {
      this._scanDir(dir, dir, notes, includeBody);
    }
    this[cacheKey] = notes;
    return notes;
  }

  _scanDir(dir, topDir, notes, includeBody) {
    const dirPath = this.path(dir);
    if (!existsSync(dirPath)) return;
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && !entry.name.startsWith('_')) {
        this._scanDir(`${dir}/${entry.name}`, topDir, notes, includeBody);
        continue;
      }
      if (!entry.name.endsWith('.md') || entry.name.startsWith('_')) continue;
      const content = includeBody
        ? this.read(dir, entry.name)
        : this.readFrontmatter(dir, entry.name);
      if (!content) continue;
      const fm = this.parseFrontmatter(content);
      const note = {
        file: entry.name.replace('.md', ''),
        dir: dir,
        subdir: undefined,
        title: fm.title || entry.name.replace('.md', ''),
        type: fm.type || topDir.replace(/s$/, ''),
        tags: Array.isArray(fm.tags) ? fm.tags : [],
        status: fm.status || 'active',
        summary: fm.summary || '',
        related: Array.isArray(fm.related) ? fm.related : [],
        created: fm.created || '',
        updated: fm.updated || '',
        pinned: fm.pinned === 'true' || fm.pinned === true,
      };
      if (includeBody) note.body = this.extractBody(content);
      notes.push(note);
    }
  }

  // ── ripgrep pre-filter (optional, zero-dependency) ──

  _rgPrefilter(keyword, regex) {
    const args = ['--files-with-matches', '--glob', '*.md'];
    if (!regex) args.push('--fixed-strings');
    args.push('--', keyword, this.root);
    const result = spawnSync('rg', args, { encoding: 'utf8', timeout: 5000 });
    if (result.error || result.status === null || result.status >= 2) return null;
    if (result.status === 1) return new Set();               // no matches
    return new Set(result.stdout.trim().split('\n').filter(Boolean));
  }

  // ── Initiative B: Indexer initialization (B2.1) ──────

  _initializeIndexer() {
    if (this.indexer) return;
    this.indexer = new VaultIndexer();
  }


  // ── Search notes by keyword (relevance-scored) ─────

  search(keyword, { type, tag, status, regex = false } = {}) {
    // Check cache if available
    if (this.searchCache) {
      const cached = this.searchCache.get(keyword, { type, tag, status, regex });
      if (cached) return cached;
    }

    // Use ripgrep to pre-filter matching files when available
    const rgFiles = this._rgPrefilter(keyword, regex);
    const useRg = rgFiles !== null;

    // Scan metadata only; load body on-demand for rg-matched files
    const notes = this.scanNotes({ includeBody: !useRg });
    if (useRg) {
      for (const n of notes) {
        const filePath = this.path(n.dir, `${n.file}.md`);
        if (rgFiles.has(filePath)) {
          const content = this.read(n.dir, `${n.file}.md`);
          n.body = content ? this.extractBody(content) : '';
        }
      }
    }

    const results = [];

    // Build matcher: regex mode or plain keyword
    let matcher;
    if (regex) {
      try {
        const re = new RegExp(keyword, 'i');
        matcher = (text) => re.test(text);
      } catch {
        throw new Error(`Invalid regex: ${keyword}`);
      }
    } else {
      const kw = keyword.toLowerCase();
      matcher = (text) => text.toLowerCase().includes(kw);
    }

    for (const n of notes) {
      if (type && n.type !== type) continue;
      if (tag && !n.tags.includes(tag)) continue;
      if (status && n.status !== status) continue;
      let score = 0;
      if (matcher(n.title)) score += 10;
      if (matcher(n.file)) score += 8;
      if (n.tags.some(t => matcher(t))) score += 5;
      if (matcher(n.summary)) score += 3;
      if (matcher(n.body || '')) score += 1;
      if (score > 0) {
        const { body, ...rest } = n;
        results.push({ ...rest, _score: score });
      }
    }
    const sorted = results.sort((a, b) => b._score - a._score).map(({ _score, ...rest }) => rest);

    // Cache the results if cache is available
    if (this.searchCache) {
      this.searchCache.set(keyword, { type, tag, status, regex }, sorted);
    }

    return sorted;
  }

  // ── Initiative B: Parallel search (B2.3 executor) ────


  // ── Initiative B: Metrics export ───────────────────

  /**
   * Get aggregated search metrics
   * @returns {Object} Metrics including query counts and cache stats
   */
  getSearchMetrics() {
    return {
      totalQueries: this.searchMetrics.queries,
      cacheHits: this.searchMetrics.cacheHits,
      cacheHitRate: this.searchMetrics.queries > 0
        ? (this.searchMetrics.cacheHits / this.searchMetrics.queries * 100).toFixed(2) + '%'
        : '0%',
      indexerMetrics: this.indexer ? this.indexer.getIncrementalStats() : null
    };
  }

  /**
   * Reset all search metrics to zero
   */
  resetSearchMetrics() {
    this.searchMetrics = { queries: 0, cacheHits: 0, parallelUsed: 0 };
    if (this.indexer) this.indexer.resetCache();
  }

  // ── Find backlinks (notes that link TO a given note) ─

  backlinks(noteName) {
    // Use ripgrep to pre-filter files containing [[noteName]]
    const rgFiles = this._rgPrefilter(`[[${noteName}]]`, false);
    const notes = this.scanNotes();
    return notes.filter(n => {
      if (n.file === noteName) return false;
      if (n.related.includes(noteName)) return true;
      // Check rg results or fallback to body scan
      if (rgFiles !== null) {
        const filePath = this.path(n.dir, `${n.file}.md`);
        if (!rgFiles.has(filePath)) return false;
      }
      const content = this.read(n.dir, `${n.file}.md`);
      return (content || '').includes(`[[${noteName}]]`);
    });
  }

  // ── Find orphan notes (no inbound links) ─────────────

  orphans() {
    const notes = this.scanNotes({ includeBody: true });
    const linked = new Set();
    for (const n of notes) {
      for (const rel of n.related) linked.add(rel);
      const wikilinks = (n.body || '').match(/\[\[([^\]]+)\]\]/g) || [];
      for (const wl of wikilinks) linked.add(wl.slice(2, -2));
    }
    return notes.filter(n => !linked.has(n.file) && n.type !== 'journal')
      .map(({ body, ...rest }) => rest);
  }

  // ── Update frontmatter fields on a note ──────────────

  updateNote(dir, filename, updates) {
    const filePath = `${dir}/${filename}.md`;
    let content = this.read(filePath);
    if (!content) return null;
    content = updateFrontmatter(content, updates);
    this.write(filePath, content);
    return true;
  }

  // ── Vault stats (single-pass, no rescan) ────────────

  stats() {
    const notes = this.scanNotes({ includeBody: true });
    const byType = {};
    const byStatus = {};
    const byTag = {};
    const linked = new Set();
    for (const n of notes) {
      byType[n.type] = (byType[n.type] || 0) + 1;
      byStatus[n.status] = (byStatus[n.status] || 0) + 1;
      for (const t of n.tags) byTag[t] = (byTag[t] || 0) + 1;
      for (const rel of n.related) linked.add(rel);
      const wikilinks = (n.body || '').match(/\[\[([^\]]+)\]\]/g) || [];
      for (const wl of wikilinks) linked.add(wl.slice(2, -2));
    }
    const orphanCount = notes.filter(n => !linked.has(n.file) && n.type !== 'journal').length;
    return { total: notes.length, byType, byStatus, byTag, orphans: orphanCount };
  }

  // ── Find related notes (TF-IDF weighted) ────────────

  findRelated(title, tags = [], maxResults = 5) {
    const engine = new SimilarityEngine(this, { includeBody: true });
    return engine.findRelated(title, tags, maxResults);
  }

  // ── Find note by name (fuzzy) ───────────────────────

  findNote(name) {
    if (!name) return null;
    const notes = this.scanNotes();
    // Exact match
    const exact = notes.find(n => n.file === name);
    if (exact) return exact;
    // Case-insensitive match
    const lower = name.toLowerCase();
    const ci = notes.find(n => n.file.toLowerCase() === lower);
    if (ci) return ci;
    // Partial match (contains)
    const partial = notes.filter(n => n.file.toLowerCase().includes(lower));
    if (partial.length === 1) return partial[0];
    // Title match
    const titleMatch = notes.filter(n => n.title.toLowerCase().includes(lower));
    if (titleMatch.length === 1) return titleMatch[0];
    // Multiple matches — return closest (shortest file name containing the query)
    const allMatches = [...new Set([...partial, ...titleMatch])];
    if (allMatches.length > 0) {
      return allMatches.sort((a, b) => a.file.length - b.file.length)[0];
    }
    return null;
  }

  // ── Type → directory mapping ─────────────────────────

  typeDir(type) {
    const map = { area: 'areas', project: 'projects', resource: 'resources', idea: 'ideas', journal: 'journal' };
    const i = type.indexOf('/');
    if (i !== -1) {
      const base = type.slice(0, i);
      const sub = type.slice(i + 1);
      return `${map[base] || base}/${sub}`;
    }
    return map[type] || type;
  }
}
