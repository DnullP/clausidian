/**
 * MCP Server — expose vault operations as MCP tools via stdio
 *
 * Implements Model Context Protocol (JSON-RPC 2.0 over stdio)
 * Zero dependencies — raw readline + JSON parsing
 *
 * Tools and dispatch derived from registry — single source of truth.
 * Resources expose vault index files. Prompts provide common operations.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Vault } from './vault.mjs';
import { getMcpTools, getMcpDispatch } from './registry.mjs';
import { todayStr } from './dates.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_VERSION = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8')).version;

// Tools and dispatch from registry — no manual duplication
const TOOLS = getMcpTools();
const DISPATCH = getMcpDispatch();

// ── MCP Resources ──────────────────────────────────────

const RESOURCES = [
  { uri: 'vault://index', name: 'Vault Index', description: 'Global vault index (_index.md)', mimeType: 'text/markdown' },
  { uri: 'vault://tags', name: 'Tag Index', description: 'Tag-to-note mapping (_tags.md)', mimeType: 'text/markdown' },
  { uri: 'vault://graph', name: 'Knowledge Graph', description: 'Relationship graph with TF-IDF suggestions (_graph.md)', mimeType: 'text/markdown' },
  { uri: 'vault://context', name: 'Vault Context', description: 'Today\'s journal + active projects + 7-day activity summary', mimeType: 'text/markdown' },
  { uri: 'vault://active-projects', name: 'Active Projects', description: 'All active project notes with title, summary, and tags', mimeType: 'text/markdown' },
  { uri: 'vault://health', name: 'Vault Health', description: 'Health score JSON and improvement suggestions', mimeType: 'application/json' },
];

const RESOURCE_FILE_MAP = {
  'vault://index': '_index.md',
  'vault://tags': '_tags.md',
  'vault://graph': '_graph.md',
};

// ── MCP Prompts ────────────────────────────────────────

const PROMPTS = [
  {
    name: 'daily-journal',
    description: 'Create or open today\'s journal entry',
    arguments: [
      { name: 'date', description: 'Date in YYYY-MM-DD format (default: today)', required: false },
    ],
  },
  {
    name: 'weekly-review',
    description: 'Generate a weekly review summary',
    arguments: [],
  },
  {
    name: 'capture-idea',
    description: 'Quick capture an idea to the vault',
    arguments: [
      { name: 'text', description: 'The idea text to capture', required: true },
    ],
  },
  {
    name: 'session-start',
    description: 'Gather today\'s work context from the vault',
    arguments: [],
  },
  {
    name: 'project-review',
    description: 'Review a specific project with context and progress',
    arguments: [
      { name: 'project', description: 'Project filename (e.g., "build-api")', required: true },
    ],
  },
  {
    name: 'knowledge-extraction',
    description: 'Extract and persist knowledge from conversation',
    arguments: [],
  },
];

function buildPromptMessages(name, args = {}) {
  switch (name) {
    case 'daily-journal':
      return {
        messages: [{
          role: 'user',
          content: { type: 'text', text: `Create or open today's journal entry${args.date ? ` for ${args.date}` : ''}. Use the journal tool.` },
        }],
      };
    case 'weekly-review':
      return {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Generate a weekly review. Use the review tool to create a comprehensive summary of this week\'s activity.' },
        }],
      };
    case 'capture-idea':
      if (!args.text) throw new Error('Missing required argument: text');
      return {
        messages: [{
          role: 'user',
          content: { type: 'text', text: `Capture this idea: "${args.text}". Use the capture tool.` },
        }],
      };
    case 'session-start':
      return {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Read vault://context to understand today\'s work context. Use the daily tool if today\'s journal doesn\'t exist yet. Summarize what I should focus on today.' },
        }],
      };
    case 'project-review':
      if (!args.project) throw new Error('Missing required argument: project');
      return {
        messages: [{
          role: 'user',
          content: { type: 'text', text: `Review the project [[${args.project}]]. Read the note, check its backlinks, look at recent journal mentions. Then ask: 1) What\'s the current status? 2) What are the next steps? 3) Any blockers?` },
        }],
      };
    case 'knowledge-extraction':
      return {
        messages: [{
          role: 'user',
          content: { type: 'text', text: 'Based on our conversation, identify: 1) Key decisions made (## Decisions). 2) Learnings or insights (## Learnings). 3) Next steps (## Next). For each item, suggest whether to store in journal, a project note, or areas/learnings.md. Then use clausidian tools to persist them.' },
        }],
      };
    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

// ── Server class ─────────────────────────────────────

export class McpServer {
  constructor(vaultRoot) {
    this.vaultRoot = vaultRoot;
    this._vault = null;
  }

  get vault() {
    if (!this._vault) this._vault = new Vault(this.vaultRoot);
    return this._vault;
  }

  async handleToolCall(name, args) {
    this.vault.invalidateCache();

    const handler = DISPATCH[name];
    if (!handler) throw new Error(`Unknown tool: ${name}`);

    const origLog = console.log;
    const origError = console.error;
    console.log = () => {};
    console.error = () => {};
    try {
      return await handler(this.vaultRoot, args);
    } finally {
      console.log = origLog;
      console.error = origError;
    }
  }

  readResource(uri) {
    // Dynamic resources computed at runtime
    if (uri === 'vault://context') {
      return this._buildContextResource();
    }
    if (uri === 'vault://active-projects') {
      return this._buildActiveProjectsResource();
    }
    if (uri === 'vault://health') {
      return this._buildHealthResource();
    }

    // Static file resources
    const filename = RESOURCE_FILE_MAP[uri];
    if (!filename) throw new Error(`Unknown resource: ${uri}`);
    const filePath = resolve(this.vaultRoot, filename);
    try {
      return readFileSync(filePath, 'utf8');
    } catch {
      return '';
    }
  }

  _buildContextResource() {
    const date = todayStr();

    // Read today's journal
    let contextParts = [];
    const journalContent = this.vault.read('journal', `${date}.md`);
    if (journalContent) {
      const recordsMatch = journalContent.match(/## (?:今日[記记]錄|Records)\n([\s\S]*?)(?=\n## |\n---|$)/);
      if (recordsMatch) {
        contextParts.push(`## Today's Records\n${recordsMatch[1]}`);
      }
    }

    // Active projects
    const notes = this.vault.scanNotes();
    const activeProjects = notes
      .filter(n => n.type === 'project' && n.status === 'active')
      .slice(0, 5);
    if (activeProjects.length > 0) {
      const projList = activeProjects
        .map(p => `- [[${p.file}]]: ${p.summary || p.title}`)
        .join('\n');
      contextParts.push(`## Active Projects\n${projList}`);
    }

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentNotes = notes
      .filter(n => new Date(n.updated) >= sevenDaysAgo)
      .sort((a, b) => new Date(b.updated) - new Date(a.updated))
      .slice(0, 5);
    if (recentNotes.length > 0) {
      const activityList = recentNotes
        .map(n => `- [[${n.file}]] (${n.updated})`)
        .join('\n');
      contextParts.push(`## Recent Activity (7d)\n${activityList}`);
    }

    return contextParts.join('\n\n') || 'No context available';
  }

  _buildActiveProjectsResource() {
    const notes = this.vault.scanNotes();
    const activeProjects = notes.filter(n => n.type === 'project' && n.status === 'active');

    if (activeProjects.length === 0) return '## No active projects';

    const rows = activeProjects.map(p => {
      const tags = p.tags.slice(0, 3).join(', ');
      return `| [[${p.file}]] | ${p.summary || p.title} | ${tags} |`;
    });

    return '| File | Summary | Tags |\n|------|---------|------|\n' + rows.join('\n');
  }

  _buildHealthResource() {
    const notes = this.vault.scanNotes();

    // Basic health metrics
    const completeness = notes.length > 0
      ? Math.round((notes.filter(n => n.summary && n.tags.length > 0).length / notes.length) * 100)
      : 0;

    const withRelated = notes.filter(n => n.related && n.related.length > 0).length;
    const connectivity = notes.length > 0 ? Math.round((withRelated / notes.length) * 100) : 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentCount = notes.filter(n => new Date(n.updated) >= sevenDaysAgo).length;
    const freshness = notes.length > 0 ? Math.round((recentCount / notes.length) * 100) : 0;

    const organization = notes.filter(n => n.type && n.status).length;
    const orgScore = notes.length > 0 ? Math.round((organization / notes.length) * 100) : 0;

    const suggestions = [];
    if (notes.filter(n => !n.summary).length > 0) suggestions.push('Add summaries to notes');
    if (notes.filter(n => n.related.length === 0).length > notes.length * 0.5) suggestions.push('Consider linking more notes');
    if (recentCount < notes.length * 0.3) suggestions.push('Update stale notes');

    return JSON.stringify({
      overall: (completeness + connectivity + freshness + orgScore) / 4,
      completeness,
      connectivity,
      freshness,
      organization: orgScore,
      totalNotes: notes.length,
      suggestions: suggestions.length > 0 ? suggestions : ['Vault health is good'],
    }, null, 2);
  }

  handleMessage(msg) {
    const { id, method, params } = msg;

    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0', id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {}, resources: {}, prompts: {} },
            serverInfo: { name: 'clausidian', version: PKG_VERSION },
          },
        };

      case 'notifications/initialized':
        return null;

      // ── Tools ──
      case 'tools/list':
        return { jsonrpc: '2.0', id, result: { tools: TOOLS } };

      case 'tools/call':
        return this.handleToolCall(params.name, params.arguments || {}).then(result => ({
          jsonrpc: '2.0', id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          },
        })).catch(err => ({
          jsonrpc: '2.0', id,
          error: { code: -32000, message: err.message },
        }));

      // ── Resources ──
      case 'resources/list':
        return { jsonrpc: '2.0', id, result: { resources: RESOURCES } };

      case 'resources/read': {
        const uri = params?.uri;
        try {
          const content = this.readResource(uri);
          return {
            jsonrpc: '2.0', id,
            result: {
              contents: [{ uri, mimeType: 'text/markdown', text: content }],
            },
          };
        } catch (err) {
          return { jsonrpc: '2.0', id, error: { code: -32000, message: err.message } };
        }
      }

      // ── Prompts ──
      case 'prompts/list':
        return { jsonrpc: '2.0', id, result: { prompts: PROMPTS } };

      case 'prompts/get': {
        const promptName = params?.name;
        try {
          const result = buildPromptMessages(promptName, params?.arguments || {});
          return { jsonrpc: '2.0', id, result };
        } catch (err) {
          return { jsonrpc: '2.0', id, error: { code: -32000, message: err.message } };
        }
      }

      default:
        return {
          jsonrpc: '2.0', id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  }

  start() {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          const response = this.handleMessage(msg);
          if (response && typeof response.then === 'function') {
            response.then(r => { if (r) process.stdout.write(JSON.stringify(r) + '\n'); });
          } else if (response) {
            process.stdout.write(JSON.stringify(response) + '\n');
          }
        } catch {
          process.stdout.write(JSON.stringify({
            jsonrpc: '2.0', id: null,
            error: { code: -32700, message: 'Parse error' },
          }) + '\n');
        }
      }
    });

    process.stderr.write('clausidian MCP server started\n');
  }
}
