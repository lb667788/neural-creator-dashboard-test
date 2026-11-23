-- Add optional retention funnel and viewing quality metrics.
ALTER TABLE creator_video_snapshots ADD COLUMN cover_ctr REAL;
ALTER TABLE creator_video_snapshots ADD COLUMN two_sec_exit_rate REAL;
ALTER TABLE creator_video_snapshots ADD COLUMN three_sec_retention REAL;
ALTER TABLE creator_video_snapshots ADD COLUMN five_sec_retention REAL;
ALTER TABLE creator_video_snapshots ADD COLUMN avg_watch_seconds REAL;
ALTER TABLE creator_video_snapshots ADD COLUMN completion_rate REAL;
ALTER TABLE creator_video_snapshots ADD COLUMN rewatch_rate REAL;
