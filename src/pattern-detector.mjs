export class PatternDetector {
  constructor(options = {}) {
    this.stopwords = new Set([
      'over',
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'must', 'shall', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what',
      'which', 'who', 'when', 'where', 'why', 'how', 'as', 'by', 'from',
      'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'under', 'again', 'further', 'then', 'once',
      'here', 'there', 'all', 'both', 'each', 'few', 'more', 'most', 'other',
      'some', 'such', 'no', 'nor', 'not', 'only', 'same', 'so', 'than',
      'too', 'very', 'just', 'me', 'my', 'yourself', 'yourselves', 'himself',
      'herself', 'itself', 'themselves', 'their', 'theirs', 'our', 'ours',
      'his', 'hers', 'its', 'am'
    ]);

    this.painKeywords = {
      'manual': 3, 'tedious': 3, 'repetitive': 3, 'error-prone': 4,
      'slow': 2, 'missing': 4, 'broken': 4, 'timeout': 2, 'retry': 2,
      'duplicate': 3, 'inconsistent': 2, 'complex': 1, 'difficult': 2,
      'hard': 2, 'awkward': 2, 'cumbersome': 3,
    };

    this.solutionMapping = {
      'manual': '/linear-slack-reporter',
      'api': '/api-aggregation-notifier',
      'report': '/daily-report-from-sheets',
      'code': '/code-review-assistant',
      'monitor': '/monitoring-agent',
      'sync': '/obsidian-sync-agent',
      'automation': '/automation-engine',
    };

    this.kRange = options.kRange || [8, 9, 10, 11, 12];
    this.maxIterations = options.maxIterations || 100;
    this.convergenceThreshold = options.convergenceThreshold || 0.01;
  }

  tokenize(text) {
    if (!text) return [];
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1 && !this.stopwords.has(word));
  }

  buildVocabulary(notes) {
    const vocab = new Set();
    const docTermFreqs = [];

    for (const note of notes) {
      const text = note.title ? `${note.title} ${note.body || ''}` : (note.body || '');
      const tokens = this.tokenize(text);
      const termFreq = {};
      for (const token of tokens) {
        termFreq[token] = (termFreq[token] || 0) + 1;
        vocab.add(token);
      }
      docTermFreqs.push({ file: note.file, title: note.title, termFreq, tokenCount: tokens.length });
    }

    return { vocab: Array.from(vocab), docTermFreqs, totalDocs: notes.length };
  }

  computeTFIDF(notes) {
    const { vocab, docTermFreqs, totalDocs } = this.buildVocabulary(notes);
    const docFreq = {};
    for (const { termFreq } of docTermFreqs) {
      for (const term of Object.keys(termFreq)) {
        docFreq[term] = (docFreq[term] || 0) + 1;
      }
    }

    const vectors = docTermFreqs.map(({ file, title, termFreq, tokenCount }) => {
      const vector = {};
      for (const term of vocab) {
        const idf = Math.log(totalDocs / (docFreq[term] || 1));
        const tf = (termFreq[term] || 0) / (tokenCount || 1);
        if (tf > 0) vector[term] = tf * idf;
      }
      return { file, title, vector };
    });

    return { vectors, vocab };
  }

  cosineSimilarity(vec1, vec2) {
    let dotProduct = 0, norm1 = 0, norm2 = 0;
    const keys = new Set([...Object.keys(vec1), ...Object.keys(vec2)]);
    for (const key of keys) {
      const v1 = vec1[key] || 0;
      const v2 = vec2[key] || 0;
      dotProduct += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    }
    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  initializeCenters(vectors, k) {
    const indices = new Set();
    while (indices.size < k) {
      indices.add(Math.floor(Math.random() * vectors.length));
    }
    return Array.from(indices).map(i => vectors[i].vector);
  }

  assignClusters(vectors, centers) {
    const assignments = [];
    for (const { vector } of vectors) {
      let maxSim = -Infinity, cluster = 0;
      for (let i = 0; i < centers.length; i++) {
        const sim = this.cosineSimilarity(vector, centers[i]);
        if (sim > maxSim) { maxSim = sim; cluster = i; }
      }
      assignments.push(cluster);
    }
    return assignments;
  }

  updateCenters(vectors, centers, assignments) {
    const k = centers.length;
    const newCenters = [];
    for (let c = 0; c < k; c++) {
      const clusterVecs = vectors.filter((_, i) => assignments[i] === c).map(v => v.vector);
      if (clusterVecs.length === 0) {
        newCenters.push(centers[c]);
      } else {
        const center = {};
        const allKeys = new Set();
        for (const vec of clusterVecs) Object.keys(vec).forEach(k => allKeys.add(k));
        for (const key of allKeys) {
          const sum = clusterVecs.reduce((acc, vec) => acc + (vec[key] || 0), 0);
          center[key] = sum / clusterVecs.length;
        }
        newCenters.push(center);
      }
    }
    return newCenters;
  }

  calculateChange(oldAssignments, newAssignments) {
    let changes = 0;
    for (let i = 0; i < oldAssignments.length; i++) {
      if (oldAssignments[i] !== newAssignments[i]) changes++;
    }
    return changes / oldAssignments.length;
  }

  kMeansClustering(vectors, k) {
    let centers = this.initializeCenters(vectors, k);
    let assignments = this.assignClusters(vectors, centers);
    for (let iter = 0; iter < this.maxIterations; iter++) {
      const newCenters = this.updateCenters(vectors, centers, assignments);
      const newAssignments = this.assignClusters(vectors, newCenters);
      const change = this.calculateChange(assignments, newAssignments);
      centers = newCenters;
      assignments = newAssignments;
      if (change < this.convergenceThreshold) break;
    }
    return { centers, assignments };
  }

  calculateSilhouetteScore(vectors, assignments, centers, k) {
    let totalScore = 0, count = 0;
    for (let i = 0; i < vectors.length; i++) {
      const clusterIdx = assignments[i];
      const vector = vectors[i].vector;
      const intraScore = this.cosineSimilarity(vector, centers[clusterIdx]);
      let interScore = Infinity;
      for (let c = 0; c < k; c++) {
        if (c !== clusterIdx) {
          const sim = this.cosineSimilarity(vector, centers[c]);
          interScore = Math.min(interScore, sim);
        }
      }
      const silhouette = (intraScore - interScore) / Math.max(intraScore, interScore || 0.001);
      totalScore += silhouette;
      count++;
    }
    return count === 0 ? 0 : totalScore / count;
  }

  extractTopTerms(vectors, assignments, clusterIdx, topN = 5) {
    const termWeights = {};
    for (let i = 0; i < vectors.length; i++) {
      if (assignments[i] === clusterIdx) {
        const vector = vectors[i].vector;
        for (const [term, weight] of Object.entries(vector)) {
          termWeights[term] = (termWeights[term] || 0) + weight;
        }
      }
    }
    return Object.entries(termWeights).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([term]) => term);
  }

  generateClusterLabel(topTerms) {
    if (topTerms.length === 0) return 'Miscellaneous';
    const label = topTerms.slice(0, 3).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' ');
    return label || 'Miscellaneous';
  }

  clusterByContent(notes) {
    if (notes.length === 0) {
      return { clusters: [], overallQuality: 0, recommendedK: 8 };
    }

    const { vectors } = this.computeTFIDF(notes);
    let bestK = Math.min(8, vectors.length);
    let bestScore = -Infinity;
    const resultsByK = {};

    for (const k of this.kRange) {
      if (k > vectors.length) continue;
      const { centers, assignments } = this.kMeansClustering(vectors, k);
      const silhouette = this.calculateSilhouetteScore(vectors, assignments, centers, k);
      resultsByK[k] = { centers, assignments, silhouette };
      if (silhouette > bestScore) {
        bestScore = silhouette;
        bestK = k;
      }
    }

    if (!resultsByK[bestK]) {
      const kValue = Object.keys(resultsByK)[0];
      bestK = parseInt(kValue);
    }

    const result = resultsByK[bestK];
    if (!result) {
      return { clusters: [], overallQuality: 0, recommendedK: 8 };
    }

    const { centers, assignments, silhouette } = result;
    const clusters = [];
    for (let c = 0; c < bestK; c++) {
      const clusterNotes = vectors.filter((_, i) => assignments[i] === c).map(v => ({ file: v.file, title: v.title }));
      if (clusterNotes.length > 0) {
        const topTerms = this.extractTopTerms(vectors, assignments, c, 5);
        clusters.push({
          id: c + 1,
          label: this.generateClusterLabel(topTerms),
          quality: silhouette,
          notes: clusterNotes,
          topTerms,
          size: clusterNotes.length,
          suggestedSkills: this.suggestSkillsForCluster(topTerms),
        });
      }
    }

    return {
      clusters: clusters.sort((a, b) => b.size - a.size),
      overallQuality: silhouette || 0,
      recommendedK: bestK,
    };
  }

  suggestSkillsForCluster(topTerms) {
    const suggested = new Set();
    for (const term of topTerms) {
      for (const [keyword, skill] of Object.entries(this.solutionMapping)) {
        if (term.includes(keyword) || keyword.includes(term)) {
          suggested.add(skill);
        }
      }
    }
    return Array.from(suggested);
  }

  detectPainPoints(notes) {
    const painSignals = {};
    const affectedNotes = {};

    for (const note of notes) {
      const text = `${note.title || ''} ${note.body || ''}`.toLowerCase();
      for (const [keyword, weight] of Object.entries(this.painKeywords)) {
        const regex = new RegExp(keyword, 'gi');
        const matches = text.match(regex) || [];
        for (const match of matches) {
          if (!painSignals[keyword]) {
            painSignals[keyword] = { keyword, weight, frequency: 0, totalScore: 0 };
          }
          painSignals[keyword].frequency++;
          painSignals[keyword].totalScore += weight;
          if (!affectedNotes[keyword]) affectedNotes[keyword] = [];
          if (!affectedNotes[keyword].includes(note.file)) {
            affectedNotes[keyword].push(note.file);
          }
        }
      }
    }

    const painPoints = [];
    for (const [keyword, signal] of Object.entries(painSignals)) {
      const severity = Math.min(100, (signal.frequency * signal.weight) / notes.length * 50);
      painPoints.push({
        pain: `${keyword} processes`,
        severity: Math.round(severity),
        frequency: signal.frequency,
        affectedNotes: affectedNotes[keyword] || [],
        suggestedSolution: this.suggestSolution(keyword),
        estimatedROI: this.estimateROI(signal.frequency),
      });
    }

    painPoints.sort((a, b) => b.severity - a.severity);
    const topPains = painPoints.slice(0, 5).map(p => `${p.pain} (${p.severity})`);

    return { painPoints: painPoints.slice(0, 10), topPains };
  }

  estimateROI(frequency) {
    if (frequency >= 10) return '5h saved per week';
    if (frequency >= 5) return '2h saved per week';
    if (frequency >= 2) return '30m saved per week';
    return 'minor optimization';
  }

  suggestSolution(keyword) {
    for (const [key, skill] of Object.entries(this.solutionMapping)) {
      if (keyword.includes(key) || key.includes(keyword)) {
        return skill;
      }
    }
    return '/automation-engine';
  }

  // === Algorithms 3-4: code pattern extraction & quality scoring ===

  extractCodeBlocks(note) {
    const blocks = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockRegex.exec(note.body || '')) !== null) {
      const language = match[1] || 'unknown';
      const code = match[2].trim();
      blocks.push({language, code, size: code.split('\n').length, hasComments: /\/\/|\/\*|#/.test(code), hasAsync: /async|await|Promise/.test(code), hasError: /try|catch|throw|error/i.test(code), hasRetry: /retry|attempt|retries/i.test(code), complexity: this.estimateCodeComplexity(code)});
    }
    return blocks;
  }

  estimateCodeComplexity(code) {
    let score = 0;
    const lines = code.split('\n').length;
    score += Math.min(10, Math.floor(lines / 5));
    score += (code.match(/if|else|switch|case/g) || []).length;
    score += (code.match(/for|while|reduce|map|filter/g) || []).length * 0.5;
    return Math.min(10, score);
  }

  generalizeCode(code) {
    let g = code.replace(/(https?:\/\/[^\s'"]+)/g, '?url?').replace(/\b(\d+)\b(?!=)/g, '?num?').replace(/'[^']*'/g, '?string?').replace(/"[^"]*"/g, '?string?');
    const vars = new Set();
    const vp = /\b([a-zA-Z_$][a-zA-Z0-9_$]{2,})\b/g;
    let vm;
    while ((vm = vp.exec(code)) !== null) vars.add(vm[1]);
    const kw = new Set(['function', 'async', 'await', 'return', 'if', 'else', 'for', 'while', 'const', 'let', 'var', 'class', 'new', 'this', 'try', 'catch']);
    let vc = 0;
    for (const v of vars) {
      if (!kw.has(v)) g = g.replace(new RegExp(`\\b${v}\\b`, 'g'), vc < 3 ? `?${v}?` : `?var${vc}?`);
      vc++;
    }
    return g;
  }

  codePatternSimilarity(code1, code2) {
    const n1 = code1.replace(/\s+/g, ' ').trim(), n2 = code2.replace(/\s+/g, ' ').trim();
    if (n1 === n2) return 1.0;
    const t1 = n1.split(/\s+/), t2 = n2.split(/\s+/);
    let m = 0;
    for (let i = 0; i < Math.min(t1.length, t2.length); i++) if (t1[i] === t2[i]) m++;
    return m / Math.max(t1.length, t2.length);
  }

  extractCodePatterns(notes) {
    const patterns = [], pm = {};
    for (const n of notes) {
      for (const b of this.extractCodeBlocks(n)) {
        let bm = null, bs = 0.7;
        for (const pid of Object.keys(pm)) {
          const s = this.codePatternSimilarity(b.code, pm[pid].code);
          if (s > bs) { bs = s; bm = pid; }
        }
        if (bm) {
          pm[bm].usageCount++;
          pm[bm].files.push(n.file);
          pm[bm].variants.push({code: b.code, file: n.file, similarity: bs});
        } else {
          const pid = `pattern_${Object.keys(pm).length + 1}`;
          pm[pid] = {id: pid, language: b.language, code: b.code, usageCount: 1, files: [n.file], size: b.size, complexity: b.complexity, variants: [{code: b.code, file: n.file, similarity: 1.0}], features: {hasComments: b.hasComments, hasAsync: b.hasAsync, hasError: b.hasError, hasRetry: b.hasRetry}};
        }
      }
    }
    const pa = [];
    for (const p of Object.values(pm)) {
      const avs = p.variants.reduce((s, v) => s + v.similarity, 0) / p.variants.length;
      p.reusability = (p.usageCount * avs) / (1 + p.complexity / 5);
      p.estimatedSavings = p.usageCount * p.size;
      pa.push(p);
    }
    pa.sort((a, b) => b.reusability - a.reusability);
    const tp = pa.slice(0, 15);
    for (const p of tp) p.generalized = this.generalizeCode(p.code);
    return {patterns: tp, totalPatterns: Object.keys(pm).length, totalSavings: pa.reduce((s, p) => s + p.estimatedSavings, 0)};
  }

  scoreImpact(s) { return Math.min(10, Math.floor(s / 50)); }
  scoreCompleteness(d) { return Math.min(10, Math.floor(d / 100)); }
  scoreMaturity(u) { return Math.min(10, Math.floor(u * 1.5)); }
  scoreReusability(u) { return Math.min(10, Math.floor(u * 2)); }
  scoreComplexity(l) { return Math.max(1, Math.floor(l / 5)); }
  calculateQualityScore(i, c, m, r, x) { 
    const safeX = Math.max(1, x);
    return Math.round((i * c * m * r) / safeX * 10) / 10; 
  }
  estimateRiskLevel(x, m, u) { return m >= 8 && x <= 5 ? 'low' : m >= 5 && x <= 7 ? 'medium' : 'high'; }

  scoreOpportunities(patterns, painPoints) {
    const opps = [];
    if (patterns) {
      for (const p of patterns.patterns || []) {
        const i = this.scoreImpact(p.estimatedSavings);
        const m = this.scoreMaturity(p.usageCount);
        const r = this.scoreReusability(p.usageCount);
        const x = this.scoreComplexity(p.size);
        const score = this.calculateQualityScore(i, 6, m, r, x);
        opps.push({rank: 0, skill: `/pattern-${p.id}`, source: 'code_patterns', score, impact: i, completeness: 6, maturity: m, reusability: r, complexity: x, riskLevel: this.estimateRiskLevel(x, m, p.usageCount), estimatedROI: `${Math.round((p.estimatedSavings / 60) * 52)}h saved/year`, details: {language: p.language, usageCount: p.usageCount, size: p.size, files: p.files}});
      }
    }
    if (painPoints) {
      for (const pain of painPoints.painPoints || []) {
        const i = Math.min(10, pain.severity / 10);
        const m = Math.min(10, pain.frequency / 2);
        const score = this.calculateQualityScore(i, 5, m, 7, 6);
        opps.push({rank: 0, skill: pain.suggestedSolution, source: 'pain_points', score, impact: i, completeness: 5, maturity: m, reusability: 7, complexity: 6, riskLevel: this.estimateRiskLevel(6, m, pain.frequency), estimatedROI: pain.estimatedROI, details: {pain: pain.pain, severity: pain.severity, frequency: pain.frequency, affectedNotes: pain.affectedNotes}});
      }
    }
    opps.sort((a, b) => b.score - a.score);
    for (let i = 0; i < opps.length; i++) opps[i].rank = i + 1;
    return {opportunities: opps.slice(0, 20), totalScored: opps.length, recommendation: opps.length > 0 && opps[0].score > 7 ? 'IMMEDIATE' : 'PLANNED'};
  }
}

export default PatternDetector;
