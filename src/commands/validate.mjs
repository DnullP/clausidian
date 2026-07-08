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

    if (noteIssues.length) {
      issues.push({ file: note.file, dir: note.dir, type: note.type, issues: noteIssues });
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
