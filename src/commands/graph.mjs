/**
 * graph — generate Mermaid diagram from knowledge graph
 */
import { Vault } from '../vault.mjs';

export function graph(vaultRoot, { type, format = 'mermaid' } = {}) {
  const vault = new Vault(vaultRoot);
  const notes = vault.scanNotes({ includeBody: true });

  // Collect all edges
  const edges = [];
  const nodeTypes = {};

  for (const n of notes) {
    if (type && n.type !== type) continue;
    nodeTypes[n.file] = n.type;

    // From related field
    for (const rel of n.related) {
      edges.push({ from: n.file, to: rel, type: 'related' });
    }

    // From wikilinks in body
    const wikilinks = (n.body || '').match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g) || [];
    for (const wl of wikilinks) {
      const target = wl.slice(2, -2).split('|')[0];
      if (target !== n.file && !edges.some(e => e.from === n.file && e.to === target)) {
        edges.push({ from: n.file, to: target, type: 'link' });
      }
    }
  }

  // Type → shape mapping for Mermaid
  const shapeMap = {
    project: (id, label) => `${id}[["${label}"]]`,
    area: (id, label) => `${id}(("${label}"))`,
    resource: (id, label) => `${id}[/"${label}"/]`,
    idea: (id, label) => `${id}>"${label}"]`,
    journal: (id, label) => `${id}("${label}")`,
  };

  // Generate Mermaid
  const safeId = name => name.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_');
  const lines = ['graph LR'];

  // Node declarations
  const declaredNodes = new Set();
  for (const n of notes) {
    if (type && n.type !== type) continue;
    const id = safeId(n.file);
    const shapeFn = shapeMap[n.type] || shapeMap.resource;
    lines.push(`  ${shapeFn(id, n.title)}`);
    declaredNodes.add(n.file);
  }

  // Edges
  for (const e of edges) {
    const fromId = safeId(e.from);
    const toId = safeId(e.to);
    const arrow = e.type === 'related' ? '---' : '-->';
    lines.push(`  ${fromId} ${arrow} ${toId}`);
  }

  // Style classes
  lines.push('');
  lines.push('  classDef project fill:#4CAF50,color:#fff');
  lines.push('  classDef area fill:#2196F3,color:#fff');
  lines.push('  classDef resource fill:#FF9800,color:#fff');
  lines.push('  classDef idea fill:#9C27B0,color:#fff');
  lines.push('  classDef journal fill:#607D8B,color:#fff');

  for (const [file, t] of Object.entries(nodeTypes)) {
    if (declaredNodes.has(file)) {
      lines.push(`  class ${safeId(file)} ${t}`);
    }
  }

  const mermaid = lines.join('\n');
  console.log(mermaid);

  return { edges: edges.length, nodes: declaredNodes.size, mermaid };
}
