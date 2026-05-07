/**
 * UBIX Confidence Scoring & Calibration
 * 
 * Aggregates match signals into a final confidence score
 * with configurable thresholds for auto-merge vs human review.
 */

// Signal weight configuration
const SIGNAL_WEIGHTS = {
  'gstin_match': 1.0,
  'pan_match': 0.95,
  'pan_gstin_cross': 0.90,
  'name_similarity': 0.70,
  'name_token_overlap': 0.50,
  'address_similarity': 0.40,
  'phone_match': 0.60,
  'embedding_similarity': 0.55,
};

// Thresholds
export const THRESHOLDS = {
  AUTO_MERGE: 0.85,
  HUMAN_REVIEW: 0.55,
  NO_MERGE: 0.55,  // Below this = no merge
};

/**
 * Calculate overall confidence from match signals
 */
export function calculateConfidence(signals) {
  if (!signals || signals.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  // Check for deterministic signals first (they dominate)
  const hasDeterministic = signals.some(s =>
    ['pan_match', 'gstin_match', 'pan_gstin_cross'].includes(s.type)
  );

  for (const signal of signals) {
    const weight = SIGNAL_WEIGHTS[signal.type] || 0.3;
    // Boost deterministic signals
    const effectiveWeight = hasDeterministic && 
      ['pan_match', 'gstin_match', 'pan_gstin_cross'].includes(signal.type)
      ? weight * 1.5 : weight;
    
    weightedSum += signal.score * effectiveWeight;
    totalWeight += effectiveWeight;
  }

  const baseConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0;

  // Signal count bonus (more signals = more confident)
  const signalBonus = Math.min(signals.length * 0.02, 0.1);

  // Cross-department bonus (if signals span different types)
  const signalTypes = new Set(signals.map(s => s.type));
  const diversityBonus = signalTypes.size >= 3 ? 0.05 : 0;

  const finalConfidence = Math.min(baseConfidence + signalBonus + diversityBonus, 1.0);
  return Math.round(finalConfidence * 1000) / 1000;
}

/**
 * Classify a match based on confidence
 */
export function classifyMatch(confidence) {
  if (confidence >= THRESHOLDS.AUTO_MERGE) {
    return { action: 'auto_merge', label: 'Auto Merge', color: '#10b981' };
  } else if (confidence >= THRESHOLDS.HUMAN_REVIEW) {
    return { action: 'human_review', label: 'Human Review', color: '#f59e0b' };
  } else {
    return { action: 'no_merge', label: 'No Merge', color: '#ef4444' };
  }
}

/**
 * Generate a confidence explanation
 */
export function explainConfidence(signals, confidence) {
  const classification = classifyMatch(confidence);
  const topSignals = [...signals].sort((a, b) => b.score - a.score).slice(0, 3);

  let explanation = `Overall confidence: ${Math.round(confidence * 100)}% → ${classification.label}. `;
  explanation += `Based on ${signals.length} signal(s): `;
  explanation += topSignals.map(s => `${s.type} (${Math.round(s.score * 100)}%)`).join(', ');

  return {
    confidence,
    classification,
    explanation,
    signals: signals.map(s => ({
      ...s,
      weight: SIGNAL_WEIGHTS[s.type] || 0.3,
    })),
  };
}

export default { calculateConfidence, classifyMatch, explainConfidence, THRESHOLDS };
