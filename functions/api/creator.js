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
        "INSERT INTO creator_video_snapshots (id, owner_id, video_id, captured_at, views, likes, comments, shares, favorites, followers_gained, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')"
      ).bind(snapshotId, OWNER_ID, videoId, capturedAt, numberOrNull(body.views), numberOrNull(body.likes), numberOrNull(body.comments), numberOrNull(body.shares), numberOrNull(body.favorites), numberOrNull(body.followers_gained)).run();
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
        env.DB.prepare("SELECT captured_at, views, likes, comments, shares, favorites, followers_gained FROM creator_video_snapshots WHERE owner_id=? AND video_id=? ORDER BY captured_at DESC LIMIT 20").bind(OWNER_ID, videoId).all(),
        env.DB.prepare("SELECT v.title, v.description, v.published_at, s.views, s.likes, s.comments, s.shares, s.favorites, s.followers_gained, s.captured_at FROM creator_videos v LEFT JOIN creator_video_snapshots s ON s.video_id=v.id WHERE v.owner_id=? AND v.account_id=? ORDER BY COALESCE(s.captured_at,v.published_at) DESC LIMIT 40").bind(OWNER_ID, video.account_id).all(),
        env.DB.prepare("SELECT captured_at, followers, following, total_likes, total_works, total_views FROM creator_account_snapshots WHERE owner_id=? AND account_id=? ORDER BY captured_at DESC LIMIT 20").bind(OWNER_ID, video.account_id).all()
      ]);
      const payload = {
        account: video.account_name,
        current_video: { title: video.title, description: video.description, published_at: video.published_at, duration_seconds: video.duration_seconds, share_url: video.share_url, snapshots: snapshots.results || [] },
        historical_videos: history.results || [],
        account_history: accountHistory.results || []
      };
      const systemPrompt = "你是专业的中文短视频内容策略分析师。请基于用户提供的真实手动录入数据做复盘。严格区分数据事实与推测；不要把相关性说成因果，不要虚构完播率、点击率或视频内容细节。数据不足时明确指出，并告诉用户补充什么。将作品当前数据与该账号历史作品比较，考虑发布时间、数据采集时点和样本量。输出清晰、具体、可执行的中文报告，包含：一、本期数据表现（列出关键指标及可计算的互动率/涨粉转化率）；二、与账号历史作品的比较；三、表现亮点；四、问题与可能原因（标明推测）；五、下一期建议（选题方向、前三秒开场钩子、内容结构、标题示例、行动引导）；六、下次需要重点观察的指标。建议必须结合本账号数据，避免空泛套路。";
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
