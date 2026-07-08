/**
 * bridge — cross-system integration commands
 * Syncs external events/data to vault (Google Calendar, Gmail, GitHub)
 */
import { execSync } from 'child_process';
import { Vault } from '../vault.mjs';
import { todayStr, nextDate } from '../dates.mjs';
import { notify } from '../notify.mjs';

function run(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', timeout: 30000 }).trim(); }
  catch (err) { throw new Error(`gwx error: ${err.message}`); }
}

// ── Google Calendar integration ──

export function bridgeGcal(vaultRoot, { date } = {}) {
  const vault = new Vault(vaultRoot);
  const targetDate = date || todayStr();
  const journalFile = `${targetDate}.md`;

  try {
    // Query gwx calendar for the day
    const fromDate = `${targetDate}T00:00:00Z`;
    const toDate = `${nextDate(targetDate)}T00:00:00Z`;

    let eventsJson;
    try {
      eventsJson = run(`gwx calendar list --from ${targetDate} --to ${nextDate(targetDate)} --format json`);
    } catch (err) {
      if (err.message.includes('oauth2') || err.message.includes('not found')) {
        console.log(JSON.stringify({
          status: 'skipped',
          event: 'bridge_gcal',
          date: targetDate,
          reason: 'gwx not authenticated or installed'
        }));
        return;
      }
      throw err;
    }

    let events = [];
    try {
      const result = JSON.parse(eventsJson);
      if (result.error) {
        console.log(JSON.stringify({
          status: 'error',
          event: 'bridge_gcal',
          date: targetDate,
          error: result.error.message
        }));
        return;
      }
      events = result.events || [];
    } catch {
      console.log(JSON.stringify({
        status: 'skipped',
        event: 'bridge_gcal',
        date: targetDate,
        reason: 'invalid gwx response'
      }));
      return;
    }

    if (events.length === 0) {
      console.log(JSON.stringify({
        status: 'skipped',
        event: 'bridge_gcal',
        date: targetDate,
        reason: 'no events'
      }));
      return;
    }

    // Build meeting blocks
    const meetingBlocks = events.map(event => {
      const start = new Date(event.start.dateTime || event.start.date);
      const end = new Date(event.end.dateTime || event.end.date);
      const startTime = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      const endTime = end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      const attendees = event.attendees ? event.attendees.map(a => a.email).join(', ') : '(organizer)';
      const description = event.description || '(no description)';

      return `### ${event.summary}
- **Time:** ${startTime}–${endTime}
- **Attendees:** ${attendees}
- **Notes:** ${description}
`;
    }).join('\n');

    // Read existing journal
    const existing = vault.read('journal', journalFile);
    if (!existing) {
      console.log(JSON.stringify({
        status: 'skipped',
        event: 'bridge_gcal',
        date: targetDate,
        reason: 'journal not found'
      }));
      return;
    }

    // Append meeting blocks to journal (after ## 今日記錄 or ## Records)
    let updated = existing;
    const recordsMatch = existing.match(/## (今日[記记]錄|Records)\n/);
    if (recordsMatch) {
      const section = recordsMatch[1];
      updated = existing.replace(
        new RegExp(`(## ${section}\\n)`),
        `$1\n## 會議\n\n${meetingBlocks}\n`
      );
    } else {
      // Append at end
      updated = `${existing}\n\n## 會議\n\n${meetingBlocks}`;
    }

    vault.write('journal', journalFile, updated);
    const result = {
      status: 'updated',
      event: 'bridge_gcal',
      date: targetDate,
      meetings: events.length,
      journalFile
    };
    console.log(JSON.stringify(result));
    notify('📅 會議同步', `同步了 ${events.length} 場會議到 ${targetDate}`);
  } catch (err) {
    console.error(`[bridge_gcal error] ${err.message}`);
    return { status: 'error', event: 'bridge_gcal', error: err.message };
  }
}

// ── Gmail integration ──

export function bridgeGmail(vaultRoot, { label, days } = {}) {
  const vault = new Vault(vaultRoot);
  const labelParam = label || 'important';
  const daysParam = days || 1;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysParam);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  try {
    // Query gwx gmail for messages
    let messagesJson;
    const query = `label:${labelParam} after:${cutoffStr}`;
    try {
      messagesJson = run(`gwx gmail search '${query}' --format json`);
    } catch (err) {
      if (err.message.includes('oauth2') || err.message.includes('invalid_client')) {
        console.log(JSON.stringify({
          status: 'skipped',
          event: 'bridge_gmail',
          reason: 'gwx not authenticated or installed'
        }));
        return;
      }
      throw err;
    }

    let messages = [];
    try {
      const result = JSON.parse(messagesJson);
      if (result.error) {
        console.log(JSON.stringify({
          status: 'error',
          event: 'bridge_gmail',
          error: result.error.message
        }));
        return;
      }
      messages = result.messages || [];
    } catch {
      console.log(JSON.stringify({
        status: 'skipped',
        event: 'bridge_gmail',
        reason: 'invalid gwx response'
      }));
      return;
    }

    if (messages.length === 0) {
      console.log(JSON.stringify({
        status: 'skipped',
        event: 'bridge_gmail',
        reason: 'no messages'
      }));
      return;
    }

    // Check for existing ideas to avoid duplicates (based on message ID in title)
    const existingNotes = vault.scanNotes();
    const capturedIds = new Set();
    for (const note of existingNotes) {
      if (note.type === 'idea') {
        // Extract message ID from title if present (format: "[MSG_ID] Subject")
        const idMatch = note.title.match(/\[([a-f0-9]+)\]/);
        if (idMatch) capturedIds.add(idMatch[1]);
      }
    }

    // Capture new messages as ideas
    const captured = [];
    for (const msg of messages) {
      if (capturedIds.has(msg.id)) {
        continue; // Already captured
      }

      // Format: [MSG_ID] From: sender | Subject: subject | Snippet: snippet
      const subject = msg.subject || '(no subject)';
      const from = msg.from || '(unknown sender)';
      const snippet = (msg.snippet || '(no preview)').substring(0, 100);
      const ideaText = `[${msg.id}] From: ${from} | Subject: ${subject} | Snippet: ${snippet}`;

      try {
        const result = run(`clausidian capture '${ideaText.replace(/'/g, "'\\''")}'`);
        captured.push({ messageId: msg.id, subject });
        capturedIds.add(msg.id);
      } catch (err) {
        console.error(`[bridge_gmail capture error] ${err.message}`);
      }
    }

    const result = {
      status: 'captured',
      event: 'bridge_gmail',
      label: labelParam,
      days: daysParam,
      total: messages.length,
      captured: captured.length,
      messages: captured
    };
    console.log(JSON.stringify(result));
    if (captured.length > 0) {
      notify('📧 郵件擷取', `擷取了 ${captured.length} 封郵件 (label: ${labelParam})`);
    }
  } catch (err) {
    console.error(`[bridge_gmail error] ${err.message}`);
    return { status: 'error', event: 'bridge_gmail', error: err.message };
  }
}

