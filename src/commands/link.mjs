/**
 * link — find and create missing links using TF-IDF weighted scoring
 *
 * Uses SimilarityEngine to find highest-value unlinked pairs,
 * then creates bidirectional related links. For each pair, also
 * tries to insert an inline [[wikilink]] at the first mention of
 * the target note in the source body (before Connections/See Also).
 */
import { Vault } from '../vault.mjs';
import { IndexManager } from '../index-manager.mjs';
import { SimilarityEngine } from '../similarity-engine.mjs';
import { todayStr } from '../dates.mjs';

function scorePairs(notes) {
  const engine = new SimilarityEngine(null, { includeBody: true, maxResults: 1000 });
  const suggested = engine.scorePairs(notes);

  // Transform to the format used by link command
  return suggested.map(s => ({
    noteA: { file: s.a, dir: '', type: '' },
    noteB: { file: s.b, dir: '', type: '' },
    score: s.score,
    sharedTags: s.shared,
  }));
}

/**
 * Find the first mention of target note in body text (before Connections/See Also).
 * Returns { index, term } or null if not found.
 * Avoids matching text already inside [[...]] wikilinks.
 *
 * Two-phase search:
 * 1. Exact match: search for target's title, filename, aliases as literal strings
 * 2. Fuzzy fallback: if exact fails, find paragraph with highest word overlap
 *    from target's title words (handles "pods in Kubernetes" → [[kubernetes-pod]])
 */
function findFirstMention(mainBody, targetNote) {
  const searchTerms = [targetNote.title, targetNote.file, ...(targetNote.aliases || [])]
    .filter(t => t && t.length >= 2);
  const unique = [...new Set(searchTerms)];

  let bestIdx = Infinity;
  let bestTerm = '';

  // Phase 1: exact match
  for (const term of unique) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'g');
    let m;
    while ((m = re.exec(mainBody)) !== null) {
      const before = mainBody.substring(0, m.index);
      const openCount = (before.match(/\[\[/g) || []).length;
      const closeCount = (before.match(/\]\]/g) || []).length;
      if (openCount === closeCount && m.index < bestIdx) {
        bestIdx = m.index;
        bestTerm = term;
        break;
      }
    }
  }

  if (bestTerm) return { index: bestIdx, term: bestTerm };

  // Phase 2: fuzzy word-overlap fallback
  // Split target title into significant words, find paragraph with highest overlap
  const targetTitle = (targetNote.title || targetNote.file).toLowerCase();
  const targetWords = targetTitle.split(/[\s\-/]+/).filter(w => w.length > 2);
  if (targetWords.length === 0) return null;

  // Also include words from aliases
  for (const alias of (targetNote.aliases || [])) {
    for (const w of alias.toLowerCase().split(/[\s\-/]+/)) {
      if (w.length > 2 && !targetWords.includes(w)) targetWords.push(w);
    }
  }

  const paragraphs = mainBody.split(/\n\n+/);
  let bestParaStart = -1;
  let bestParaEnd = -1;
  let bestScore = 0;
  let bestSentStart = -1;
  let bestSentEnd = -1;

  for (const para of paragraphs) {
    const paraLower = para.toLowerCase();
    // Skip if paragraph already has this wikilink
    if (paraLower.includes(`[[${targetNote.file.toLowerCase()}]]`)) continue;

    let matchCount = 0;
    for (const word of targetWords) {
      if (paraLower.includes(word)) matchCount++;
    }
    const score = matchCount / targetWords.length;
    if (score >= 0.5 && score > bestScore) {
      // Find paragraph position in mainBody
      const paraIdx = mainBody.indexOf(para);
      if (paraIdx === -1) continue;

      // Find the first sentence in this paragraph that contains a target word
      const sentences = para.split(/(?<=[.!?。！？])\s+/);
      for (const sent of sentences) {
        const sentLower = sent.toLowerCase();
        for (const word of targetWords) {
          if (sentLower.includes(word)) {
            const sentIdx = mainBody.indexOf(sent, paraIdx);
            if (sentIdx !== -1 && sent.length < 200) {
              bestScore = score;
              bestParaStart = paraIdx;
              bestParaEnd = paraIdx + para.length;
              bestSentStart = sentIdx;
              bestSentEnd = sentIdx + sent.length;
            }
            break;
          }
        }
      }

      // Fallback: use paragraph end if no sentence found
      if (bestParaStart === -1 || bestScore < score) {
        bestScore = score;
        bestParaStart = paraIdx;
        bestParaEnd = paraIdx + para.length;
        bestSentStart = -1;
        bestSentEnd = -1;
      }
    }
  }

  if (bestScore >= 0.5 && bestParaStart !== -1) {
    if (bestSentStart !== -1) {
      // Wrap the most relevant sentence with wikilink at end of sentence
      const sentenceText = mainBody.substring(bestSentStart, bestSentEnd);
      return { index: bestSentEnd, term: sentenceText, isFuzzy: true };
    }
    // Insert at end of paragraph
    return { index: bestParaEnd, term: '', isFuzzy: true };
  }

  return null;
}

