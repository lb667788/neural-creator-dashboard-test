// Cloudflare Pages Function: private, manual-only creator data API.
// No Douyin requests, crawling, login simulation, or automatic collection.
const OWNER_ID = "primary";
const MAX_BODY = 12000;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

const clean = (value, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
const numberOrNull = (value) => value === "" || value == null ? null : Number.isFinite(Number(value)) && Number(value) >= 0 ? Math.floor(Number(value)) : null;
const id = () => crypto.randomUUID();
const isAuthorized = (request, env) => {
  const token = env.CREATOR_DATA_API_TOKEN;
  return Boolean(token && request.headers.get("Authorization") === "Bearer " + token);
};

export async function onRequest({ request, env }) {
  if (!env.DB) return json({ error: "D1 数据库尚未绑定（DB）。" }, 503);
  if (!isAuthorized(request, env)) return json({ error: "需要有效的数据管理令牌。" }, 401);

  const url = new URL(request.url);
  const action = clean(url.searchParams.get("action"), 40);
  let body = {};
  if (request.method === "POST") {
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY) return json({ error: "请求内容过大。" }, 413);
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return json({ error: "请求格式无效。" }, 400);
    }
  }

  try {
    if (request.method === "GET" && action === "accounts") {
      const { results } = await env.DB.prepare(
        "SELECT a.*, (SELECT s.followers FROM creator_account_snapshots s WHERE s.account_id=a.id ORDER BY s.captured_at DESC LIMIT 1) AS followers, (SELECT s.total_likes FROM creator_account_snapshots s WHERE s.account_id=a.id ORDER BY s.captured_at DESC LIMIT 1) AS total_likes, (SELECT s.total_works FROM creator_account_snapshots s WHERE s.account_id=a.id ORDER BY s.captured_at DESC LIMIT 1) AS total_works FROM creator_accounts a WHERE a.owner_id=? AND a.status='active' ORDER BY a.created_at DESC"
      ).bind(OWNER_ID).all();
      return json({ accounts: results || [] });
    }

    if (request.method === "POST" && action === "account") {
      const name = clean(body.display_name, 120);
      if (!name) return json({ error: "账号名称不能为空。" }, 400);
      const accountId = id();
      await env.DB.prepare(
        "INSERT INTO creator_accounts (id, owner_id, platform, platform_account_id, display_name, avatar_url, profile_url, bio) VALUES (?, ?, 'douyin', ?, ?, ?, ?, ?)"
      ).bind(accountId, OWNER_ID, clean(body.platform_account_id, 120) || null, name, clean(body.avatar_url, 1000) || null, clean(body.profile_url, 1000) || null, clean(body.bio, 1000) || null).run();
      return json({ ok: true, account_id: accountId });
    }

    if (request.method === "POST" && action === "account_snapshot") {
      const accountId = clean(body.account_id, 80);
      const capturedAt = clean(body.captured_at, 40) || new Date().toISOString();
      const account = await env.DB.prepare("SELECT id FROM creator_accounts WHERE id=? AND owner_id=?").bind(accountId, OWNER_ID).first();
      if (!account) return json({ error: "账号不存在。" }, 404);
      const snapshotId = id();
      await env.DB.prepare(
        "INSERT INTO creator_account_snapshots (id, owner_id, account_id, captured_at, followers, following, total_likes, total_works, total_views, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')"
      ).bind(snapshotId, OWNER_ID, accountId, capturedAt, numberOrNull(body.followers), numberOrNull(body.following), numberOrNull(body.total_likes), numberOrNull(body.total_works), numberOrNull(body.total_views)).run();
      return json({ ok: true, snapshot_id: snapshotId });
    }

    if (request.method === "GET" && action === "videos") {
      const accountId = clean(url.searchParams.get("account_id"), 80);
      const query = accountId
        ? env.DB.prepare("SELECT v.*, (SELECT s.views FROM creator_video_snapshots s WHERE s.video_id=v.id ORDER BY s.captured_at DESC LIMIT 1) AS latest_views, (SELECT s.likes FROM creator_video_snapshots s WHERE s.video_id=v.id ORDER BY s.captured_at DESC LIMIT 1) AS latest_likes FROM creator_videos v WHERE v.owner_id=? AND v.account_id=? ORDER BY v.published_at DESC").bind(OWNER_ID, accountId)
        : env.DB.prepare("SELECT * FROM creator_videos WHERE owner_id=? ORDER BY published_at DESC").bind(OWNER_ID);
      const { results } = await query.all();
      return json({ videos: results || [] });
    }

    if (request.method === "POST" && action === "video") {
      const accountId = clean(body.account_id, 80);
      const title = clean(body.title, 300);
      if (!accountId || !title) return json({ error: "必须提供账号和作品标题。" }, 400);
      const account = await env.DB.prepare("SELECT id FROM creator_accounts WHERE id=? AND owner_id=?").bind(accountId, OWNER_ID).first();
      if (!account) return json({ error: "账号不存在。" }, 404);
      const videoId = id();
      await env.DB.prepare(
        "INSERT INTO creator_videos (id, owner_id, account_id, platform_video_id, title, description, cover_url, share_url, published_at, duration_seconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(videoId, OWNER_ID, accountId, clean(body.platform_video_id, 120) || null, title, clean(body.description, 2000) || null, clean(body.cover_url, 1000) || null, clean(body.share_url, 1000) || null, clean(body.published_at, 40) || null, numberOrNull(body.duration_seconds)).run();
      return json({ ok: true, video_id: videoId });
    }

    if (request.method === "POST" && action === "video_snapshot") {
      const videoId = clean(body.video_id, 80);
      const capturedAt = clean(body.captured_at, 40) || new Date().toISOString();
      const video = await env.DB.prepare("SELECT id FROM creator_videos WHERE id=? AND owner_id=?").bind(videoId, OWNER_ID).first();
      if (!video) return json({ error: "作品不存在。" }, 404);
      const snapshotId = id();
      await env.DB.prepare(
        "INSERT INTO creator_video_snapshots (id, owner_id, video_id, captured_at, views, likes, comments, shares, favorites, followers_gained, cover_ctr, two_sec_exit_rate, three_sec_retention, five_sec_retention, avg_watch_seconds, completion_rate, rewatch_rate, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')"
      ).bind(snapshotId, OWNER_ID, videoId, capturedAt, numberOrNull(body.views), numberOrNull(body.likes), numberOrNull(body.comments), numberOrNull(body.shares), numberOrNull(body.favorites), numberOrNull(body.followers_gained), numberOrNull(body.cover_ctr), numberOrNull(body.two_sec_exit_rate), numberOrNull(body.three_sec_retention), numberOrNull(body.five_sec_retention), numberOrNull(body.avg_watch_seconds), numberOrNull(body.completion_rate), numberOrNull(body.rewatch_rate)).run();
      return json({ ok: true, snapshot_id: snapshotId });
    }

    if (request.method === "GET" && action === "account_history") {
      const accountId = clean(url.searchParams.get("account_id"), 80);
      const { results } = await env.DB.prepare("SELECT * FROM creator_account_snapshots WHERE owner_id=? AND account_id=? ORDER BY captured_at DESC LIMIT 365").bind(OWNER_ID, accountId).all();
      return json({ history: results || [] });
    }

    if (request.method === "GET" && action === "video_history") {
      const videoId = clean(url.searchParams.get("video_id"), 80);
      const { results } = await env.DB.prepare("SELECT * FROM creator_video_snapshots WHERE owner_id=? AND video_id=? ORDER BY captured_at DESC LIMIT 365").bind(OWNER_ID, videoId).all();
      return json({ history: results || [] });
    }

    if (request.method === "GET" && action === "latest_review") {
      const videoId = clean(url.searchParams.get("video_id"), 80);
      const video = await env.DB.prepare("SELECT id FROM creator_videos WHERE id=? AND owner_id=?").bind(videoId, OWNER_ID).first();
      if (!video) return json({ error: "作品不存在。" }, 404);
      const review = await env.DB.prepare("SELECT id, report_text, generated_at FROM creator_ai_reviews WHERE owner_id=? AND video_id=? ORDER BY generated_at DESC LIMIT 1").bind(OWNER_ID, videoId).first();
      return json({ review: review || null });
    }

    if (request.method === "POST" && action === "review") {
      if (!env.DEEPSEEK_API_KEY) return json({ error: "服务端尚未配置 DeepSeek API Key。" }, 503);
      const videoId = clean(body.video_id, 80);
      const video = await env.DB.prepare("SELECT v.*, a.display_name AS account_name FROM creator_videos v JOIN creator_accounts a ON a.id=v.account_id WHERE v.id=? AND v.owner_id=?").bind(videoId, OWNER_ID).first();
      if (!video) return json({ error: "作品不存在。" }, 404);
      const [snapshots, history, accountHistory] = await Promise.all([
        env.DB.prepare("SELECT captured_at, views, likes, comments, shares, favorites, followers_gained, cover_ctr, two_sec_exit_rate, three_sec_retention, five_sec_retention, avg_watch_seconds, completion_rate, rewatch_rate FROM creator_video_snapshots WHERE owner_id=? AND video_id=? ORDER BY captured_at DESC LIMIT 20").bind(OWNER_ID, videoId).all(),
        env.DB.prepare("SELECT v.title, v.description, v.published_at, (SELECT s.views FROM creator_video_snapshots s WHERE s.video_id=v.id ORDER BY s.captured_at DESC LIMIT 1) AS views, (SELECT s.likes FROM creator_video_snapshots s WHERE s.video_id=v.id ORDER BY s.captured_at DESC LIMIT 1) AS likes, (SELECT s.comments FROM creator_video_snapshots s WHERE s.video_id=v.id ORDER BY s.captured_at DESC LIMIT 1) AS comments, (SELECT s.shares FROM creator_video_snapshots s WHERE s.video_id=v.id ORDER BY s.captured_at DESC LIMIT 1) AS shares, (SELECT s.favorites FROM creator_video_snapshots s WHERE s.video_id=v.id ORDER BY s.captured_at DESC LIMIT 1) AS favorites, (SELECT s.followers_gained FROM creator_video_snapshots s WHERE s.video_id=v.id ORDER BY s.captured_at DESC LIMIT 1) AS followers_gained, (SELECT s.cover_ctr FROM creator_video_snapshots s WHERE s.video_id=v.id ORDER BY s.captured_at DESC LIMIT 1) AS cover_ctr, (SELECT s.two_sec_exit_rate FROM creator_video_snapshots s WHERE s.video_id=v.id ORDER BY s.captured_at DESC LIMIT 1) AS two_sec_exit_rate, (SELECT s.three_sec_retention FROM creator_video_snapshots s WHERE s.video_id=v.id ORDER BY s.captured_at DESC LIMIT 1) AS three_sec_retention, (SELECT s.five_sec_retention FROM creator_video_snapshots s WHERE s.video_id=v.id ORDER BY s.captured_at DESC LIMIT 1) AS five_sec_retention, (SELECT s.avg_watch_seconds FROM creator_video_snapshots s WHERE s.video_id=v.id ORDER BY s.captured_at DESC LIMIT 1) AS avg_watch_seconds, (SELECT s.completion_rate FROM creator_video_snapshots s WHERE s.video_id=v.id ORDER BY s.captured_at DESC LIMIT 1) AS completion_rate, (SELECT s.rewatch_rate FROM creator_video_snapshots s WHERE s.video_id=v.id ORDER BY s.captured_at DESC LIMIT 1) AS rewatch_rate, (SELECT s.captured_at FROM creator_video_snapshots s WHERE s.video_id=v.id ORDER BY s.captured_at DESC LIMIT 1) AS captured_at FROM creator_videos v WHERE v.owner_id=? AND v.account_id=? ORDER BY COALESCE(v.published_at,v.created_at) DESC LIMIT 40").bind(OWNER_ID, video.account_id).all(),
        env.DB.prepare("SELECT captured_at, followers, following, total_likes, total_works, total_views FROM creator_account_snapshots WHERE owner_id=? AND account_id=? ORDER BY captured_at DESC LIMIT 20").bind(OWNER_ID, video.account_id).all()
      ]);
      const payload = {
        account: video.account_name,
        current_video: { title: video.title, description: video.description, published_at: video.published_at, duration_seconds: video.duration_seconds, share_url: video.share_url, snapshots: snapshots.results || [] },
        historical_videos: history.results || [],
        account_history: accountHistory.results || []
      };
      const systemPrompt = "你是专业的抖音短视频内容策略与数据诊断导师。只根据用户手动录入的真实数据分析，不编造未提供的指标或视频内容。抖音推荐机制没有公开固定权重或流量池公式，不能声称知道算法内部规则，不能保证推流或爆款。把数据作为用户行为反馈线索，而非算法权重。优先诊断漏斗：封面/标题点击率(CTR)→开头2秒流失率→3秒、5秒留存→平均播放时长及平均播放占视频时长→整体完播率→回看率→互动率(赞评分享收藏)/播放→涨粉转化。数据缺失要标为未提供，不得用点赞/播放代替点击率或留存率。比较同账号作品时考虑作品时长、发布时间、采集时间、样本量，优先以用户自身历史基线判断；任何行业参考值都要标明非官方、非普适。输出具体报告：1)本期关键数据及计算出的比率；2)漏斗定位（弱项及证据）；3)亮点；4)问题和原因，标明推测；5)下一期改进方案：选题、封面视觉/文字、标题、前三秒画面与台词、节奏/结构、结尾互动；6)一个仅改变单变量的A/B测试；7)下一期验证指标。新账号/无历史样本要先建立基线，不要过度下结论。建议结合本账号数据和视频描述。";
      const upstream = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Authorization": "Bearer " + env.DEEPSEEK_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "deepseek-chat", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "请复盘以下账号和作品数据，并给出下一期优化方案：\\n" + JSON.stringify(payload) }], temperature: 0.4, max_tokens: 2400 })
      });
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return json({ error: upstream.status === 401 ? "DeepSeek API Key 无效，请检查 Cloudflare Secret。" : "DeepSeek 暂时无法完成复盘，请稍后重试。" }, 502);
      const report = data?.choices?.[0]?.message?.content;
      if (typeof report !== "string" || !report.trim()) return json({ error: "DeepSeek 返回了空复盘报告。" }, 502);
      const reviewId = id();
      const generatedAt = new Date().toISOString();
      await env.DB.prepare("INSERT INTO creator_ai_reviews (id, owner_id, account_id, video_id, report_text, generated_at, model) VALUES (?, ?, ?, ?, ?, ?, 'deepseek-chat')").bind(reviewId, OWNER_ID, video.account_id, videoId, report.trim(), generatedAt).run();
      return json({ ok: true, review: { id: reviewId, report_text: report.trim(), generated_at: generatedAt } });
    }

    if (request.method === "POST" && action === "import_record") {
      const accountId = clean(body.account_id, 80);
      const account = await env.DB.prepare("SELECT id FROM creator_accounts WHERE id=? AND owner_id=?").bind(accountId, OWNER_ID).first();
      if (!account) return json({ error: "账号不存在。" }, 404);
      const importId = id();
      await env.DB.prepare("INSERT INTO creator_data_imports (id, owner_id, account_id, file_name, file_type, status, rows_total, rows_imported, completed_at) VALUES (?, ?, ?, ?, 'manual', 'completed', 0, 0, datetime('now'))").bind(importId, OWNER_ID, accountId, clean(body.note, 250) || "手动录入记录").run();
      return json({ ok: true, import_id: importId });
    }

    return json({ error: "未知操作或不支持的请求方法。" }, 400);
  } catch (error) {
    // Avoid exposing database internals or user-provided values in production errors.
    return json({ error: "数据保存失败，请检查重复记录或字段格式。" }, 500);
  }
}
