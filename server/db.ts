import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

/** Directory holding `life.db` and attached files. Override with LIFE_OS_DATA_DIR. */
export function resolveDataDir(): string {
  return path.resolve(process.env.LIFE_OS_DATA_DIR || path.join(homedir(), '.life-os'))
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL,
  applied_date TEXT NOT NULL,
  salary_min INTEGER,
  salary_max INTEGER,
  url TEXT,
  raw_description TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  starred INTEGER NOT NULL DEFAULT 0,
  extracted_metadata TEXT,
  resume_name TEXT,
  resume_file TEXT,
  resume_uploaded_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_qa (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS job_qa_job ON job_qa(job_id, position);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  summary TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS activity_job ON activity(job_id, id);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO meta (key, value) VALUES ('revision', '0');
`

/**
 * Opens (creating if needed) the shared database. The dashboard and every MCP
 * process open the same file, so WAL mode and a busy timeout let them write concurrently.
 */
export function openDatabase(dataDir = resolveDataDir()): DatabaseSync {
  mkdirSync(dataDir, { recursive: true })
  const db = new DatabaseSync(path.join(dataDir, 'life.db'))
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA)
  return db
}
