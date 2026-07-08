/**
 * hook — event handlers for agent hooks (session-stop, daily-backfill, weekly-review)
 */
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { dirname } from 'path';
import { Vault } from '../vault.mjs';
import { TemplateEngine } from '../templates.mjs';
import { IndexManager } from '../index-manager.mjs';
import { todayStr, weekdayShort, prevDate, nextDate } from '../dates.mjs';
import { notify } from '../notify.mjs';
import { buildTagIDF, scoreRelatedness } from '../scoring.mjs';

function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', timeout: 30000 }).trim(); }
  catch { return ''; }
}

// ── Collect git commits for a date across all repos in a directory ──

function getGitCommits(scanRoot, date) {
  const since = `${date}T00:00:00`;
  const until = `${nextDate(date)}T00:00:00`;
  const gitDirs = run(`find "${scanRoot}" -maxdepth 5 -name ".git" -type d 2>/dev/null`);
  if (!gitDirs) return [];

  const commits = [];
  for (const gitDir of gitDirs.split('\n').filter(Boolean)) {
    const repo = dirname(gitDir);
    const repoName = repo.split('/').pop();
    const log = run(`git -C "${repo}" log --oneline --since="${since}" --until="${until}" --all 2>/dev/null`);
    if (log) {
      for (const line of log.split('\n').filter(Boolean)) {
        commits.push({ repo: repoName, message: line.replace(/^[a-f0-9]+ /, '') });
      }
    }
  }
  return commits;
}

// ── A4: Extract conclusions and resolved items, update frontmatter tags ──

function tagConclusions(content) {
  const ideasMatch = content.match(/## (?:想法|Ideas)\n([\s\S]*?)(?=\n## |\n---|$)/);
  const issuesMatch = content.match(/## (?:問題與風險|问题与风险|Issues)\n([\s\S]*?)(?=\n## |\n---|$)/);

  // Check if "想法" has conclusive statements (not questions, not "待驗證")
  const hasConclusion = ideasMatch && ideasMatch[1].split('\n')
    .filter(l => l.trim().startsWith('- ') && l.trim() !== '-')
    .some(l => {
      const text = l.replace(/^-\s*/, '').trim();
      return text.length > 5
        && !text.includes('？') && !text.includes('?')
        && !text.includes('待驗證') && !text.includes('待验证')
        && !text.includes('待確認') && !text.includes('待确认')
        && !text.includes('TBD');
    });

  // Check if "問題與風險" has resolved items
  const hasResolved = issuesMatch && /✅|已解決|已解决|已修復|已修复|resolved|fixed/i.test(issuesMatch[1]);

  const tagsMatch = content.match(/tags:\s*\[([^\]]*)\]/);
  if (tagsMatch) {
    const tags = tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean);
    if (hasConclusion && !tags.includes('conclusion')) tags.push('conclusion');
    if (hasResolved && !tags.includes('resolved')) tags.push('resolved');
    content = content.replace(/tags:\s*\[[^\]]*\]/, `tags: [${tags.join(', ')}]`);
  }
  return content;
}

// ── session-start: gather today's context (active projects, plans, focus) ──

