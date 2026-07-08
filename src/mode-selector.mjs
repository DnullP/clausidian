/**
 * Smart Mode Selection System for skill-pipeline Iteration 2
 * Auto-detects skill complexity and selects optimal execution mode (fast/full/adaptive)
 *
 * Decision Tree:
 * - complexity < 0.3 → 'fast' mode
 * - 0.3-0.7 → 'adaptive' mode
 * - > 0.7 → 'full' mode
 */

/**
 * Analyzes prompt/skill complexity and returns score (0-1)
 *
 * @param {string} prompt - The skill prompt/content to analyze
 * @param {Object} context - Additional context
 * @param {Array<string>} context.tags - Tags from vault references
 * @param {number} context.vaultReferences - Count of vault file references
 * @returns {Object} {score, factors} where score is float 0-1
 */
export function analyzePrompt(prompt, context = {}) {
  if (!prompt || typeof prompt !== 'string') {
    return { score: 0, factors: {} };
  }

  const factors = {};

  // 1. Word count analysis
  const wordCount = prompt.trim().split(/\s+/).length;
  factors.wordCount = wordCount;
  const wordScore = Math.min(wordCount / 300, 1); // Normalize to 300 words = complexity 1
  factors.wordScore = wordScore;

  // 2. Code block complexity (indicates integration/setup)
  const codeBlocks = (prompt.match(/```[\s\S]*?```/g) || []).length;
  const codeBlockScore = Math.min(codeBlocks * 0.15, 1); // Each code block adds 0.15
  factors.codeBlocks = codeBlocks;
  factors.codeBlockScore = codeBlockScore;

  // 3. Keyword extraction and complexity scoring
  const complexityKeywords = [
    'api', 'integration', 'database', 'schema', 'orm', 'migration',
    'authentication', 'authorization', 'security', 'encryption',
    'performance', 'optimization', 'caching', 'concurrency',
    'external', 'third-party', 'webhook', 'streaming',
    'multi-step', 'workflow', 'pipeline', 'orchestration',
    'error handling', 'retry', 'timeout', 'fallback',
    'async', 'promise', 'callback', 'goroutine', 'channel',
  ];

  const lowerPrompt = prompt.toLowerCase();
  let keywordMatches = 0;
  for (const keyword of complexityKeywords) {
    if (lowerPrompt.includes(keyword)) {
      keywordMatches++;
    }
  }
  const keywordScore = Math.min(keywordMatches * 0.12, 1); // Each keyword adds 0.12
  factors.complexityKeywords = keywordMatches;
  factors.keywordScore = keywordScore;

  // 4. Vault reference detection
  const vaultRefCount = context.vaultReferences || 0;
  const refScore = Math.min(vaultRefCount * 0.1, 0.3); // Each ref adds 0.1, max 0.3
  factors.vaultReferences = vaultRefCount;
  factors.refScore = refScore;

  // 5. External data detection
  let externalDataScore = 0;
  const externalIndicators = ['http', 'fetch', 'request', 'query', 'json', 'xml', 'csv'];
  for (const indicator of externalIndicators) {
    if (lowerPrompt.includes(indicator)) {
      externalDataScore += 0.1;
    }
  }
  externalDataScore = Math.min(externalDataScore, 0.4);
  factors.externalDataScore = externalDataScore;

  // 6. Tag-based complexity (if available in context)
  let tagScore = 0;
  if (context.tags && Array.isArray(context.tags)) {
    const complexTags = ['system', 'critical', 'infrastructure', 'integration', 'security'];
    for (const tag of context.tags) {
      if (complexTags.includes(tag.toLowerCase())) {
        tagScore += 0.1;
      }
    }
    tagScore = Math.min(tagScore, 0.3);
  }
  factors.tagScore = tagScore;

  // Final score: weighted sum of all factors
  const score =
    wordScore * 0.10 +
    codeBlockScore * 0.05 +
    keywordScore * 0.70 +
    refScore * 0.10 +
    externalDataScore * 0.04 +
    tagScore * 0.01;

  factors.compositeScore = score;

  return { score: Math.min(score, 1), factors };
}

