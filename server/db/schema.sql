-- UBIX Database Schema
-- Unified Business Identity & Activity Intelligence Platform

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- DEPARTMENT SYSTEMS (Source metadata)
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  record_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- SOURCE RECORDS (Raw data from departments)
-- ============================================================
CREATE TABLE IF NOT EXISTS source_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER NOT NULL,
  business_name TEXT NOT NULL,
  pan TEXT,
  gstin TEXT,
  address TEXT,
  district TEXT,
  phone TEXT,
  email TEXT,
  business_type TEXT,
  registration_date TEXT,
  raw_json TEXT,
  ingested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE INDEX IF NOT EXISTS idx_source_pan ON source_records(pan);
CREATE INDEX IF NOT EXISTS idx_source_gstin ON source_records(gstin);
CREATE INDEX IF NOT EXISTS idx_source_dept ON source_records(department_id);
CREATE INDEX IF NOT EXISTS idx_source_name ON source_records(business_name);

-- ============================================================
-- NORMALIZED RECORDS (Cleaned versions)
-- ============================================================
CREATE TABLE IF NOT EXISTS normalized_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_record_id INTEGER NOT NULL UNIQUE,
  normalized_name TEXT NOT NULL,
  normalized_address TEXT,
  normalized_pan TEXT,
  normalized_gstin TEXT,
  normalized_phone TEXT,
  name_tokens TEXT,        -- JSON array of tokens
  address_tokens TEXT,     -- JSON array of tokens
  tfidf_vector TEXT,       -- JSON sparse vector
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_record_id) REFERENCES source_records(id)
);

CREATE INDEX IF NOT EXISTS idx_norm_pan ON normalized_records(normalized_pan);
CREATE INDEX IF NOT EXISTS idx_norm_gstin ON normalized_records(normalized_gstin);
CREATE INDEX IF NOT EXISTS idx_norm_name ON normalized_records(normalized_name);

-- ============================================================
-- UBID REGISTRY (Central identity store)
-- ============================================================
CREATE TABLE IF NOT EXISTS ubids (
  id TEXT PRIMARY KEY,     -- UBID format: UBID-XXXXXXXX
  primary_name TEXT NOT NULL,
  primary_pan TEXT,
  primary_gstin TEXT,
  primary_address TEXT,
  primary_district TEXT,
  business_type TEXT,
  department_count INTEGER DEFAULT 1,
  record_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',   -- active, dormant, closed, unknown
  confidence REAL DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ubid_status ON ubids(status);
CREATE INDEX IF NOT EXISTS idx_ubid_pan ON ubids(primary_pan);

-- ============================================================
-- UBID LINKS (Source record → UBID mapping)
-- ============================================================
CREATE TABLE IF NOT EXISTS ubid_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ubid_id TEXT NOT NULL,
  source_record_id INTEGER NOT NULL,
  confidence REAL NOT NULL,
  match_method TEXT NOT NULL,   -- deterministic, probabilistic, embedding, manual
  signals_json TEXT,            -- JSON array of match signals
  linked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  unlinked_at DATETIME,         -- NULL if still linked (reversible)
  FOREIGN KEY (ubid_id) REFERENCES ubids(id),
  FOREIGN KEY (source_record_id) REFERENCES source_records(id)
);

CREATE INDEX IF NOT EXISTS idx_link_ubid ON ubid_links(ubid_id);
CREATE INDEX IF NOT EXISTS idx_link_source ON ubid_links(source_record_id);

-- ============================================================
-- MATCH CANDIDATES (Pending review)
-- ============================================================
CREATE TABLE IF NOT EXISTS match_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_a_id INTEGER NOT NULL,
  record_b_id INTEGER NOT NULL,
  confidence REAL NOT NULL,
  match_method TEXT NOT NULL,
  signals_json TEXT NOT NULL,   -- JSON array of similarity signals
  explanation TEXT,             -- Human-readable explanation
  status TEXT DEFAULT 'pending', -- pending, accepted, rejected
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  FOREIGN KEY (record_a_id) REFERENCES source_records(id),
  FOREIGN KEY (record_b_id) REFERENCES source_records(id)
);

CREATE INDEX IF NOT EXISTS idx_match_status ON match_candidates(status);
CREATE INDEX IF NOT EXISTS idx_match_confidence ON match_candidates(confidence);

-- ============================================================
-- REVIEW DECISIONS (Audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS review_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_candidate_id INTEGER NOT NULL,
  decision TEXT NOT NULL,       -- accepted, rejected
  reviewer TEXT DEFAULT 'admin',
  reason TEXT,
  decided_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_candidate_id) REFERENCES match_candidates(id)
);

-- ============================================================
-- ACTIVITY EVENTS (Business events from departments)
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ubid_id TEXT,                 -- NULL if unlinked
  source_record_id INTEGER,
  department_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,     -- inspection, filing, renewal, consumption, closure, registration
  event_date TEXT NOT NULL,
  event_details TEXT,           -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ubid_id) REFERENCES ubids(id),
  FOREIGN KEY (source_record_id) REFERENCES source_records(id),
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

CREATE INDEX IF NOT EXISTS idx_event_ubid ON activity_events(ubid_id);
CREATE INDEX IF NOT EXISTS idx_event_type ON activity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_event_date ON activity_events(event_date);

-- ============================================================
-- ACTIVITY CLASSIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_classifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ubid_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,         -- active, dormant, closed
  confidence REAL NOT NULL,
  evidence_json TEXT NOT NULL,  -- JSON array of evidence items
  event_count INTEGER DEFAULT 0,
  last_event_date TEXT,
  classified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ubid_id) REFERENCES ubids(id)
);

CREATE INDEX IF NOT EXISTS idx_class_status ON activity_classifications(status);

-- ============================================================
-- UNLINKED EVENTS (Events that couldn't match to a UBID)
-- ============================================================
CREATE TABLE IF NOT EXISTS unlinked_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_date TEXT NOT NULL,
  business_name_hint TEXT,
  raw_json TEXT,
  status TEXT DEFAULT 'unresolved',  -- unresolved, linked, dismissed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- ============================================================
-- PIPELINE RUNS (Track resolution pipeline executions)
-- ============================================================
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT NOT NULL,       -- ingestion, resolution, classification
  status TEXT DEFAULT 'running', -- running, completed, failed
  records_processed INTEGER DEFAULT 0,
  matches_found INTEGER DEFAULT 0,
  auto_merged INTEGER DEFAULT 0,
  pending_review INTEGER DEFAULT 0,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  details_json TEXT
);
