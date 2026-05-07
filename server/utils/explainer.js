/**
 * UBIX Explainability Report Generator
 * 
 * Generates human-readable explanations for all decisions.
 */

/**
 * Generate match explanation
 */
export function explainMatch(signals, confidence, classification) {
  const parts = [];
  parts.push(`**Match Confidence: ${Math.round(confidence * 100)}%** → ${classification.label}`);
  parts.push('');
  parts.push('**Evidence:**');

  const sorted = [...signals].sort((a, b) => b.score - a.score);
  for (const signal of sorted) {
    const pct = Math.round(signal.score * 100);
    const icon = pct >= 80 ? '🟢' : pct >= 60 ? '🟡' : '🔴';
    parts.push(`${icon} ${signal.explanation}`);
  }

  if (classification.action === 'auto_merge') {
    parts.push('');
    parts.push('✅ This match was auto-merged due to high confidence.');
  } else if (classification.action === 'human_review') {
    parts.push('');
    parts.push('⚠️ This match requires human review due to medium confidence.');
  }

  return parts.join('\n');
}

/**
 * Generate activity classification explanation
 */
export function explainClassification(classification) {
  const parts = [];
  const statusEmoji = { active: '🟢', dormant: '🟡', closed: '🔴', unknown: '⚪' };
  
  parts.push(`${statusEmoji[classification.status] || '⚪'} **Status: ${classification.status.toUpperCase()}** (${Math.round(classification.confidence * 100)}% confidence)`);
  parts.push('');
  parts.push('**Evidence:**');
  
  for (const ev of classification.evidence) {
    parts.push(`• ${ev.description}`);
  }

  return parts.join('\n');
}

/**
 * Generate UBID link explanation
 */
export function explainLink(ubid, linkedRecords) {
  const parts = [];
  parts.push(`**UBID: ${ubid.id}**`);
  parts.push(`Primary Name: ${ubid.primary_name}`);
  parts.push(`Linked Records: ${linkedRecords.length}`);
  parts.push(`Departments: ${ubid.department_count}`);
  parts.push('');
  
  for (const rec of linkedRecords) {
    parts.push(`• [${rec.department_code}] ${rec.business_name} (confidence: ${Math.round(rec.confidence * 100)}%)`);
  }

  return parts.join('\n');
}

export default { explainMatch, explainClassification, explainLink };
