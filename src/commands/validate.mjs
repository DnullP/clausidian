/**
 * validate — check frontmatter completeness and find issues
 */
import { Vault } from '../vault.mjs';

const REQUIRED_FIELDS = ['title', 'type', 'tags', 'created', 'updated', 'status', 'summary'];
const VALID_TYPES = ['area', 'project', 'resource', 'journal', 'idea'];
const VALID_STATUSES = ['active', 'draft', 'archived'];

export function validate(vaultRoot) {
  const vault = new Vault(vaultRoot);
  const notes = vault.scanNotes();
  const issues = [];

  for (const note of notes) {
    const content = vault.read(note.dir, `${note.file}.md`);
    if (!content) continue;
    const fm = vault.parseFrontmatter(content);
    const noteIssues = [];

    // Missing required fields
    for (const field of REQUIRED_FIELDS) {
      if (!fm[field] && field !== 'summary') {
        noteIssues.push(`missing ${field}`);
      }
    }

    // Invalid type
    if (fm.type && !VALID_TYPES.includes(fm.type)) {
      noteIssues.push(`invalid type: ${fm.type}`);
    }

    // Invalid status
    if (fm.status && !VALID_STATUSES.includes(fm.status)) {
      noteIssues.push(`invalid status: ${fm.status}`);
    }

    // Empty tags
    if (Array.isArray(fm.tags) && fm.tags.length === 0 && note.type !== 'journal') {
      noteIssues.push('no tags');
    }

    // Missing summary (warning, not error)
    if (!fm.summary && note.type !== 'journal') {
      noteIssues.push('no summary');
    }

    // Date format check
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (fm.created && !dateRe.test(fm.created)) {
      noteIssues.push(`invalid created date: ${fm.created}`);
    }
    if (fm.updated && !dateRe.test(fm.updated)) {
      noteIssues.push(`invalid updated date: ${fm.updated}`);
    }

    // Stale (updated > 90 days ago)
    if (fm.updated && fm.status === 'active') {
      const updated = new Date(fm.updated);
      const daysSince = Math.floor((Date.now() - updated) / 86400000);
      if (daysSince > 90) {
        noteIssues.push(`stale (${daysSince} days since update)`);
      }
    }

    // ── Wiki-specific checks (resources/wiki/ entries) ──
    const isWiki = note.type === 'resource/wiki' ||
                   (note.type && note.type.startsWith('resource/wiki/')) ||
                   (note.dir && (note.dir === 'resources/wiki' || note.dir.startsWith('resources/wiki/')));
    if (isWiki) {
      // 1. Chinese characters in filename (should use English slug)
      if (/[\u4e00-\u9fff]/.test(note.file)) {
        noteIssues.push('filename contains Chinese characters (use English slug, Chinese title in aliases)');
      }

      // 2. aliases must be present and non-empty
      if (!fm.aliases || (Array.isArray(fm.aliases) && fm.aliases.length === 0)) {
        noteIssues.push('missing or empty aliases (Chinese title goes here)');
      }

      // 3. maturity is required for wiki entries
      const validMaturities = ['seedling', 'budding', 'evergreen', 'evergreen+'];
      if (!fm.maturity) {
        noteIssues.push('missing maturity (seedling/budding/evergreen/evergreen+)');
      } else if (fm.maturity && !validMaturities.includes(fm.maturity)) {
        noteIssues.push(`invalid maturity: ${fm.maturity}`);
      }

      // 4. <br> HTML tags in body (should use markdown line breaks)
      const body = content.replace(/^---[\s\S]*?---/, ''); // Strip frontmatter
      if (/<br\s*\/?>/i.test(body)) {
        noteIssues.push('contains <br> HTML tag (use markdown blank lines instead)');
      }

      // 5. related field format — must be YAML list, not wikilinks
      if (fm.related !== undefined && fm.related !== null) {
        if (typeof fm.related === 'string') {
          noteIssues.push('related should be a YAML list [...], not a single string');
        } else if (Array.isArray(fm.related)) {
          for (const rel of fm.related) {
            if (typeof rel === 'string' && rel.startsWith('[[') && rel.endsWith(']]')) {
              noteIssues.push('related contains wikilinks (remove [[ ]], use bare filenames)');
              break;
            }
          }
        }
      } else {
        noteIssues.push('missing related field');
      }

      // 6. wikilinks should be embedded in body, not only in Connections section
      const connHeader = body.match(/\n## (?:Connections|See Also)/);
      if (connHeader) {
        const bodyBefore = body.substring(0, connHeader.index);
        const connSection = body.substring(connHeader.index);
        const bodyLinks = (bodyBefore.match(/\[\[([^\]]+)\]\]/g) || []);
        const connLinks = (connSection.match(/\[\[([^\]]+)\]\]/g) || []);
        if (bodyLinks.length === 0 && connLinks.length > 0) {
          noteIssues.push('wikilinks only in Connections section, embed in body at first mention (链接应嵌入正文)');
        }
      }
    }

    // ── Non-wiki notes mistakenly in wiki directory ──
    if (!isWiki && note.dir && (note.dir === 'resources/wiki' || note.dir.startsWith('resources/wiki/'))) {
      noteIssues.push('in wiki directory but type is not resource/wiki/*');
    }

    if (noteIssues.length) {
      issues.push({ file: note.file, dir: note.dir, type: note.type, issues: noteIssues });
    }
  }

  // ── Orphan wiki entry check (zero inbound references) ──
  // Build set of all linked targets from non-journal notes
  const linkedTargets = new Set();
  const wikiNotes = [];
  const allNoteFiles = new Set(notes.map(n => n.file));
  for (const note of notes) {
    if (note.type !== 'journal') {
      for (const rel of note.related) linkedTargets.add(rel);
    }
    const isWikiNote = note.type === 'resource/wiki' ||
                       (note.type && note.type.startsWith('resource/wiki/')) ||
                       (note.dir && (note.dir === 'resources/wiki' || note.dir.startsWith('resources/wiki/')));
    if (isWikiNote) wikiNotes.push(note);
  }
  // Also scan body wikilinks from non-journal notes
  // Simultaneously collect broken wikilinks per source note
  const brokenLinks = {};
  for (const note of notes) {
    if (note.type === 'journal') continue;
    const content = vault.read(note.dir, `${note.file}.md`);
    if (!content) continue;
    const body = content.replace(/^---[\s\S]*?---/, '');
    const wikilinks = body.match(/\[\[([^\]]+)\]\]/g) || [];
    for (const wl of wikilinks) {
      const target = wl.slice(2, -2);
      // Skip date-like patterns (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(target)) continue;
      linkedTargets.add(target);
      // Check for broken wikilink: target doesn't exist in vault
      if (!allNoteFiles.has(target)) {
        if (!brokenLinks[note.file]) brokenLinks[note.file] = [];
        if (!brokenLinks[note.file].includes(target)) brokenLinks[note.file].push(target);
      }
    }
  }
  // Add orphan warnings to issue list
  const existingIssueFiles = new Set(issues.map(i => i.file));
  for (const wikiNote of wikiNotes) {
    if (!linkedTargets.has(wikiNote.file) && !linkedTargets.has(wikiNote.title)) {
      const orphanMsg = 'orphan wiki entry, no inbound links from non-journal notes (孤岛词条)';
      if (existingIssueFiles.has(wikiNote.file)) {
        const entry = issues.find(i => i.file === wikiNote.file);
        entry.issues.push(orphanMsg);
      } else {
        issues.push({ file: wikiNote.file, dir: wikiNote.dir, type: wikiNote.type, issues: [orphanMsg] });
      }
    }
  }

  // ── Broken wikilink check (target note doesn't exist) ──
  for (const [sourceFile, brokenTargets] of Object.entries(brokenLinks)) {
    const targetList = brokenTargets.join(', ');
    const msg = `broken wikilink(s): ${targetList} — target note not found (目标词条不存在)`;
    if (existingIssueFiles.has(sourceFile)) {
      const entry = issues.find(i => i.file === sourceFile);
      entry.issues.push(msg);
    } else {
      const srcNote = notes.find(n => n.file === sourceFile);
      issues.push({ file: sourceFile, dir: srcNote?.dir || '', type: srcNote?.type || '', issues: [msg] });
    }
  }

  if (!issues.length) {
    console.log('All notes pass validation.');
    return { valid: true, issues: [] };
  }

  // Group by severity
  const errors = issues.filter(i => i.issues.some(s => s.startsWith('missing') || s.startsWith('invalid')));
  const warnings = issues.filter(i => !errors.includes(i));

  console.log(`\nValidation Report: ${issues.length} note(s) with issues\n`);

  if (errors.length) {
    console.log(`Errors (${errors.length}):`);
    for (const e of errors) {
      console.log(`  ${e.dir}/${e.file}.md — ${e.issues.join(', ')}`);
    }
  }

  if (warnings.length) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const w of warnings) {
      console.log(`  ${w.dir}/${w.file}.md — ${w.issues.join(', ')}`);
    }
  }

  return { valid: false, issues, errorCount: errors.length, warningCount: warnings.length };
}