/**
 * Try to insert an inline [[wikilink]] to targetNote in the body of content.
 * Returns updated content, or original if no suitable position found.
 */
function insertInlineWikilink(content, targetNote) {
  const fmMatch = content.match(/^---[\s\S]*?\n---/);
  if (!fmMatch) return content;

  const fm = fmMatch[0];
  let body = content.substring(fm.length);

  // Split body at Connections/See Also — only insert in main body
  const connMatch = body.match(/\n## (?:Connections|See Also)/);
  const mainBody = connMatch ? body.substring(0, connMatch.index) : body;
  const suffix = connMatch ? body.substring(connMatch.index) : '';

  // Skip if target is already linked in the body
  if (mainBody.includes(`[[${targetNote.file}]]`)) return content;

  const mention = findFirstMention(mainBody, targetNote);
  if (!mention) return content;

  let newBody;
  if (mention.isFuzzy) {
    // Fuzzy match: append wikilink after the relevant sentence or paragraph
    if (mention.term) {
      // Sentence-level: append wikilink after the sentence
      newBody = mainBody.substring(0, mention.index) +
                ` [[${targetNote.file}]]` +
                mainBody.substring(mention.index) +
                suffix;
    } else {
      // Paragraph-level: append wikilink at end of paragraph
      newBody = mainBody.substring(0, mention.index) +
                ` [[${targetNote.file}]]` +
                mainBody.substring(mention.index) +
                suffix;
    }
  } else {
    // Exact match: replace the term with wikilink
    const display = mention.term !== targetNote.file
      ? `[[${targetNote.file}|${mention.term}]]`
      : `[[${targetNote.file}]]`;
    newBody = mainBody.substring(0, mention.index) +
              display +
              mainBody.substring(mention.index + mention.term.length) +
              suffix;
  }

  return fm + newBody;
}

/**
 * Add target to related field in frontmatter and update `updated` date.
 * Returns updated content.
 */
function addToRelated(content, targetFile) {
  if (content.includes(`[[${targetFile}]]`)) return content;

  let updated = content.replace(
    /^(related:)\s*\[(.*)]/m,
    (_, prefix, inner) => {
      const existing = inner.trim() ? `${inner}, ` : '';
      return `${prefix} [${existing}"[[${targetFile}]]"]`;
    }
  );
  if (updated === content) {
    // No related field yet — add one after type
    updated = content.replace(
      /^(type:.*)$/m,
      `$1\nrelated: ["[[${targetFile}]]"]`
    );
  }
  updated = updated.replace(/^(updated:)\s*.*$/m, `$1 ${todayStr()}`);
  return updated;
}

export function link(vaultRoot, { dryRun = false, threshold = 1.5, top = 10 } = {}) {
  const vault = new Vault(vaultRoot);
  const idx = new IndexManager(vault);
  const notes = vault.scanNotes({ includeBody: true });
  const suggestions = scorePairs(notes).filter(s => s.score >= threshold);

  if (!suggestions.length) {
    console.log('No missing links found above threshold.');
    return { linked: 0, suggestions: [] };
  }

  if (dryRun) {
    console.log(`\nFound ${suggestions.length} potential link(s) (showing top ${Math.min(top, suggestions.length)}):\n`);
    console.log('| Note A | Note B | Score | Shared Tags | First Mention (A) | First Mention (B) |');
    console.log('|--------|--------|-------|-------------|-------------------|-------------------|');

    for (const s of suggestions.slice(0, top)) {
      const noteA = notes.find(n => n.file === s.noteA.file);
      const noteB = notes.find(n => n.file === s.noteB.file);

      let mentionA = '-', mentionB = '-';

      if (noteA && noteB) {
        const contentA = vault.read(noteA.dir, `${noteA.file}.md`);
        if (contentA) {
          const bm = contentA.match(/^---[\s\S]*?\n---/);
          if (bm) {
            const body = contentA.substring(bm[0].length);
            const cm = body.match(/\n## (?:Connections|See Also)/);
            const mainBody = cm ? body.substring(0, cm.index) : body;
            const fm = findFirstMention(mainBody, noteB);
            if (fm) mentionA = `line ~${mainBody.substring(0, fm.index).split('\n').length + 1}: "${fm.term.substring(0, 30)}"${fm.isFuzzy ? ' (fuzzy)' : ''}`;
          }
        }

        const contentB = vault.read(noteB.dir, `${noteB.file}.md`);
        if (contentB) {
          const bm = contentB.match(/^---[\s\S]*?\n---/);
          if (bm) {
            const body = contentB.substring(bm[0].length);
            const cm = body.match(/\n## (?:Connections|See Also)/);
            const mainBody = cm ? body.substring(0, cm.index) : body;
            const fm = findFirstMention(mainBody, noteA);
            if (fm) mentionB = `line ~${mainBody.substring(0, fm.index).split('\n').length + 1}: "${fm.term.substring(0, 30)}"${fm.isFuzzy ? ' (fuzzy)' : ''}`;
          }
        }
      }

      console.log(`| [[${s.noteA.file}]] | [[${s.noteB.file}]] | ${s.score} | ${s.sharedTags.join(', ')} | ${mentionA} | ${mentionB} |`);
    }
    return { linked: 0, suggestions };
  }

  // Apply top N links
  let linked = 0;
  for (const s of suggestions.slice(0, top)) {
    const noteA = notes.find(n => n.file === s.noteA.file);
    const noteB = notes.find(n => n.file === s.noteB.file);
    if (!noteA || !noteB) continue;

    // ── A → B: inline wikilink + related ──
    let contentA = vault.read(noteA.dir, `${noteA.file}.md`);
    if (contentA) {
      let modifiedA = false;
      // Try inline wikilink first
      const updatedA = insertInlineWikilink(contentA, noteB);
      if (updatedA !== contentA) {
        contentA = updatedA;
        modifiedA = true;
      }
      // Add to related
      const withRelatedA = addToRelated(contentA, noteB.file);
      if (withRelatedA !== contentA) {
        contentA = withRelatedA;
        modifiedA = true;
      }
      if (modifiedA) {
        vault.write(noteA.dir, `${noteA.file}.md`, contentA);
      }
    }

    // ── B → A: inline wikilink + related ──
    let contentB = vault.read(noteB.dir, `${noteB.file}.md`);
    if (contentB) {
      let modifiedB = false;
      const updatedB = insertInlineWikilink(contentB, noteA);
      if (updatedB !== contentB) {
        contentB = updatedB;
        modifiedB = true;
      }
      const withRelatedB = addToRelated(contentB, noteA.file);
      if (withRelatedB !== contentB) {
        contentB = withRelatedB;
        modifiedB = true;
      }
      if (modifiedB) {
        vault.write(noteB.dir, `${noteB.file}.md`, contentB);
      }
    }

    linked++;
  }

  idx.sync();
  const inlineCount = suggestions.slice(0, top).filter(s => {
    const nA = notes.find(n => n.file === s.noteA.file);
    const nB = notes.find(n => n.file === s.noteB.file);
    if (!nA || !nB) return false;
    const cA = vault.read(nA.dir, `${nA.file}.md`) || '';
    const cB = vault.read(nB.dir, `${nB.file}.md`) || '';
    const bA = cA.replace(/^---[\s\S]*?\n---/, '').replace(/\n## (?:Connections|See Also)[\s\S]*$/, '');
    const bB = cB.replace(/^---[\s\S]*?\n---/, '').replace(/\n## (?:Connections|See Also)[\s\S]*$/, '');
    return bA.includes(`[[${nB.file}]]`) || bB.includes(`[[${nA.file}]]`);
  }).length;

  console.log(`Created ${linked} bidirectional link(s) (${inlineCount} with inline wikilinks) from ${suggestions.length} candidates`);
  return { linked, suggestions, inlineCount };
}
