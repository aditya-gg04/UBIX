/**
 * UBIX Activity Intelligence API Routes
 */
import { Router } from 'express';
import { getDatabase, queryAll, queryOne, execute } from '../db/database.js';
import { classifyBusiness } from '../engine/classifier.js';

const router = Router();

// POST /api/activity/classify — Run activity classification for all UBIDs
router.post('/classify', (req, res) => {
  const db = getDatabase();
  const ubids = db.prepare('SELECT * FROM ubids').all();

  // First, link events to UBIDs via source records
  const linkEvents = db.prepare(`
    UPDATE activity_events SET ubid_id = (
      SELECT ul.ubid_id FROM ubid_links ul
      WHERE ul.source_record_id = activity_events.source_record_id
      AND ul.unlinked_at IS NULL
      LIMIT 1
    ) WHERE ubid_id IS NULL
  `);
  linkEvents.run();

  const insertClass = db.prepare(`
    INSERT OR REPLACE INTO activity_classifications (ubid_id, status, confidence, evidence_json, event_count, last_event_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let classified = 0;
  const stats = { active: 0, dormant: 0, closed: 0, unknown: 0 };

  const tx = db.transaction(() => {
    for (const ubid of ubids) {
      const events = db.prepare(`
        SELECT ae.*, d.name as department_name
        FROM activity_events ae
        JOIN departments d ON ae.department_id = d.id
        WHERE ae.ubid_id = ?
        ORDER BY ae.event_date DESC
      `).all(ubid.id);

      const result = classifyBusiness(events);
      insertClass.run(ubid.id, result.status, result.confidence,
        JSON.stringify(result.evidence), result.event_count, result.last_event_date);

      // Update UBID status
      db.prepare('UPDATE ubids SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(result.status, ubid.id);

      stats[result.status] = (stats[result.status] || 0) + 1;
      classified++;
    }
  });
  tx();

  execute(`
    INSERT INTO pipeline_runs (run_type, status, records_processed, completed_at, details_json)
    VALUES ('classification', 'completed', ?, CURRENT_TIMESTAMP, ?)
  `, [classified, JSON.stringify(stats)]);

  res.json({ success: true, message: `Classified ${classified} businesses`, stats });
});

// GET /api/activity/:ubid — Get activity status for a business
router.get('/:ubid', (req, res) => {
  const classification = queryOne('SELECT * FROM activity_classifications WHERE ubid_id = ?', [req.params.ubid]);
  if (!classification) return res.status(404).json({ success: false, error: 'Classification not found' });

  classification.evidence = JSON.parse(classification.evidence_json || '[]');
  
  const events = queryAll(`
    SELECT ae.*, d.name as department_name, d.code as department_code
    FROM activity_events ae
    JOIN departments d ON ae.department_id = d.id
    WHERE ae.ubid_id = ?
    ORDER BY ae.event_date DESC
  `, [req.params.ubid]);

  res.json({ success: true, data: { classification, events } });
});

// GET /api/activity — Get all classifications
router.get('/', (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  let sql = `
    SELECT ac.*, u.primary_name, u.primary_pan, u.primary_district
    FROM activity_classifications ac
    JOIN ubids u ON ac.ubid_id = u.id
  `;
  const params = [];
  if (status) { sql += ' WHERE ac.status = ?'; params.push(status); }
  
  const countSql = sql.replace(/SELECT ac\.\*, u\.primary_name.*/, 'SELECT COUNT(*) as total') + (status ? '' : '');
  const total = queryOne(countSql, params)?.total || 0;

  sql += ' ORDER BY ac.classified_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const data = queryAll(sql, params);
  res.json({ success: true, data, total });
});

// GET /api/activity/unlinked/events — Get unlinked events
router.get('/unlinked/events', (req, res) => {
  const events = queryAll(`
    SELECT ue.*, d.name as department_name, d.code as department_code
    FROM unlinked_events ue
    JOIN departments d ON ue.department_id = d.id
    WHERE ue.status = 'unresolved'
    ORDER BY ue.created_at DESC
    LIMIT 50
  `);
  res.json({ success: true, data: events });
});

export default router;
