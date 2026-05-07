/**
 * UBIX Multi-Layer Entity Matcher
 * 
 * Layer 1: Deterministic (PAN/GSTIN exact match)
 * Layer 2: Probabilistic (Jaro-Winkler, Levenshtein)
 * Layer 3: Embedding (TF-IDF cosine similarity)
 */

import { normalizeName, normalizeAddress, normalizePAN, normalizeGSTIN, extractPANFromGSTIN, normalizePhone, getNameTokens, getAddressTokens } from './normalizer.js';
import { TFIDFVectorizer } from './tfidf.js';

// ============================================================
// STRING SIMILARITY ALGORITHMS
// ============================================================

/** Jaro similarity */
function jaro(s1, s2) {
  if (s1 === s2) return 1.0;
  if (!s1.length || !s2.length) return 0.0;

  const matchDist = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
}

/** Jaro-Winkler similarity */
export function jaroWinkler(s1, s2) {
  const jaroSim = jaro(s1, s2);
  let prefix = 0;
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaroSim + prefix * 0.1 * (1 - jaroSim);
}

/** Levenshtein distance */
export function levenshtein(s1, s2) {
  const m = s1.length, n = s2.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array(n + 1);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i-1] === s2[j-1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + cost);
    }
  }
  return dp[m][n];
}

/** Levenshtein similarity (0-1) */
export function levenshteinSimilarity(s1, s2) {
  if (!s1 && !s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  return 1 - levenshtein(s1, s2) / maxLen;
}

/** Token overlap (Jaccard similarity) */
export function tokenOverlap(tokens1, tokens2) {
  if (!tokens1.length || !tokens2.length) return 0;
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  const intersection = [...set1].filter(t => set2.has(t)).length;
  const union = new Set([...set1, ...set2]).size;
  return union > 0 ? intersection / union : 0;
}

// ============================================================
// MATCH SIGNAL GENERATORS
// ============================================================

function createSignal(type, algorithm, score, explanation) {
  return { type, algorithm, score: Math.round(score * 1000) / 1000, explanation };
}

/** Layer 1: Deterministic matching */
function deterministicMatch(recA, recB) {
  const signals = [];

  // PAN exact match
  if (recA.normalized_pan && recB.normalized_pan) {
    if (recA.normalized_pan === recB.normalized_pan) {
      signals.push(createSignal('pan_match', 'exact', 0.95,
        `PAN numbers match exactly: ${recA.normalized_pan}`));
    }
  }

  // GSTIN exact match
  if (recA.normalized_gstin && recB.normalized_gstin) {
    if (recA.normalized_gstin === recB.normalized_gstin) {
      signals.push(createSignal('gstin_match', 'exact', 0.98,
        `GSTIN numbers match exactly: ${recA.normalized_gstin}`));
    }
  }

  // PAN extracted from GSTIN cross-match
  if (recA.normalized_pan && recB.normalized_gstin) {
    const panFromGstin = extractPANFromGSTIN(recB.normalized_gstin);
    if (panFromGstin && recA.normalized_pan === panFromGstin) {
      signals.push(createSignal('pan_gstin_cross', 'extraction', 0.93,
        `PAN ${recA.normalized_pan} matches PAN extracted from GSTIN ${recB.normalized_gstin}`));
    }
  }
  if (recB.normalized_pan && recA.normalized_gstin) {
    const panFromGstin = extractPANFromGSTIN(recA.normalized_gstin);
    if (panFromGstin && recB.normalized_pan === panFromGstin) {
      signals.push(createSignal('pan_gstin_cross', 'extraction', 0.93,
        `PAN ${recB.normalized_pan} matches PAN extracted from GSTIN ${recA.normalized_gstin}`));
    }
  }

  return signals;
}

/** Layer 2: Probabilistic matching */
function probabilisticMatch(recA, recB) {
  const signals = [];

  // Name similarity
  if (recA.normalized_name && recB.normalized_name) {
    const jwScore = jaroWinkler(recA.normalized_name, recB.normalized_name);
    if (jwScore > 0.6) {
      signals.push(createSignal('name_similarity', 'jaro_winkler', jwScore,
        `Names "${recA.normalized_name}" and "${recB.normalized_name}" have ${Math.round(jwScore*100)}% Jaro-Winkler similarity`));
    }

    // Token overlap
    const nameTokensA = JSON.parse(recA.name_tokens || '[]');
    const nameTokensB = JSON.parse(recB.name_tokens || '[]');
    const overlap = tokenOverlap(nameTokensA, nameTokensB);
    if (overlap > 0.3) {
      signals.push(createSignal('name_token_overlap', 'jaccard', overlap,
        `Name tokens have ${Math.round(overlap*100)}% overlap`));
    }
  }

  // Address similarity
  if (recA.normalized_address && recB.normalized_address) {
    const addrScore = levenshteinSimilarity(recA.normalized_address, recB.normalized_address);
    if (addrScore > 0.5) {
      signals.push(createSignal('address_similarity', 'levenshtein', addrScore,
        `Addresses have ${Math.round(addrScore*100)}% similarity`));
    }
  }

  // Phone match
  if (recA.normalized_phone && recB.normalized_phone) {
    if (recA.normalized_phone === recB.normalized_phone) {
      signals.push(createSignal('phone_match', 'exact', 0.85,
        `Phone numbers match: ${recA.normalized_phone}`));
    }
  }

  return signals;
}

/** Layer 3: Embedding-based matching */
function embeddingMatch(recA, recB) {
  const signals = [];
  if (recA.tfidf_vector && recB.tfidf_vector) {
    const vecA = JSON.parse(recA.tfidf_vector);
    const vecB = JSON.parse(recB.tfidf_vector);
    const cosSim = TFIDFVectorizer.cosineSimilarity(vecA, vecB);
    if (cosSim > 0.3) {
      signals.push(createSignal('embedding_similarity', 'tfidf_cosine', cosSim,
        `TF-IDF embedding cosine similarity: ${Math.round(cosSim*100)}%`));
    }
  }
  return signals;
}

// ============================================================
// MAIN MATCHER
// ============================================================

/**
 * Compare two normalized records and generate match signals
 */
export function compareRecords(recA, recB) {
  const allSignals = [
    ...deterministicMatch(recA, recB),
    ...probabilisticMatch(recA, recB),
    ...embeddingMatch(recA, recB),
  ];
  return allSignals;
}

/**
 * Check if two records are from the same department (should not match self)
 */
export function isSameRecord(recA, recB) {
  return recA.source_record_id === recB.source_record_id;
}

export default { compareRecords, jaroWinkler, levenshteinSimilarity, tokenOverlap, isSameRecord };
