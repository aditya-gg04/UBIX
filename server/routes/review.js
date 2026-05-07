/**
 * UBIX Human Review API Routes
 */
import { Router } from 'express';
import { getDatabase, queryAll, queryOne, execute, generateUBID } from '../db/database.js';

const router = Router();

// GET /api/review/pending — Get pending match candidates
router.get('/pending', (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  const total = queryOne("SELECT COUNT(*) as count FROM match_candidates WHERE status = 'pending'")?.count || 0;

  const candidates = queryAll(`
    SELECT mc.*,
      sa.business_name as name_a, sa.pan as pan_a, sa.gstin as gstin_a, sa.address as addr_a,
      sa.district as district_a, sa.phone as phone_a, sa.email as email_a,
      da.name as dept_a, da.code as dept_code_a,
      sb.business_name as name_b, sb.pan as pan_b, sb.gstin as gstin_b, sb.address as addr_b,
      sb.district as district_b, sb.phone as phone_b, sb.email as email_b,
      db.name as dept_b, db.code as dept_code_b
    FROM match_candidates mc
    JOIN source_records sa ON mc.record_a_id = sa.id
    JOIN source_records sb ON mc.record_b_id = sb.id
    JOIN departments da ON sa.department_id = da.id
    JOIN departments db ON sb.department_id = db.id
    WHERE mc.status = 'pending'
    ORDER BY mc.confidence DESC
    LIMIT ? OFFSET ?
  `, [Number(limit), Number(offset)]);

  res.json({ success: true, data: candidates, total });
});

// GET /api/review/:id — Get match detail with signals
router.get('/:id', (req, res) => {
  const match = queryOne(`
    SELECT mc.*,
      sa.business_name as name_a, sa.pan as pan_a, sa.gstin as gstin_a, sa.address as addr_a,
      sa.district as district_a, sa.phone as phone_a, sa.email as email_a, sa.business_type as type_a,
      da.name as dept_a, da.code as dept_code_a,
      sb.business_name as name_b, sb.pan as pan_b, sb.gstin as gstin_b, sb.address as addr_b,
      sb.district as district_b, sb.phone as phone_b, sb.email as email_b, sb.business_type as type_b,
      db.name as dept_b, db.code as dept_code_b
    FROM match_candidates mc
    JOIN source_records sa ON mc.record_a_id = sa.id
    JOIN source_records sb ON mc.record_b_id = sb.id
    JOIN departments da ON sa.department_id = da.id
    JOIN departments db ON sb.department_id = db.id
    WHERE mc.id = ?
  `, [req.params.id]);

  if (!match) return res.status(404).json({ success: false, error: 'Match not found' });
  
  match.signals = JSON.parse(match.signals_json || '[]');
  res.json({ success: true, data: match });
});

// POST /api/review/:id/decide — Accept or reject a match
router.post('/:id/decide', (req, res) => {
  const { decision, reason } = req.body;
  if (!['accepted', 'rejected'].includes(decision)) {
    return res.status(400).json({ success: false, error: 'Decision must be accepted or rejected' });
  }

  const match = queryOne('SELECT * FROM match_candidates WHERE id = ?', [req.params.id]);
  if (!match) return res.status(404).json({ success: false, error: 'Match not found' });
  if (match.status !== 'pending') {
    return res.status(400).json({ success: false, error: 'Match already reviewed' });
  }

  const db = getDatabase();
  const tx = db.transaction(() => {
    // Update match status
    execute('UPDATE match_candidates SET status = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [decision, req.params.id]);

    // Record decision
    execute('INSERT INTO review_decisions (match_candidate_id, decision, reason) VALUES (?, ?, ?)',
      [req.params.id, decision, reason || null]);

    // If accepted, create UBID and link records
    if (decision === 'accepted') {
      const srcA = queryOne('SELECT * FROM source_records WHERE id = ?', [match.record_a_id]);
      const ubidId = generateUBID();
      
      db.prepare(`
        INSERT INTO ubids (id, primary_name, primary_pan, primary_gstin, primary_address, primary_district, business_type, department_count, record_count, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, 2, 2, ?)
      `).run(ubidId, srcA.business_name, srcA.pan, srcA.gstin, srcA.address, srcA.district, srcA.business_type, match.confidence);

      const signals = match.signals_json;
      db.prepare('INSERT INTO ubid_links (ubid_id, source_record_id, confidence, match_method, signals_json) VALUES (?, ?, ?, ?, ?)')
        .run(ubidId, match.record_a_id, match.confidence, 'manual', signals);
      db.prepare('INSERT INTO ubid_links (ubid_id, source_record_id, confidence, match_method, signals_json) VALUES (?, ?, ?, ?, ?)')
        .run(ubidId, match.record_b_id, match.confidence, 'manual', signals);
    }
  });
  tx();

  res.json({ success: true, message: `Match ${decision} successfully` });
});

// GET /api/review/history — Review audit trail
router.get('/history/all', (req, res) => {
  const { limit = 50, offset = 0 } = req.query;
  const history = queryAll(`
    SELECT rd.*, mc.record_a_id, mc.record_b_id, mc.confidence,
      sa.business_name as name_a, sb.business_name as name_b
    FROM review_decisions rd
    JOIN match_candidates mc ON rd.match_candidate_id = mc.id
    JOIN source_records sa ON mc.record_a_id = sa.id
    JOIN source_records sb ON mc.record_b_id = sb.id
    ORDER BY rd.decided_at DESC
    LIMIT ? OFFSET ?
  `, [Number(limit), Number(offset)]);

  res.json({ success: true, data: history });
});

export default router;
