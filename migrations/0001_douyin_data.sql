-- Douyin creator data foundation (Cloudflare D1 / SQLite)
-- Apply with: wrangler d1 execute <DATABASE_NAME> --remote --file=migrations/0001_douyin_data.sql
-- All records are scoped by owner_id. Do not expose these tables through public APIs
-- until an authenticated owner identity has been established.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS creator_accounts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'douyin' CHECK (platform = 'douyin'),
  platform_account_id TEXT,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  profile_url TEXT,
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(owner_id, platform, platform_account_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_accounts_owner
  ON creator_accounts(owner_id, platform, status);

CREATE TABLE IF NOT EXISTS creator_account_snapshots (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  followers INTEGER,
  following INTEGER,
  total_likes INTEGER,
  total_works INTEGER,
  total_views INTEGER,
  source TEXT NOT NULL CHECK (source IN ('manual', 'csv_import', 'official_api')),
  import_id TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(account_id) REFERENCES creator_accounts(id) ON DELETE CASCADE,
  UNIQUE(account_id, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_account_snapshots_owner_date
  ON creator_account_snapshots(owner_id, account_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS creator_videos (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  platform_video_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  share_url TEXT,
  published_at TEXT,
  duration_seconds INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(account_id) REFERENCES creator_accounts(id) ON DELETE CASCADE,
  UNIQUE(account_id, platform_video_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_videos_owner_date
  ON creator_videos(owner_id, account_id, published_at DESC);

CREATE TABLE IF NOT EXISTS creator_video_snapshots (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  captured_at TEXT NOT NULL,
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  favorites INTEGER,
  followers_gained INTEGER,
  source TEXT NOT NULL CHECK (source IN ('manual', 'csv_import', 'official_api')),
  import_id TEXT,
  raw_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(video_id) REFERENCES creator_videos(id) ON DELETE CASCADE,
  UNIQUE(video_id, captured_at)
);

CREATE INDEX IF NOT EXISTS idx_video_snapshots_owner_date
  ON creator_video_snapshots(owner_id, video_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS creator_data_imports (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'xlsx', 'manual', 'official_api')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY(account_id) REFERENCES creator_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_creator_imports_owner_date
  ON creator_data_imports(owner_id, created_at DESC);
