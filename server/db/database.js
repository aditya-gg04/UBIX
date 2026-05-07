import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', '..', 'data', 'ubix.db');
const SCHEMA_PATH = join(__dirname, 'schema.sql');

// Ensure data directory exists
const dataDir = dirname(DB_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

let db = null;

export function getDatabase() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Initialize schema
    const schema = readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

// Helper: run a query and return all rows
export function queryAll(sql, params = []) {
  const stmt = getDatabase().prepare(sql);
  return stmt.all(...params);
}

// Helper: run a query and return first row
export function queryOne(sql, params = []) {
  const stmt = getDatabase().prepare(sql);
  return stmt.get(...params);
}

// Helper: run an insert/update and return info
export function execute(sql, params = []) {
  const stmt = getDatabase().prepare(sql);
  return stmt.run(...params);
}

// Helper: run multiple inserts in a transaction
export function executeMany(sql, paramsList) {
  const stmt = getDatabase().prepare(sql);
  const transaction = getDatabase().transaction((items) => {
    for (const params of items) {
      stmt.run(...params);
    }
  });
  transaction(paramsList);
}

// Generate UBID
export function generateUBID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'UBID-';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export default { getDatabase, closeDatabase, queryAll, queryOne, execute, executeMany, generateUBID };
