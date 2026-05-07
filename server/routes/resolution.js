/**
 * UBIX Entity Resolution API Routes
 */
import { Router } from 'express';
import { getDatabase, queryAll, queryOne, execute, generateUBID } from '../db/database.js';
import { normalizeRecord } from '../engine/normalizer.js';
import { TFIDFVectorizer } from '../engine/tfidf.js';
import { compareRecords } from '../engine/matcher.js';
import { calculateConfidence, classifyMatch, explainConfidence } from '../engine/confidence.js';

const router = Router();

// POST /api/resolve — Run the full entity resolution pipeline
router.post('/resolve', (req, res) => {
  const db = getDatabase();

  // Step 1: Ensure normalization is done
  const normCount = queryOne('SELECT COUNT(*) as count FROM normalized_records')?.count || 0;
  const srcCount = queryOne('SELECT COUNT(*) as count FROM source_records')?.count || 0;

  if (normCount < srcCount) {
    // Normalize missing records
    const unNormalized = db.prepare(`
      SELECT sr.* FROM source_records sr
      LEFT JOIN normalized_records nr ON sr.id = nr.source_record_id
      WHERE nr.id IS NULL
    `).all();

    const insertNorm = db.prepare(`
      INSERT OR REPLACE INTO normalized_records 
      (source_record_id, normalized_name, normalized_address, normalized_pan, normalized_gstin, normalized_phone, name_tokens, address_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const normTx = db.transaction(() => {
      for (const record of unNormalized) {
        const norm = normalizeRecord(record);
        insertNorm.run(norm.source_record_id, norm.normalized_name, norm.normalized_address,
          norm.normalized_pan, norm.normalized_gstin, norm.normalized_phone, norm.name_tokens, norm.address_tokens);
      }
    });
    normTx();
  }

  // Step 2: Build TF-IDF vectors
  const allNorm = db.prepare('SELECT * FROM normalized_records').all();
  const documents = allNorm.map(r => {
    const nameTokens = JSON.parse(r.name_tokens || '[]');
    const addrTokens = JSON.parse(r.address_tokens || '[]');
    return [...nameTokens, ...addrTokens];
  });

  const vectorizer = new TFIDFVectorizer();
  vectorizer.fit(documents);

  const updateVector = db.prepare('UPDATE normalized_records SET tfidf_vector = ? WHERE id = ?');
  const vecTx = db.transaction(() => {
    for (let i = 0; i < allNorm.length; i++) {
      const vector = vectorizer.transform(documents[i]);
      updateVector.run(JSON.stringify(vector), allNorm[i].id);
    }
  });
  vecTx();

  // Step 3: Find candidate pairs (blocking by PAN, GSTIN, and district)
  const candidates = new Map(); // key: "min_id-max_id"

  // Block by PAN
  const panGroups = db.prepare(`
    SELECT normalized_pan, GROUP_CONCAT(source_record_id) as record_ids
    FROM normalized_records WHERE normalized_pan IS NOT NULL
    GROUP BY normalized_pan HAVING COUNT(*) > 1
  `).all();

  for (const group of panGroups) {
    const ids = group.record_ids.split(',').map(Number);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = `${Math.min(ids[i], ids[j])}-${Math.max(ids[i], ids[j])}`;
        candidates.set(key, [ids[i], ids[j]]);
      }
    }
  }

  // Block by district (from source records)
  const districtGroups = db.prepare(`
    SELECT sr.district, GROUP_CONCAT(nr.source_record_id) as record_ids
    FROM normalized_records nr
    JOIN source_records sr ON nr.source_record_id = sr.id
    WHERE sr.district IS NOT NULL
    GROUP BY sr.district HAVING COUNT(*) > 1
  `).all();

  for (const group of districtGroups) {
    const ids = group.record_ids.split(',').map(Number);
    // Limit pairs per district to avoid explosion
    const maxPairs = Math.min(ids.length, 30);
    for (let i = 0; i < maxPairs; i++) {
      for (let j = i + 1; j < maxPairs; j++) {
        const key = `${Math.min(ids[i], ids[j])}-${Math.max(ids[i], ids[j])}`;
        candidates.set(key, [ids[i], ids[j]]);
      }
    }
  }

  // Step 4: Compare candidate pairs
  // Refresh normalized records with vectors
  const normMap = new Map();
  const refreshed = db.prepare('SELECT * FROM normalized_records').all();
  for (const r of refreshed) {
    normMap.set(r.source_record_id, r);
  }

  const insertMatch = db.prepare(`
    INSERT INTO match_candidates (record_a_id, record_b_id, confidence, match_method, signals_json, explanation, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Clear previous candidates
  db.prepare("DELETE FROM match_candidates WHERE status = 'pending'").run();

  let autoMerged = 0, pendingReview = 0, noMerge = 0;

  const insertUbid = db.prepare(`
    INSERT INTO ubids (id, primary_name, primary_pan, primary_gstin, primary_address, primary_district, business_type, department_count, record_count, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
  `);
  const insertLink = db.prepare(`
    INSERT INTO ubid_links (ubid_id, source_record_id, confidence, match_method, signals_json)
    VALUES (?, ?, ?, ?, ?)
  `);

  const matchTx = db.transaction(() => {
    for (const [key, [idA, idB]] of candidates) {
      const recA = normMap.get(idA);
      const recB = normMap.get(idB);
      if (!recA || !recB) continue;

      const signals = compareRecords(recA, recB);
      if (signals.length === 0) continue;

      const confidence = calculateConfidence(signals);
      if (confidence < 0.35) continue; // Skip very low matches

      const classification = classifyMatch(confidence);
      const { explanation } = explainConfidence(signals, confidence);

      if (classification.action === 'auto_merge') {
        // Auto-create UBID and link both records
        const srcA = queryOne('SELECT * FROM source_records WHERE id = ?', [idA]);
        const ubidId = generateUBID();
        insertUbid.run(ubidId, srcA?.business_name || recA.normalized_name,
          recA.normalized_pan, recA.normalized_gstin,
          srcA?.address, srcA?.district, srcA?.business_type, confidence);
        insertLink.run(ubidId, idA, confidence, 'deterministic', JSON.stringify(signals));
        insertLink.run(ubidId, idB, confidence, 'deterministic', JSON.stringify(signals));
        autoMerged++;
      } else if (classification.action === 'human_review') {
        insertMatch.run(idA, idB, confidence, 'probabilistic', JSON.stringify(signals), explanation, 'pending');
        pendingReview++;
      } else {
        noMerge++;
      }
    }
  });
  matchTx();

  // Log pipeline run
  execute(`
    INSERT INTO pipeline_runs (run_type, status, records_processed, matches_found, auto_merged, pending_review, completed_at, details_json)
    VALUES ('resolution', 'completed', ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
  `, [candidates.size, autoMerged + pendingReview, autoMerged, pendingReview,
    JSON.stringify({ no_merge: noMerge, vocabulary_size: vectorizer.size })]);

  res.json({
    success: true,
    message: 'Entity resolution pipeline completed',
    results: {
      records_processed: srcCount,
      candidate_pairs: candidates.size,
      auto_merged: autoMerged,
      pending_review: pendingReview,
      no_merge: noMerge,
      vocabulary_size: vectorizer.size,
    }
  });
});

// GET /api/ubids — List all UBIDs
router.get('/ubids', (req, res) => {
  const { status, limit = 50, offset = 0, search } = req.query;
  let sql = 'SELECT * FROM ubids';
  const params = [];
  const conditions = [];

  if (status) { conditions.push('status = ?'); params.push(status); }
  if (search) {
    conditions.push('(primary_name LIKE ? OR primary_pan LIKE ? OR id LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');

  const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
  const total = queryOne(countSql, params)?.total || 0;

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  const ubids = queryAll(sql, params);

  res.json({ success: true, data: ubids, total });
});

// GET /api/ubids/:id — Get UBID detail with linked records
router.get('/ubids/:id', (req, res) => {
  const ubid = queryOne('SELECT * FROM ubids WHERE id = ?', [req.params.id]);
  if (!ubid) return res.status(404).json({ success: false, error: 'UBID not found' });

  const links = queryAll(`
    SELECT ul.*, sr.business_name, sr.pan, sr.gstin, sr.address, sr.district, sr.phone, sr.email,
           d.name as department_name, d.code as department_code
    FROM ubid_links ul
    JOIN source_records sr ON ul.source_record_id = sr.id
    JOIN departments d ON sr.department_id = d.id
    WHERE ul.ubid_id = ? AND ul.unlinked_at IS NULL
    ORDER BY ul.confidence DESC
  `, [req.params.id]);

  const events = queryAll(`
    SELECT ae.*, d.name as department_name 
    FROM activity_events ae
    JOIN departments d ON ae.department_id = d.id
    WHERE ae.ubid_id = ?
    ORDER BY ae.event_date DESC
  `, [req.params.id]);

  const classification = queryOne('SELECT * FROM activity_classifications WHERE ubid_id = ?', [req.params.id]);

  res.json({ success: true, data: { ubid, links, events, classification } });
});

// POST /api/ubids/:id/unlink — Reverse a link (reversible)
router.post('/ubids/:id/unlink', (req, res) => {
  const { source_record_id } = req.body;
  execute('UPDATE ubid_links SET unlinked_at = CURRENT_TIMESTAMP WHERE ubid_id = ? AND source_record_id = ?',
    [req.params.id, source_record_id]);
  
  // Update UBID record count
  const remaining = queryOne('SELECT COUNT(*) as count FROM ubid_links WHERE ubid_id = ? AND unlinked_at IS NULL', [req.params.id]);
  execute('UPDATE ubids SET record_count = ? WHERE id = ?', [remaining?.count || 0, req.params.id]);

  res.json({ success: true, message: 'Record unlinked successfully' });
});

export default router;
