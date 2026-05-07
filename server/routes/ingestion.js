/**
 * UBIX Ingestion API Routes
 */
import { Router } from 'express';
import { getDatabase, queryAll, queryOne, execute } from '../db/database.js';
import { normalizeRecord } from '../engine/normalizer.js';

const router = Router();

// GET /api/departments — List all departments
router.get('/departments', (req, res) => {
  const depts = queryAll('SELECT * FROM departments ORDER BY name');
  res.json({ success: true, data: depts });
});

// GET /api/records — List source records with filtering
router.get('/records', (req, res) => {
  const { department_id, limit = 50, offset = 0, search } = req.query;
  let sql = `
    SELECT sr.*, d.name as department_name, d.code as department_code
    FROM source_records sr
    JOIN departments d ON sr.department_id = d.id
  `;
  const params = [];
  const conditions = [];

  if (department_id) {
    conditions.push('sr.department_id = ?');
    params.push(department_id);
  }
  if (search) {
    conditions.push('(sr.business_name LIKE ? OR sr.pan LIKE ? OR sr.gstin LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
  
  // Get total count
  const countSql = sql.replace(/SELECT sr\.\*, d\.name as department_name, d\.code as department_code/, 'SELECT COUNT(*) as total');
  const total = queryOne(countSql, params)?.total || 0;

  sql += ' ORDER BY sr.id DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const records = queryAll(sql, params);
  res.json({ success: true, data: records, total, limit: Number(limit), offset: Number(offset) });
});

// GET /api/records/:id — Get single record
router.get('/records/:id', (req, res) => {
  const record = queryOne(`
    SELECT sr.*, d.name as department_name, d.code as department_code
    FROM source_records sr
    JOIN departments d ON sr.department_id = d.id
    WHERE sr.id = ?
  `, [req.params.id]);
  if (!record) return res.status(404).json({ success: false, error: 'Record not found' });
  res.json({ success: true, data: record });
});

// POST /api/ingest/normalize — Normalize all source records
router.post('/normalize', (req, res) => {
  const db = getDatabase();
  const records = db.prepare('SELECT * FROM source_records').all();
  
  const insertNorm = db.prepare(`
    INSERT OR REPLACE INTO normalized_records 
    (source_record_id, normalized_name, normalized_address, normalized_pan, normalized_gstin, normalized_phone, name_tokens, address_tokens)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  const transaction = db.transaction(() => {
    for (const record of records) {
      const norm = normalizeRecord(record);
      insertNorm.run(
        norm.source_record_id, norm.normalized_name, norm.normalized_address,
        norm.normalized_pan, norm.normalized_gstin, norm.normalized_phone,
        norm.name_tokens, norm.address_tokens
      );
      count++;
    }
  });
  transaction();

  res.json({ success: true, message: `Normalized ${count} records`, count });
});

// GET /api/stats — Get overall statistics
router.get('/stats', (req, res) => {
  const stats = {
    departments: queryOne('SELECT COUNT(*) as count FROM departments')?.count || 0,
    source_records: queryOne('SELECT COUNT(*) as count FROM source_records')?.count || 0,
    normalized_records: queryOne('SELECT COUNT(*) as count FROM normalized_records')?.count || 0,
    ubids: queryOne('SELECT COUNT(*) as count FROM ubids')?.count || 0,
    pending_reviews: queryOne("SELECT COUNT(*) as count FROM match_candidates WHERE status = 'pending'")?.count || 0,
    accepted_reviews: queryOne("SELECT COUNT(*) as count FROM match_candidates WHERE status = 'accepted'")?.count || 0,
    rejected_reviews: queryOne("SELECT COUNT(*) as count FROM match_candidates WHERE status = 'rejected'")?.count || 0,
    activity_events: queryOne('SELECT COUNT(*) as count FROM activity_events')?.count || 0,
    unlinked_events: queryOne("SELECT COUNT(*) as count FROM unlinked_events WHERE status = 'unresolved'")?.count || 0,
    active_businesses: queryOne("SELECT COUNT(*) as count FROM activity_classifications WHERE status = 'active'")?.count || 0,
    dormant_businesses: queryOne("SELECT COUNT(*) as count FROM activity_classifications WHERE status = 'dormant'")?.count || 0,
    closed_businesses: queryOne("SELECT COUNT(*) as count FROM activity_classifications WHERE status = 'closed'")?.count || 0,
    records_with_pan: queryOne('SELECT COUNT(*) as count FROM source_records WHERE pan IS NOT NULL')?.count || 0,
    records_with_gstin: queryOne('SELECT COUNT(*) as count FROM source_records WHERE gstin IS NOT NULL')?.count || 0,
  };

  // Department breakdown
  stats.department_breakdown = queryAll(`
    SELECT d.id, d.name, d.code, d.record_count 
    FROM departments d ORDER BY d.record_count DESC
  `);

  res.json({ success: true, data: stats });
});

export default router;
