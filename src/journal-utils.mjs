/**
 * Shared journal scanning utilities — used by health, review, and hook
 */
import { readdirSync, existsSync } from 'fs';

/**
 * Collect recent journal text for mention scanning
 * @param {Vault} vault
 * @param {number} days - how many days back to scan
 * @returns {string[]} array of lowercase journal content strings
 */
export function getRecentJournalText(vault, days = 30) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const journalDir = vault.path('journal');
  if (!existsSync(journalDir)) return [];

  const texts = [];
  for (const file of readdirSync(journalDir)) {
    if (!file.match(/^\d{4}-\d{2}-\d{2}\.md$/)) continue;
    const d = file.replace('.md', '');
    if (d < cutoff) continue;
    const content = vault.read('journal', file);
    if (content) texts.push(content.toLowerCase());
  }
  return texts;
}

/**
 * Check if a note is mentioned in recent journal text
 * @param {Object} note - note with file and title
 * @param {string[]} journalTexts - from getRecentJournalText
 */
export function isMentionedInJournals(note, journalTexts) {
  return journalTexts.some(t =>
    t.includes(`[[${note.file}]]`.toLowerCase()) || t.includes(note.title.toLowerCase())
  );
}

/**
 * Extract a markdown section by heading from content
 * @param {string} content
 * @param {string} heading
 * @returns {string[]} array of bullet lines
 */
export function extractSection(content, heading) {
  const regex = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |\\n---|$)`);
  const match = content.match(regex);
  if (!match) return [];
  return match[1].trim().split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('- ') && l !== '-' && !l.includes('no activity'));
}

/**
 * Extract section items using both CN and EN heading variants
 * @param {string} content
 * @param {string[][]} headingGroups - array of [heading1, heading2, ...] variants
 * @returns {Object} { records, issues, ideas, plans }
 */
export function extractAllSections(content) {
  return {
    records: [
      ...extractSection(content, '今日記錄'),
      ...extractSection(content, '今日记录'),
      ...extractSection(content, 'Records'),
    ],
    issues: [
      ...extractSection(content, '問題與風險'),
      ...extractSection(content, '问题与风险'),
      ...extractSection(content, 'Issues'),
    ],
    ideas: [
      ...extractSection(content, '想法'),
      ...extractSection(content, 'Ideas'),
    ],
    plans: [
      ...extractSection(content, '明日計劃'),
      ...extractSection(content, '明日计划'),
      ...extractSection(content, 'Tomorrow'),
    ],
  };
}

/**
 * Staleness check — shared by health.mjs and review.mjs monthlyReview
 * @param {Object[]} notes - from vault.scanNotes()
 * @param {string[]} journalTexts - from getRecentJournalText
 * @returns {{ staleResources, staleProjects, deadIdeas }}
 */
export function stalenessCheck(notes, journalTexts) {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const staleResources = notes
    .filter(n => n.type === 'resource' && n.updated && n.updated < sixtyDaysAgo)
    .map(n => ({ file: n.file, updated: n.updated, reason: '60+ days since updated' }));

  const staleProjects = notes
    .filter(n => n.type === 'project' && n.status === 'active' && !isMentionedInJournals(n, journalTexts))
    .filter(n => (n.updated || '') < thirtyDaysAgo)
    .map(n => ({ file: n.file, updated: n.updated, reason: 'active but 30+ days no mention' }));

  const deadIdeas = notes
    .filter(n => n.type === 'idea' && !isMentionedInJournals(n, journalTexts))
    .filter(n => (n.updated || n.created || '') < thirtyDaysAgo)
    .map(n => ({ file: n.file, updated: n.updated || n.created, reason: '30+ days, never mentioned' }));

  return { staleResources, staleProjects, deadIdeas };
}
