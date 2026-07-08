/**
 * table-formatter — unified Markdown table rendering
 */

/**
 * Render rows as a Markdown table.
 * @param {Array<Object>} rows
 * @param {string[]} columns - field names to render
 * @param {Object} opts
 * @param {string[]} opts.wikilink - columns to wrap in [[...]]
 * @param {string} opts.fallback - value for missing/empty fields (default '-')
 * @param {number|null} opts.limit - max rows to show
 * @returns {string}
 */
export function formatTable(rows, columns, opts = {}) {
  const { wikilink = [], fallback = '-', limit = null } = opts;
  if (!rows.length) return 'No results.';
  const data = limit ? rows.slice(0, limit) : rows;
  const header = columns.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' | ');
  const sep = columns.map(() => '------').join('|');
  const lines = data.map(row => {
    const cells = columns.map(col => {
      const v = row[col] ?? fallback;
      return wikilink.includes(col) ? `[[${v}]]` : (v || fallback);
    });
    return `| ${cells.join(' | ')} |`;
  });
  return [`| ${header} |`, `|${sep}|`, ...lines].join('\n');
}
