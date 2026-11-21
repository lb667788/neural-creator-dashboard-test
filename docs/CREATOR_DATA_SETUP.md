# Creator Data (manual-only)

This module is intentionally **not connected to Douyin**. It does not scrape, call platform APIs, simulate login, or automatically collect data. The user manually enters account and video metrics; Cloudflare D1 stores snapshots for history.

## Required Cloudflare secret

1. Open Cloudflare Dashboard → Workers & Pages → `neural-creator-dashboard-test`.
2. Open Settings → Variables and Secrets (or Bindings, depending on UI).
3. Add a **Secret** named `CREATOR_DATA_API_TOKEN`.
4. Generate a random token in the Creator Data page, copy it, paste it as the Cloudflare Secret value, and save.
5. Wait for deployment/redeployment if Cloudflare prompts for it.
6. Paste the same token into the Creator Data page and press Save.

Never put this token in source code, commit it, or share it. The UI stores it in this browser's local storage only.

## API

Cloudflare Pages route: `/api/creator`. Every request requires `Authorization: Bearer <token>`.

Supported `action` values:
- `accounts` (GET): account list with latest metrics
- `account` (POST): create account
- `account_snapshot` (POST): save account metrics
- `account_history` (GET, `account_id`): account snapshots
- `videos` (GET, optional `account_id`): videos
- `video` (POST): create video record
- `video_snapshot` (POST): save video metrics
- `video_history` (GET, `video_id`): video snapshots
- `import_record` (POST): record a manual entry note

All records use a fixed single-owner scope (`primary`) for this private prototype. Before allowing other users or making the site multi-user, replace this with authenticated user identities and per-user ownership enforcement.

## D1

Uses the existing five tables: `creator_accounts`, `creator_account_snapshots`, `creator_videos`, `creator_video_snapshots`, `creator_data_imports`. Data source is `manual`.
