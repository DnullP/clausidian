/**
 * changelog — generate vault changelog from recent note activity
 *
 * Groups changes by date: created, updated, archived, deleted
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { Vault } from '../vault.mjs';
import { todayStr } from '../dates.mjs';

export function changelog(vaultRoot, { days = 7, output } = {}) {
  const vault = new Vault(vaultRoot);
  const notes = vault.scanNotes();
  const today = todayStr();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  // Group by date
  const byDate = {};

  for (const note of notes) {
    // Created
    if (note.created >= cutoffStr) {
      const d = note.created;
      if (!byDate[d]) byDate[d] = { created: [], updated: [], archived: [] };
      byDate[d].created.push(note);
    }
    // Updated (but not on creation day)
    if (note.updated >= cutoffStr && note.updated !== note.created) {
      const d = note.updated;
      if (!byDate[d]) byDate[d] = { created: [], updated: [], archived: [] };
      byDate[d].updated.push(note);
    }
    // Archived
    if (note.status === 'archived' && note.updated >= cutoffStr) {
      const d = note.updated;
      if (!byDate[d]) byDate[d] = { created: [], updated: [], archived: [] };
      if (!byDate[d].archived.some(n => n.file === note.file)) {
        byDate[d].archived.push(note);
      }
    }
  }

  const dates = Object.keys(byDate).sort().reverse();

  if (!dates.length) {
    console.log(`No changes in the last ${days} day(s).`);
    return { changelog: '', days };
  }

  let md = `# Vault Changelog\n\n> Last ${days} days (${cutoffStr} ~ ${today})\n\n`;

  for (const date of dates) {
    const { created, updated, archived } = byDate[date];
    md += `## ${date}\n\n`;
    if (created.length) {
      md += created.map(n => `- + [[${n.file}]] (${n.type}) ${n.summary ? '— ' + n.summary : ''}`).join('\n') + '\n';
    }
    if (updated.length) {
      md += updated.map(n => `- ~ [[${n.file}]] (${n.type})`).join('\n') + '\n';
    }
    if (archived.length) {
      md += archived.map(n => `- x [[${n.file}]] archived`).join('\n') + '\n';
    }
    md += '\n';
  }

  if (output) {
    writeFileSync(resolve(output), md);
    console.log(`Changelog written to ${output}`);
  } else {
    console.log(md);
  }

  return { changelog: md, days, dates: dates.length };
}
