export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS institutions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  short_code TEXT UNIQUE NOT NULL,
  province TEXT,
  institution_type TEXT,
  website TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  colour TEXT
);

CREATE TABLE IF NOT EXISTS institution_tags (
  institution_id INTEGER REFERENCES institutions(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (institution_id, tag_id)
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  document_type TEXT,
  fiscal_year TEXT,
  upload_date TEXT DEFAULT (datetime('now')),
  processing_status TEXT DEFAULT 'Pending',
  processing_error TEXT,
  page_count INTEGER,
  word_count INTEGER,
  raw_text TEXT
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  token_estimate INTEGER
);

CREATE TABLE IF NOT EXISTS financial_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id),
  fiscal_year TEXT NOT NULL,
  total_revenue REAL,
  total_expenses REAL,
  net_surplus_deficit REAL,
  operating_revenue REAL,
  operating_expenses REAL,
  government_grants REAL,
  tuition_revenue REAL,
  research_revenue REAL,
  investment_income REAL,
  total_assets REAL,
  total_liabilities REAL,
  net_assets REAL,
  endowment_value REAL,
  international_student_revenue REAL,
  notes TEXT,
  extracted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS strategic_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id),
  plan_name TEXT,
  plan_period_start TEXT,
  plan_period_end TEXT,
  vision_statement TEXT,
  extracted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS strategic_priorities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  strategic_plan_id INTEGER REFERENCES strategic_plans(id),
  document_id INTEGER REFERENCES documents(id),
  priority_name TEXT NOT NULL,
  priority_description TEXT,
  pillar TEXT,
  progress_status TEXT,
  key_initiatives TEXT,
  extracted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS kpi_datapoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id),
  kpi_name TEXT NOT NULL,
  kpi_category TEXT,
  fiscal_year TEXT,
  value REAL,
  unit TEXT,
  notes TEXT,
  extracted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sustainability_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  document_id INTEGER REFERENCES documents(id),
  fiscal_year TEXT,
  ghg_emissions_total REAL,
  ghg_scope_1 REAL,
  ghg_scope_2 REAL,
  ghg_scope_3 REAL,
  energy_consumption REAL,
  renewable_energy_pct REAL,
  waste_diversion_rate REAL,
  water_consumption REAL,
  net_zero_target_year TEXT,
  sustainability_certifications TEXT,
  extracted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS institution_themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  theme_id INTEGER NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  relevance_score INTEGER,
  evidence TEXT,
  identified_at TEXT DEFAULT (datetime('now')),
  UNIQUE(institution_id, theme_id)
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL,
  triggered_by TEXT DEFAULT 'user',
  status TEXT DEFAULT 'Running',
  started_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT,
  documents_included TEXT
);

CREATE TABLE IF NOT EXISTS analysis_findings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_run_id INTEGER NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  finding_type TEXT NOT NULL,
  title TEXT NOT NULL,
  narrative TEXT NOT NULL,
  priority_rank INTEGER,
  relevant_service_line TEXT,
  supporting_data TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS app_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  level TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  document_id INTEGER,
  document_name TEXT,
  provider TEXT,
  model TEXT,
  purpose TEXT,
  status_code INTEGER,
  duration_ms INTEGER,
  detail TEXT
);

INSERT OR IGNORE INTO themes (name, is_system) VALUES
  ('Indigenization', 1),
  ('Digital Transformation', 1),
  ('Financial Sustainability', 1),
  ('Research Excellence', 1),
  ('Student Success', 1),
  ('Sustainability & Climate', 1),
  ('Enrolment Management', 1),
  ('Internationalization', 1),
  ('People & Culture', 1);
`