/**
 * Selects execution mode based on complexity analysis
 *
 * @param {Object} analysis - Output from analyzePrompt()
 * @param {number} analysis.score - Complexity score (0-1)
 * @param {Object} analysis.factors - Breakdown of factors
 * @param {string} userOverride - User-specified mode ('fast'|'full'|'adaptive'|null)
 * @returns {string} Selected mode: 'fast' | 'adaptive' | 'full'
 */
export function selectMode(analysis, userOverride = null) {
  // User override takes precedence
  if (userOverride) {
    const validModes = ['fast', 'full', 'adaptive'];
    if (validModes.includes(userOverride.toLowerCase())) {
      return userOverride.toLowerCase();
    }
  }

  const score = analysis.score || 0;

  // Decision tree
  if (score < 0.25) {
    return 'fast';
  } else if (score >= 0.25 && score < 0.65) {
    return 'adaptive';
  } else {
    return 'full';
  }
}

/**
 * Retrieves mode configuration with timeout, token limits, and search depth
 *
 * @param {string} mode - One of 'fast'|'full'|'adaptive'
 * @param {Object} overrides - Optional config overrides
 * @returns {Object} Configuration object with timeout, maxTokens, searchDepth, etc.
 */
export function getConfig(mode, overrides = {}) {
  const configs = {
    fast: {
      mode: 'fast',
      timeout: 120000, // 120 seconds
      maxTokens: 4000,
      searchDepth: 1,
      maxSearchResults: 10,
      cacheStrategy: 'aggressive', // Use cached results preferentially
      parallelRequests: 2,
      description: 'Quick execution — cached results, shallow search',
    },
    adaptive: {
      mode: 'adaptive',
      timeout: 180000, // 180 seconds
      maxTokens: 6000,
      searchDepth: 2,
      maxSearchResults: 20,
      cacheStrategy: 'smart', // Use cache but fetch fresh if needed
      parallelRequests: 4,
      description: 'Balanced — medium search depth, moderate token budget',
    },
    full: {
      mode: 'full',
      timeout: 360000, // 360 seconds
      maxTokens: 8000,
      searchDepth: 3,
      maxSearchResults: 50,
      cacheStrategy: 'minimal', // Prefer fresh data
      parallelRequests: 8,
      description: 'Comprehensive — deep search, maximum resources',
    },
  };

  const baseConfig = configs[mode?.toLowerCase()] || configs.adaptive;

  // Apply overrides
  return {
    ...baseConfig,
    ...overrides,
  };
}

/**
 * Complete workflow: analyze, select, and return full config
 *
 * @param {string} prompt - Skill prompt to analyze
 * @param {Object} options - Configuration options
 * @param {string} options.userMode - User override ('fast'|'full'|'adaptive'|null)
 * @param {Object} options.context - Additional context (tags, vaultReferences)
 * @param {Object} options.configOverrides - Config overrides
 * @returns {Object} {mode, analysis, config}
 */
export function selectModeWithConfig(prompt, options = {}) {
  const analysis = analyzePrompt(prompt, options.context);
  const mode = selectMode(analysis, options.userMode);
  const config = getConfig(mode, options.configOverrides);

  return {
    mode,
    analysis,
    config,
  };
}

/**
 * Helper: determine if a prompt is simple (< 100 words, no keywords)
 *
 * @param {string} prompt - Skill prompt
 * @returns {boolean}
 */
export function isSimple(prompt) {
  const wordCount = prompt?.trim().split(/\s+/).length || 0;
  return wordCount < 100;
}

/**
 * Helper: determine if a prompt is complex (> 200 words + API keywords)
 *
 * @param {string} prompt - Skill prompt
 * @returns {boolean}
 */
export function isComplex(prompt) {
  const wordCount = prompt?.trim().split(/\s+/).length || 0;
  const hasApiKeywords = /api|integration|database|external|webhook/i.test(prompt);

  return wordCount > 200 && hasApiKeywords;
}
