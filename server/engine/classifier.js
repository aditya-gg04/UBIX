/**
 * UBIX Activity Classifier
 * 
 * Classifies businesses as Active, Dormant, or Closed
 * based on aggregated event data with explainable evidence.
 */

/**
 * Classify a business based on its events
 * @param {Array} events - Array of activity events sorted by date
 * @returns {Object} Classification result with evidence
 */
export function classifyBusiness(events) {
  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const eighteenMonthsAgo = new Date(now);
  eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);

  if (!events || events.length === 0) {
    return {
      status: 'unknown',
      confidence: 0.5,
      evidence: [{ type: 'no_events', description: 'No activity events found for this business' }],
      event_count: 0,
      last_event_date: null,
    };
  }

  // Sort events by date descending
  const sorted = [...events].sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
  const lastEvent = sorted[0];
  const lastEventDate = new Date(lastEvent.event_date);

  // Count events in periods
  const eventsLast6 = sorted.filter(e => new Date(e.event_date) >= sixMonthsAgo).length;
  const eventsLast12 = sorted.filter(e => new Date(e.event_date) >= twelveMonthsAgo).length;
  const eventsLast18 = sorted.filter(e => new Date(e.event_date) >= eighteenMonthsAgo).length;

  // Check for explicit closure events
  const hasClosure = sorted.some(e => e.event_type === 'closure' || e.event_type === 'deregistration');

  const evidence = [];
  let status, confidence;

  if (hasClosure) {
    status = 'closed';
    confidence = 0.95;
    evidence.push({ type: 'closure_event', description: 'Explicit closure/deregistration event found' });
  } else if (lastEventDate < eighteenMonthsAgo) {
    status = 'closed';
    confidence = 0.85;
    evidence.push({ type: 'last_event', date: lastEvent.event_date, description: `Last event was over 18 months ago (${lastEvent.event_date})` });
  } else if (eventsLast6 > 0 || eventsLast12 >= 3) {
    status = 'active';
    confidence = Math.min(0.6 + eventsLast6 * 0.08 + eventsLast12 * 0.03, 0.98);
    evidence.push({ type: 'recent_activity', description: `${eventsLast6} events in last 6 months, ${eventsLast12} in last 12 months` });
    // Check activity trend
    const eventsOlder = sorted.filter(e => new Date(e.event_date) < twelveMonthsAgo).length;
    if (eventsLast12 > eventsOlder) {
      evidence.push({ type: 'trend', description: 'Increasing activity trend' });
      confidence = Math.min(confidence + 0.05, 0.98);
    }
  } else {
    status = 'dormant';
    confidence = 0.75;
    evidence.push({ type: 'low_activity', description: `Only ${eventsLast12} event(s) in last 12 months` });
    evidence.push({ type: 'last_event', date: lastEvent.event_date, description: `Last event on ${lastEvent.event_date}` });
  }

  // Add event distribution evidence
  const deptSet = new Set(events.map(e => e.department_id));
  evidence.push({ type: 'department_spread', description: `Activity across ${deptSet.size} department(s)` });
  evidence.push({ type: 'event_count', period: '12_months', count: eventsLast12 });
  evidence.push({ type: 'total_events', count: events.length });

  // Build timeline summary
  const timeline = sorted.slice(0, 10).map(e => ({
    date: e.event_date,
    type: e.event_type,
    department_id: e.department_id,
  }));

  return {
    status,
    confidence: Math.round(confidence * 1000) / 1000,
    evidence,
    event_count: events.length,
    last_event_date: lastEvent.event_date,
    timeline,
  };
}

/**
 * Get status color
 */
export function getStatusColor(status) {
  switch (status) {
    case 'active': return '#10b981';
    case 'dormant': return '#f59e0b';
    case 'closed': return '#ef4444';
    default: return '#6b7280';
  }
}

export default { classifyBusiness, getStatusColor };