export function sessionStart(vaultRoot, options = {}) {
  const vault = new Vault(vaultRoot);
  const date = todayStr();

  try {
    // Read today's journal Tomorrow section (plans)
    const journalContent = vault.read('journal', `${date}.md`);
    let tomorrowItems = [];
    if (journalContent) {
      // Extract Tomorrow / 明日計劃 section
      const tomorrowMatch = journalContent.match(/## (?:Tomorrow|明日計劃|明天计划)\n([\s\S]*?)(?=\n## |\n---|$)/);
      if (tomorrowMatch) {
        tomorrowItems = tomorrowMatch[1]
          .split('\n')
          .filter(l => l.trim().startsWith('- ') && l.trim() !== '-')
          .map(l => l.trim());
      }
    }

    // Get active projects (top 5)
    const notes = vault.scanNotes();
    const activeProjects = notes
      .filter(n => n.type === 'project' && n.status === 'active')
      .slice(0, 5)
      .map(n => `- [[${n.file}]]: ${n.summary || n.title}`);

    // Try to read focus area (areas/focus.md or areas/clausidian-focus.md)
    let focusContext = '';
    let focusNote = vault.read('areas', 'focus.md');
    if (!focusNote) focusNote = vault.read('areas', 'clausidian-focus.md');
    if (focusNote) {
      const fm = vault.parseFrontmatter(focusNote);
      focusContext = fm.summary || vault.extractBody(focusNote).slice(0, 200);
    }

    // Build context string
    const contextParts = [];
    if (activeProjects.length > 0) contextParts.push(`Active projects:\n${activeProjects.join('\n')}`);
    if (tomorrowItems.length > 0) contextParts.push(`Today's plans:\n${tomorrowItems.join('\n')}`);
    if (focusContext) contextParts.push(`Focus: ${focusContext}`);

    const output = {
      date,
      activeProjects: activeProjects.length,
      todayPlans: tomorrowItems.length,
      context: contextParts.join('\n\n'),
    };

    // Emit event
    vault.eventBus.emit('session:start', { date });
    vault.eventHistory.append('session:start', { date });
    console.log(JSON.stringify(output));
    return output;
  } catch (err) {
    console.error(`[session-start error] ${err.message}`);
    console.log(JSON.stringify({ status: 'error', date, reason: err.message }));
  }
}

// ── pre-tool-use: log Write/Edit operations to journal Records ──

export function preToolUse(vaultRoot, options = {}) {
  const vault = new Vault(vaultRoot);
  const date = todayStr();

  try {
    const { tool_name, tool_input } = options;

    // Only watch Write/Edit operations
    const watchedTools = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'];
    if (!watchedTools.includes(tool_name)) {
      console.log(JSON.stringify({ status: 'skipped', tool: tool_name }));
      return;
    }

    // Get file path (try both 'path' and 'file_path' keys)
    const filePath = tool_input?.path || tool_input?.file_path || 'unknown';
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const recordLine = `- [${timestamp}] ${tool_name}: \`${filePath}\``;

    // Check if journal exists for today
    const journalPath = `journal/${date}.md`;
    const existing = vault.read('journal', `${date}.md`);
    if (!existing) {
      // Journal doesn't exist, skip silently (don't force create)
      console.log(JSON.stringify({ status: 'skipped', reason: 'no journal today' }));
      return;
    }

    // Append to Records section
    let updated = existing.replace(
      /## (?:今日[記记]錄|Records)\n/,
      `## Records\n${recordLine}\n`
    );

    // If Records section doesn't exist, append to end
    if (updated === existing) {
      updated = existing.trimEnd() + `\n\n## Records\n${recordLine}\n`;
    }

    vault.write('journal', `${date}.md`, updated);
    vault.eventBus.emit('tool:used', { tool: tool_name, path: filePath, date });
    vault.eventHistory.append('tool:used', { tool: tool_name, path: filePath, date });
    console.log(JSON.stringify({ status: 'logged', tool: tool_name, path: filePath }));
  } catch (err) {
    console.error(`[pre-tool-use error] ${err.message}`);
    console.log(JSON.stringify({ status: 'error', reason: err.message }));
  }
}

// ── session-stop: append session summary to today's journal ──

export function sessionStop(vaultRoot, options = {}) {
  const vault = new Vault(vaultRoot);
  const tpl = new TemplateEngine(vaultRoot);
  const idx = new IndexManager(vault);
  const date = todayStr();

  // Extract payload (merged from stdin at registry level)
  const { stop_reason, scanRoot, decisions, learnings, nextSteps } = options;
  const reason = stop_reason;
  if (!reason || reason === 'unknown') {
    console.log(JSON.stringify({ status: 'skipped', date, reason: 'no valid stop_reason' }));
    return;
  }

  const sessionNote = reason === 'user' ? 'User ended session' : `Session ended (${reason})`;
  const existing = vault.read('journal', `${date}.md`);

  if (existing) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const appendLine = `\n- [${timestamp}] ${sessionNote}`;
    let updated = existing.replace(/## (今日[記记]錄|Records)\n/, `## $1\n${appendLine}\n`);
    // A4: Tag conclusions and resolved issues
    updated = tagConclusions(updated);

    // Handle optional decisions/learnings/nextSteps
    if (decisions && Array.isArray(decisions) && decisions.length > 0) {
      const decisionLines = decisions.map(d => `- [${date}] ${d}`).join('\n');
      const decisionNote = vault.read('areas', 'decisions.md') || '';
      vault.write('areas', 'decisions.md', decisionNote + (decisionNote ? '\n' : '') + decisionLines + '\n');
    }

    if (learnings && Array.isArray(learnings) && learnings.length > 0) {
      const learningLines = learnings.map(l => `- [${date}] ${l}`).join('\n');
      const learningNote = vault.read('areas', 'learnings.md') || '';
      vault.write('areas', 'learnings.md', learningNote + (learningNote ? '\n' : '') + learningLines + '\n');
    }

    if (nextSteps && Array.isArray(nextSteps) && nextSteps.length > 0) {
      const nextStepLines = nextSteps.map(n => `- [ ] ${n}`).join('\n');
      updated = updated.replace(
        /## (?:Tomorrow|明日計劃|明天计划)\n/,
        `## Tomorrow\n${nextStepLines}\n`
      );
      // If Tomorrow section doesn't exist, append it
      if (!updated.includes('## Tomorrow')) {
        updated += `\n## Tomorrow\n${nextStepLines}\n`;
      }
    }

    vault.write('journal', `${date}.md`, updated);
    // v3.5: Emit session-stop event
    vault.eventBus.emit('session:stop', { date, reason, action: 'appended' });
    vault.eventHistory.append('session:stop', { date, reason, action: 'appended' });
    notify('Obsidian Agent', `Session logged to ${date}`);
    console.log(JSON.stringify({ status: 'appended', date }));
  } else {
    const root = scanRoot || dirname(vaultRoot) || '.';
    const commits = getGitCommits(root, date);
    const summary = commits.length > 0
      ? `${commits.length} commits across ${new Set(commits.map(c => c.repo)).size} repos`
      : 'Auto-recorded session';

    const content = tpl.render('journal', {
      DATE: date,
      WEEKDAY: weekdayShort(date),
      PREV_DATE: prevDate(date),
      NEXT_DATE: nextDate(date),
    });

    vault.write('journal', `${date}.md`, content);
    idx.updateDirIndex('journal', date, summary);
    // v3.5: Emit session-stop event
    vault.eventBus.emit('session:stop', { date, reason, action: 'created' });
    vault.eventHistory.append('session:stop', { date, reason, action: 'created' });
    notify('Obsidian Agent', `Journal created for ${date}`);
    console.log(JSON.stringify({ status: 'created', date }));
  }
}

// ── daily-backfill: create journal from git history ──

export function dailyBackfill(vaultRoot, { date, scanRoot, force } = {}) {
  const vault = new Vault(vaultRoot);
  const tpl = new TemplateEngine(vaultRoot);
  const idx = new IndexManager(vault);
  const d = date || todayStr();

  if (vault.exists('journal', `${d}.md`) && !force) {
    console.log(JSON.stringify({ status: 'skip', date: d, reason: 'already exists' }));
    return;
  }

  const root = scanRoot || dirname(vaultRoot);
  const commits = getGitCommits(root, d);

  // Group commits by repo
  const byRepo = {};
  for (const c of commits) {
    if (!byRepo[c.repo]) byRepo[c.repo] = [];
    byRepo[c.repo].push(c.message);
  }

  let records = '';
  for (const [repo, msgs] of Object.entries(byRepo)) {
    const unique = [...new Set(msgs)];
    if (unique.length <= 3) {
      records += unique.map(m => `- ${repo}: ${m}`).join('\n') + '\n';
    } else {
      records += `- ${repo}: ${unique.length} commits (${unique[0]}...)\n`;
    }
  }
  if (!records.trim()) records = '- (No git activity)\n';

  const content = tpl.render('journal', {
    DATE: d,
    WEEKDAY: weekdayShort(d),
    PREV_DATE: prevDate(d),
    NEXT_DATE: nextDate(d),
  }).replace(/-\n\n## 想法/, `${records.trim()}\n\n## 想法`)
    .replace(/-\n\n## Ideas/, `${records.trim()}\n\n## Ideas`);

  vault.write('journal', `${d}.md`, content);
  const summary = commits.length > 0
    ? `${commits.length} commits across ${new Set(commits.map(c => c.repo)).size} repos`
    : 'No git activity';
  idx.updateDirIndex('journal', d, summary);
  idx.sync();

  // v3.5: Emit daily-backfill event
  vault.eventBus.emit('journal:backfill', { date: d, commits: commits.length });
  vault.eventHistory.append('journal:backfill', { date: d, commits: commits.length });

  notify('Obsidian Agent', `Backfill: journal/${d}.md (${commits.length} commits)`);
  console.log(JSON.stringify({ status: 'created', date: d, commits: commits.length }));
}

// ── Event-driven pipeline: note-created, note-updated, note-deleted, index-rebuilt ──

export function noteCreated(vaultRoot, payload = {}) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);
  const noteName = payload.note || 'unknown';

  try {
    // v3.5: Emit note:created event
    vault.eventBus.emit('note:created', { note: noteName });
    vault.eventHistory.append('note:created', { note: noteName });

    // Scan all notes to find related ones
    const allNotes = vault.scanNotes({ includeBody: true });
    const newNote = allNotes.find(n => n.file === noteName);
    if (!newNote || newNote.tags.length === 0) {
      console.log(JSON.stringify({ status: 'skipped', event: 'note-created', note: noteName, reason: 'no tags' }));
      return;
    }

    // Build tag IDF
    const tagIDF = buildTagIDF(allNotes, 'journal');

    // Find top related notes
    const candidates = allNotes.filter(n => n.file !== noteName && n.type !== 'journal' && !newNote.related.includes(n.file));
    const scored = candidates.map(c => ({
      file: c.file, summary: c.summary, ...scoreRelatedness(newNote, c, tagIDF)
    })).filter(s => s.score >= 1.5 && s.shared.length >= 1)
      .sort((a, b) => b.score - a.score);

    const suggestions = scored.slice(0, 5);
    if (suggestions.length > 0) {
      const result = {
        status: 'created',
        event: 'note-created',
        note: noteName,
        suggestions: suggestions.map(s => ({ note: s.file, score: Math.round(s.score * 10) / 10, tags: s.shared }))
      };
      console.log(JSON.stringify(result));

      // Notify if important (has suggestions)
      const suggestionText = suggestions.map(s => `• [[${s.file}]] (${s.shared.join(', ')})`).join('\n');
      notify('📝 新筆記建立', `<b>${noteName}</b>\n\n建議關聯:\n${suggestionText}`);
    } else {
      console.log(JSON.stringify({ status: 'created', event: 'note-created', note: noteName, suggestions: [] }));
    }
  } catch (err) {
    console.error(`[note-created error] ${err.message}`);
  }
}

export function noteUpdated(vaultRoot, payload = {}) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);
  const noteName = payload.note || 'unknown';
  const changes = payload.changes || {};

  try {
    // v3.5: Emit note:updated event
    vault.eventBus.emit('note:updated', { note: noteName, changes });
    vault.eventHistory.append('note:updated', { note: noteName, changes });

    // Only re-index if tags or body changed
    if (changes.tags || changes.body) {
      const result = idx.rebuildGraph();
      console.log(JSON.stringify({
        status: 'updated',
        event: 'note-updated',
        note: noteName,
        graphRebuilt: true,
        suggestedLinks: result.suggestedLinks
      }));
    } else {
      console.log(JSON.stringify({ status: 'updated', event: 'note-updated', note: noteName }));
    }
  } catch (err) {
    console.error(`[note-updated error] ${err.message}`);
  }
}

export function noteDeleted(vaultRoot, payload = {}) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);
  const noteName = payload.note || 'unknown';

  try {
    // v3.5: Emit note:deleted event
    vault.eventBus.emit('note:deleted', { note: noteName });
    vault.eventHistory.append('note:deleted', { note: noteName });

    // Rebuild graph to remove deleted note references
    idx.rebuildGraph();
    console.log(JSON.stringify({ status: 'deleted', event: 'note-deleted', note: noteName, graphRebuilt: true }));
  } catch (err) {
    console.error(`[note-deleted error] ${err.message}`);
  }
}

export function indexRebuilt(vaultRoot, payload = {}) {
  try {
    const vault = new Vault(vaultRoot);
    // v3.5: Emit index:rebuilt event
    vault.eventBus.emit('index:rebuilt', { timestamp: payload.timestamp || new Date().toISOString() });
    vault.eventHistory.append('index:rebuilt', { timestamp: payload.timestamp || new Date().toISOString() });

    // Optional: notify Telegram or other services
    console.log(JSON.stringify({ status: 'rebuilt', event: 'index-rebuilt', timestamp: payload.timestamp || new Date().toISOString() }));
  } catch (err) {
    console.error(`[index-rebuilt error] ${err.message}`);
  }
}
