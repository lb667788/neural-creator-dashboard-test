import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Icon} from './icons';
function CreatorPageHead({zh, en, sub, subEn}) {
  return <header className="page-head"><div><p className="eyebrow">{en.toUpperCase()} <span>{zh}</span></p><h1>{sub}</h1><p className="page-sub">{subEn}</p></div></header>;
}

const API = '/api/creator';
const STORAGE = 'neural-creator-data-token-v1';
const nfmt = v => v == null ? '—' : Number(v).toLocaleString('zh-CN');
const emptyAccount = {display_name:'', platform_account_id:'', profile_url:'', avatar_url:'', bio:''};
const emptySnapshot = {followers:'', following:'', total_likes:'', total_works:'', total_views:''};
const emptyVideo = {title:'', description:'', share_url:'', published_at:'', duration_seconds:''};
const emptyVideoSnapshot = {views:'', likes:'', comments:'', shares:'', favorites:'', followers_gained:'', cover_ctr:'', two_sec_exit_rate:'', three_sec_retention:'', five_sec_retention:'', avg_watch_seconds:'', completion_rate:'', rewatch_rate:''};

export function CreatorData() {
  const [token, setToken] = useState(() => { try { return localStorage.getItem(STORAGE) || ''; } catch { return ''; } });
  const [tokenDraft, setTokenDraft] = useState(token);
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState('');
  const [videos, setVideos] = useState([]);
  const [accountHistory, setAccountHistory] = useState([]);
  const [videoHistory, setVideoHistory] = useState([]);
  const [review, setReview] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [accountForm, setAccountForm] = useState(emptyAccount);
  const [snapshotForm, setSnapshotForm] = useState(emptySnapshot);
  const [videoForm, setVideoForm] = useState(emptyVideo);
  const [videoSnapshotForm, setVideoSnapshotForm] = useState(emptyVideoSnapshot);
  const [selectedVideo, setSelectedVideo] = useState('');
  const [videoEntryMode, setVideoEntryMode] = useState('new');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const request = useCallback(async (action, method='GET', payload=null, query={}) => {
    const qs = new URLSearchParams({action, ...query});
    const res = await fetch(API + '?' + qs.toString(), {
      method, headers: {'Authorization':'Bearer '+token, ...(method === 'POST' ? {'Content-Type':'application/json'} : {})},
      ...(method === 'POST' ? {body: JSON.stringify(payload || {})} : {})
    });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(data.error || '接口请求失败');
    return data;
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const result = await request('accounts');
      const list = result.accounts || [];
      setAccounts(list);
      const current = accountId && list.some(a=>a.id===accountId) ? accountId : list[0]?.id || '';
      setAccountId(current);
      if (current) {
        const [v, h] = await Promise.all([request('videos','GET',null,{account_id:current}), request('account_history','GET',null,{account_id:current})]);
        setVideos(v.videos || []); setAccountHistory(h.history || []);
      } else { setVideos([]); setAccountHistory([]); }
      if (selectedVideo) {
        const vh = await request('video_history','GET',null,{video_id:selectedVideo});
        setVideoHistory(vh.history || []);
      }
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }, [token, request, accountId, selectedVideo]);

  useEffect(() => { if(token) refresh(); }, [token]); // token changes refresh
  useEffect(() => {
    if (!token || !accountId) return;
    let active=true;
    Promise.all([request('videos','GET',null,{account_id:accountId}), request('account_history','GET',null,{account_id:accountId})])
      .then(([v,h])=>{if(active){setVideos(v.videos||[]);setAccountHistory(h.history||[]);}})
      .catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  }, [accountId, token, request]);
  useEffect(() => {
    if (!token || !selectedVideo) {setVideoHistory([]); setReview(null); return;}
    request('video_history','GET',null,{video_id:selectedVideo}).then(r=>setVideoHistory(r.history||[])).catch(e=>setError(e.message));
    request('latest_review','GET',null,{video_id:selectedVideo}).then(r=>setReview(r.review||null)).catch(e=>setError(e.message));
  }, [selectedVideo, token, request]);

  const currentAccount = accounts.find(a=>a.id===accountId);
  const currentVideo = videos.find(v=>v.id===selectedVideo);
  const latest = accountHistory[0] || {};
  const latestVideo = videoHistory[0] || {};
  const generateToken = () => { const bytes=new Uint8Array(32); window.crypto.getRandomValues(bytes); const value=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''); setTokenDraft(value); setMessage('已生成随机令牌，请复制并添加到 Cloudflare Secret 后再保存'); setError(''); };
  const copyToken = async () => { try { await navigator.clipboard.writeText(tokenDraft); setMessage('令牌已复制'); setError(''); } catch { setError('复制失败，请长按输入框手动复制'); } };
  const saveToken = () => {
    const value = tokenDraft.trim();
    try { localStorage.setItem(STORAGE, value); } catch {}
    setToken(value); setMessage(value ? '令牌已保存到本浏览器' : '令牌已清除'); setError('');
  };
  const submit = async (action, payload, after) => {
    setLoading(true); setError(''); setMessage('');
    try { await request(action, 'POST', payload); setMessage('保存成功'); if(after) after(); await refresh(); }
    catch(e){setError(e.message);}
    finally {setLoading(false);}
  };
  const addAccount = async e => {e.preventDefault(); setLoading(true); setError(''); setMessage(''); try { const result=await request('account','POST',accountForm); const list=await request('accounts'); setAccounts(list.accounts||[]); setAccountId(result.account_id||''); setAccountForm(emptyAccount); setMessage('账号保存成功'); } catch(err) {setError(err.message);} finally {setLoading(false);} };
  const addAccountSnapshot = e => {e.preventDefault(); submit('account_snapshot', {...snapshotForm, account_id:accountId}, ()=>setSnapshotForm(emptySnapshot));};
  const runReviewFor = async videoId => {
    if (!videoId) return;
    setReviewLoading(true); setError('');
    try {
      const result = await request('review','POST',{video_id:videoId});
      setReview(result.review);
      setMessage('DeepSeek 已完成分析，作品数据与分析报告均已自动归档');
    } catch(e) {
      setError('作品和数据已保存，但自动分析未完成：' + e.message + '。可在作品详情中重新分析。');
    } finally { setReviewLoading(false); }
  };
  const runReview = () => runReviewFor(selectedVideo);
  const addVideoAndAnalyze = async e => {
    e.preventDefault();
    if (!accountId) return;
    setLoading(true); setError(''); setMessage('');
    try {
      let videoId = selectedVideo;
      if (videoEntryMode === 'new') {
        const created = await request('video','POST',{...videoForm, account_id:accountId});
        videoId = created.video_id;
      }
      if (!videoId) throw new Error('请先选择一条已有作品，或切换为新建作品。');
      await request('video_snapshot','POST',{...videoSnapshotForm, video_id:videoId});
      setSelectedVideo(videoId);
      setVideoForm(emptyVideo);
      setVideoSnapshotForm(emptyVideoSnapshot);
      setMessage('视频与表现数据已保存，DeepSeek 正在分析…');
      const [v] = await Promise.all([request('videos','GET',null,{account_id:accountId})]);
      setVideos(v.videos || []);
      await runReviewFor(videoId);
      const vh = await request('video_history','GET',null,{video_id:videoId});
      setVideoHistory(vh.history || []);
    } catch(err) { setError(err.message); }
    finally { setLoading(false); }
  };
  const setForm = (setter, field, value) => setter(prev=>({...prev,[field]:value}));
  const input = (setter, obj, field, label, type='text', placeholder='') => <label>{label}<input type={type} value={obj[field]} placeholder={placeholder} onChange={e=>setForm(setter,field,e.target.value)} /></label>;
  const historyRows = useMemo(()=>accountHistory.slice(0,12),[accountHistory]);

  return <div className="page page-creator">
    <CreatorPageHead zh="账号数据" en="Creator Data" sub="把每次成长记录下来。" subEn="Manual records, private trends — no platform scraping."/>
    <section className="creator-token glass">
      <div><h3><Icon name="file" size={14}/>私人数据连接 <em>Private access</em></h3><p>数据接口需要你在 Cloudflare 设置访问密钥。密钥仅保存于当前浏览器。</p></div>
      <div className="creator-token-input"><input type="password" autoComplete="off" placeholder="生成或粘贴 CREATOR_DATA_API_TOKEN" value={tokenDraft} onChange={e=>setTokenDraft(e.target.value)}/><button className="pill" type="button" onClick={generateToken}>生成</button><button className="pill" type="button" onClick={copyToken} disabled={!tokenDraft}>复制</button><button className="pill primary" type="button" onClick={saveToken}>保存</button></div>
    </section>
    {!token && <div className="creator-notice glass"><Icon name="info" size={15}/>尚未设置访问令牌。请先在 Cloudflare Pages 添加同名 Secret，之后在此处粘贴对应令牌。</div>}
    {message && <div className="creator-notice glass success"><Icon name="check" size={15}/>{message}</div>}
    {error && <div className="creator-notice glass error"><Icon name="info" size={15}/>{error}</div>}
    <section className="creator-kpis kpi-band glass">
      <div><span>账号 <em>Accounts</em></span><strong>{accounts.length}</strong></div>
      <div><span>粉丝 <em>Followers</em></span><strong>{nfmt(latest.followers)}</strong></div>
      <div><span>累计获赞 <em>Likes</em></span><strong>{nfmt(latest.total_likes)}</strong></div>
      <div><span>作品数 <em>Works</em></span><strong>{nfmt(latest.total_works)}</strong></div>
    </section>
    <div className="creator-grid">
      <section className="glass card creator-card">
        <header><h2>添加账号 <em>Add account</em></h2></header>
        <form className="form" onSubmit={addAccount}>
          {input(setAccountForm,accountForm,'display_name','账号名称 *')}
          {input(setAccountForm,accountForm,'platform_account_id','抖音号 / ID')}
          {input(setAccountForm,accountForm,'profile_url','主页链接','url')}
          {input(setAccountForm,accountForm,'avatar_url','头像链接','url')}
          <label>简介<textarea value={accountForm.bio} onChange={e=>setForm(setAccountForm,'bio',e.target.value)} rows="2"/></label>
          <div className="form-actions"><button className="pill primary" disabled={!token||!accountForm.display_name.trim()||loading}><Icon name="plus" size={14}/>保存账号</button></div>
        </form>
      </section>
      <section className="glass card creator-card">
        <header><h2>每日账号记录 <em>Daily metrics</em></h2></header>
        <div className="creator-select"><label>选择账号 <select value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="">选择账号</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.display_name}</option>)}</select></label></div>
        <form className="form" onSubmit={addAccountSnapshot}>
          <div className="creator-fields">
            {input(setSnapshotForm,snapshotForm,'followers','粉丝数','number')}
            {input(setSnapshotForm,snapshotForm,'following','关注数','number')}
            {input(setSnapshotForm,snapshotForm,'total_likes','累计获赞','number')}
            {input(setSnapshotForm,snapshotForm,'total_works','作品数','number')}
            {input(setSnapshotForm,snapshotForm,'total_views','累计播放','number')}
          </div>
          <div className="form-actions"><button className="pill primary" disabled={!token||!accountId||loading}>保存每日数据</button></div>
        </form>
      </section>
      <section className="glass card creator-card creator-analysis-workspace">
        <header><h2>视频分析与记录 <em>Video Analysis & Archive</em></h2><p className="quiet">一次提交，自动分析并保存作品、数据与复盘历史</p></header>
        <form className="form" onSubmit={addVideoAndAnalyze}>
          <div className="creator-select"><label>记录方式 <select value={videoEntryMode} onChange={e=>setVideoEntryMode(e.target.value)}><option value="new">分析新作品</option><option value="existing">更新已有作品数据</option></select></label></div>
          {videoEntryMode === 'new' ? <>
            <div className="creator-fields">
              {input(setVideoForm,videoForm,'title','作品标题 *')}
              {input(setVideoForm,videoForm,'share_url','作品链接（选填）','url','没有链接可留空')}
              {input(setVideoForm,videoForm,'published_at','发布时间','date')}
              {input(setVideoForm,videoForm,'duration_seconds','时长（秒）','number')}
            </div>
            <label>作品内容 / 描述<textarea rows="2" placeholder="简单描述视频主题、内容和表达方式，帮助 DeepSeek 更准确地分析" value={videoForm.description} onChange={e=>setForm(setVideoForm,'description',e.target.value)}/></label>
          </> : <div className="creator-select"><label>选择已有作品 <select value={selectedVideo} onChange={e=>setSelectedVideo(e.target.value)}><option value="">选择作品</option>{videos.map(v=><option key={v.id} value={v.id}>{v.title}</option>)}</select></label></div>}
          <div className="creator-fields">
            {input(setVideoSnapshotForm,videoSnapshotForm,'views','播放量','number')}
            {input(setVideoSnapshotForm,videoSnapshotForm,'likes','点赞','number')}
            {input(setVideoSnapshotForm,videoSnapshotForm,'comments','评论','number')}
            {input(setVideoSnapshotForm,videoSnapshotForm,'shares','分享','number')}
            {input(setVideoSnapshotForm,videoSnapshotForm,'favorites','收藏','number')}
            {input(setVideoSnapshotForm,videoSnapshotForm,'followers_gained','涨粉','number')}
          </div>
          <div className="quiet" style={{marginTop:8}}>观看质量指标（选填 · 从抖音作品数据中手动填写）</div><div className="creator-fields">
{input(setVideoSnapshotForm,videoSnapshotForm,'cover_ctr','封面点击率 (%)','number')}
{input(setVideoSnapshotForm,videoSnapshotForm,'two_sec_exit_rate','2秒跳出率 (%)','number')}
{input(setVideoSnapshotForm,videoSnapshotForm,'three_sec_retention','3秒留存率 (%)','number')}
{input(setVideoSnapshotForm,videoSnapshotForm,'five_sec_retention','5秒留存率 (%)','number')}
{input(setVideoSnapshotForm,videoSnapshotForm,'avg_watch_seconds','平均播放时长 (秒)','number')}
{input(setVideoSnapshotForm,videoSnapshotForm,'completion_rate','整体完播率 (%)','number')}
{input(setVideoSnapshotForm,videoSnapshotForm,'rewatch_rate','回看率 (%)','number')}
</div><div className="form-actions"><button className="pill primary" disabled={!token||!accountId||(videoEntryMode === 'new' && !videoForm.title.trim())||(videoEntryMode === 'existing' && !selectedVideo)||loading||reviewLoading}><Icon name="spark" size={14}/>{loading||reviewLoading ? '正在保存并分析…' : '提交并开始 AI 分析'}</button></div>
        </form>
        {selectedVideo && <div className="creator-inline-review">
          <header><h3>本期 AI 复盘 <em>DeepSeek Review</em></h3><button className="text-btn" type="button" onClick={runReview} disabled={!token||reviewLoading}>{reviewLoading ? '分析中…' : '重新分析'}</button></header>
          {reviewLoading && <div className="empty-line">正在比较本作品与账号历史数据…</div>}
          {!reviewLoading && review?.report_text && <><p className="quiet">最近分析：{String(review.generated_at).replace('T',' ').slice(0,19)} · 已自动归档</p><div className="creator-ai-report" style={{whiteSpace:'pre-wrap',lineHeight:1.8}}>{review.report_text}</div></>}
          {!reviewLoading && !review?.report_text && <div className="empty-line">提交作品和表现数据后，DeepSeek 会自动生成复盘。</div>}
          {videoHistory.length > 0 && <div className="creator-table-wrap"><table><thead><tr><th>记录日期</th><th>播放</th><th>点赞</th><th>评论</th><th>分享</th><th>收藏</th><th>涨粉</th></tr></thead><tbody>{videoHistory.slice(0,10).map(row=><tr key={row.id}><td>{String(row.captured_at).slice(0,10)}</td><td>{nfmt(row.views)}</td><td>{nfmt(row.likes)}</td><td>{nfmt(row.comments)}</td><td>{nfmt(row.shares)}</td><td>{nfmt(row.favorites)}</td><td>{nfmt(row.followers_gained)}</td></tr>)}</tbody></table></div>}
        </div>}
      </section>
    </div>
    <section className="glass card creator-history">
      <header><h2>成长历史 <em>Growth history</em></h2><button className="text-btn" onClick={refresh} disabled={!token||loading}><Icon name="replay" size={14}/>刷新 <em>Refresh</em></button></header>
      {historyRows.length ? <div className="creator-table-wrap"><table><thead><tr><th>日期</th><th>粉丝</th><th>关注</th><th>累计获赞</th><th>作品</th><th>播放</th></tr></thead><tbody>{historyRows.map(row=><tr key={row.id}><td>{String(row.captured_at).slice(0,10)}</td><td>{nfmt(row.followers)}</td><td>{nfmt(row.following)}</td><td>{nfmt(row.total_likes)}</td><td>{nfmt(row.total_works)}</td><td>{nfmt(row.total_views)}</td></tr>)}</tbody></table></div> : <div className="empty-line">录入每日数据后，这里将显示历史快照。 <em>Snapshots appear here</em></div>}
    </section>
    <section className="glass card creator-history">
      <header><h2>作品列表 <em>Video library</em></h2><span className="quiet">{videos.length} 篇作品</span></header>
      {videos.length ? <div className="creator-table-wrap"><table><thead><tr><th>作品标题</th><th>发布时间</th><th>播放</th><th>点赞</th></tr></thead><tbody>{videos.map(v=><tr key={v.id} onClick={()=>setSelectedVideo(v.id)}><td>{v.title}</td><td>{v.published_at||'—'}</td><td>{nfmt(v.latest_views)}</td><td>{nfmt(v.latest_likes)}</td></tr>)}</tbody></table></div> : <div className="empty-line">添加作品后，将会列在这里。 <em>Works appear here</em></div>}
    </section>
  </div>;
}