// ── GitHub integration ──

export function bridgeGithub(vaultRoot, options = {}) {
  const vault = new Vault(vaultRoot);
  const repoParam = options.repo || null;
  const daysParam = options.days || 1;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysParam);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  try {
    if (!repoParam) {
      console.log(JSON.stringify({
        status: 'skipped',
        event: 'bridge_github',
        reason: 'repo parameter required (e.g., owner/repo)'
      }));
      return;
    }

    // Query gh CLI for recent issues, PRs, releases
    let issuesJson, prsJson, releasesJson;

    try {
      // Issues updated after cutoff date
      issuesJson = run(`gh issue list --repo ${repoParam} --search "updated:>=${cutoffStr}" --json number,title,state,updatedAt --limit 50`);
    } catch (err) {
      if (err.message.includes('not found') || err.message.includes('authentication')) {
        console.log(JSON.stringify({
          status: 'skipped',
          event: 'bridge_github',
          repo: repoParam,
          reason: 'gh not authenticated or repo not found'
        }));
        return;
      }
      throw err;
    }

    try {
      prsJson = run(`gh pr list --repo ${repoParam} --search "updated:>=${cutoffStr}" --json number,title,state,updatedAt --limit 50`);
    } catch {
      prsJson = '[]';
    }

    try {
      releasesJson = run(`gh release list --repo ${repoParam} --limit 10 --json tagName,name,publishedAt`);
    } catch {
      releasesJson = '[]';
    }

    let issues = [], prs = [], releases = [];
    try {
      const issuesResult = JSON.parse(issuesJson);
      issues = issuesResult || [];
    } catch {
      console.log(JSON.stringify({
        status: 'skipped',
        event: 'bridge_github',
        repo: repoParam,
        reason: 'invalid gh issues response'
      }));
      return;
    }

    try {
      const prsResult = JSON.parse(prsJson);
      prs = prsResult || [];
    } catch {}

    try {
      const releasesResult = JSON.parse(releasesJson);
      releases = releasesResult || [];
    } catch {}

    // Find project note for this repo
    const existingNotes = vault.scanNotes();
    let projectNote = null;
    const repoName = repoParam.split('/')[1];

    for (const note of existingNotes) {
      if (note.type === 'project' && (note.title.toLowerCase().includes(repoName) || note.title.toLowerCase().includes(repoParam))) {
        projectNote = note;
        break;
      }
    }

    if (!projectNote) {
      // No project note found, just log what we discovered
      const summary = {
        status: 'scanned',
        event: 'bridge_github',
        repo: repoParam,
        issues: issues.length,
        prs: prs.length,
        releases: releases.length,
        reason: 'no project note found for this repo'
      };
      console.log(JSON.stringify(summary));
      return summary;
    }

    // Read existing project note
    const existing = vault.read('projects', projectNote.file);
    if (!existing) {
      console.log(JSON.stringify({
        status: 'skipped',
        event: 'bridge_github',
        repo: repoParam,
        reason: 'project note unreadable'
      }));
      return;
    }

    let updated = existing;
    let sections = [];

    // Build Open Issues section
    if (issues.length > 0) {
      const openIssues = issues.filter(i => i.state === 'OPEN');
      if (openIssues.length > 0) {
        const issueLines = openIssues.map(i => `- [#${i.number}](https://github.com/${repoParam}/issues/${i.number}) ${i.title}`).join('\n');
        sections.push(`## Open Issues\n\n${issueLines}`);
      }
    }

    // Build Recent Progress section (merged PRs)
    const mergedPrs = prs.filter(p => p.state === 'MERGED');
    if (mergedPrs.length > 0) {
      const prLines = mergedPrs.map(p => `- [#${p.number}](https://github.com/${repoParam}/pull/${p.number}) ${p.title}`).join('\n');
      sections.push(`## 最近進展\n\n${prLines}`);
    }

    // Build Releases section
    if (releases.length > 0) {
      const recentRelease = releases[0];
      const releaseDate = new Date(recentRelease.publishedAt).toISOString().split('T')[0];
      const releaseText = `## 最新版本\n\n**${recentRelease.tagName}** (${releaseDate})\n\n[Release on GitHub](https://github.com/${repoParam}/releases/tag/${recentRelease.tagName})`;
      sections.push(releaseText);
    }

    if (sections.length === 0) {
      console.log(JSON.stringify({
        status: 'skipped',
        event: 'bridge_github',
        repo: repoParam,
        reason: 'no new activity'
      }));
      return;
    }

    // Append sections to project note
    updated = `${existing}\n\n${sections.join('\n\n')}`;

    vault.write('projects', projectNote.file, updated);

    const result = {
      status: 'updated',
      event: 'bridge_github',
      repo: repoParam,
      issues: issues.length,
      prs: mergedPrs.length,
      releases: releases.length,
      projectNote: projectNote.file
    };
    console.log(JSON.stringify(result));
    notify('🐙 GitHub 同步', `同步 ${repoParam}\n• ${issues.length} issues\n• ${mergedPrs.length} merged PRs`);
  } catch (err) {
    console.error(`[bridge_github error] ${err.message}`);
    return { status: 'error', event: 'bridge_github', error: err.message };
  }
}
