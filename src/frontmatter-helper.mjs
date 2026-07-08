/**
 * frontmatter-helper — unified frontmatter field update logic
 */

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format a value for YAML frontmatter.
 * Arrays → [a, b, c], strings → "value", others → String(value)
 */
export function formatFmValue(val) {
  if (Array.isArray(val)) return `[${val.join(', ')}]`;
  if (typeof val === 'string') return `"${val}"`;
  return String(val);
}

/**
 * Update (or insert) a single frontmatter field in file content.
 * If the key exists, replaces its value in-place.
 * If the key does not exist, inserts it after the opening ---.
 *
 * @param {string} content - full file content
 * @param {string} key - frontmatter key
 * @param {*} value - new value
 * @returns {string} updated content
 */
export function updateFrontmatterField(content, key, value) {
  const formatted = formatFmValue(value);
  const re = new RegExp(`^(${escapeRe(key)}:)\\s*.*$`, 'm');
  if (content.match(re)) {
    return content.replace(re, `$1 ${formatted}`);
  }
  // Key not present — insert after opening ---
  return content.replace(/^---\n/, `---\n${key}: ${formatted}\n`);
}

/**
 * Apply multiple frontmatter updates at once.
 * @param {string} content
 * @param {Object} updates - { key: value, ... }
 * @returns {string} updated content
 */
export function updateFrontmatter(content, updates) {
  let result = content;
  for (const [key, val] of Object.entries(updates)) {
    result = updateFrontmatterField(result, key, val);
  }
  return result;
}
