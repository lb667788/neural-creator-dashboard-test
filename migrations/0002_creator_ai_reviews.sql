-- Persist DeepSeek creator review reports.
CREATE TABLE IF NOT EXISTS creator_ai_reviews (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  report_text TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'deepseek-chat',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(account_id) REFERENCES creator_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY(video_id) REFERENCES creator_videos(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_creator_ai_reviews_video_date
  ON creator_ai_reviews(owner_id, video_id, generated_at DESC);
