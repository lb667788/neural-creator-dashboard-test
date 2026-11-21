import React, {useEffect, useMemo, useRef, useState} from 'react';
import {KINDS, CONTENT, MODULES, neighbors, latent, LINK_EN} from './graph';
import {Icon} from './icons';
import {Analysis, Count} from './Analysis';
import {snapshot} from '../data';
import {posts} from './works';
import {T} from './theme';
import {askLearningTutor} from './ai';

const fmt = v => v == null ? '—' : Number(v).toLocaleString('zh-CN');

export function PageHead({zh, en, sub, subEn, children}) {
  return <header className="page-head">
    <div><p className="eyebrow">{en.toUpperCase()} <span>{zh}</span></p><h1>{sub}</h1><p className="page-sub">{subEn}</p></div>
    {children && <div className="page-head-actions">{children}</div>}
  </header>;
}

// —— 作品库 Works ——
export function Library({graph, selected, setSelected, onGo, onAction}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('date');
  const rate = p => p.views ? p.saves / p.views : -1;
  const rows = posts.filter(p => p.title.toLowerCase().includes(q.toLowerCase())).sort((a, b) =>
    sort === 'date' ? b.date.localeCompare(a.date) : sort === 'rate' ? rate(b) - rate(a) : (b[sort] ?? -1) - (a[sort] ?? -1));
  const order = [...posts].sort((a, b) => a.date.localeCompare(b.date));
  const node = graph.index.get('post:' + selected) || graph.index.get('post:' + rows[0]?.id);
  const total = posts.reduce((s, p) => s + p.views, 0);
  const max = Math.max(...posts.map(p => p.views));
  const kpis = [['已发布', 'Published', posts.length], ['账号粉丝', 'Followers', snapshot.followers], ['累计观看', 'Total views', total], ['已知涨粉', 'Known follows', posts.reduce((s, p) => s + (p.follows ?? 0), 0)]];
  return <div className="page page-library">
    <PageHead zh="作品库" en="Works" sub="每一篇，都留下回响。" subEn="Every piece leaves an echo — metrics and links side by side."/>
    <section className="kpi-band glass">{kpis.map(([zh, en, v]) => <div key={zh}><span>{zh} <em>{en}</em></span><strong><Count value={v}/></strong></div>)}</section>
    <div className="library-layout">
      <section className="works-col">
        <div className="toolbar-row">
          <label className="search"><Icon name="search" size={15}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="搜索作品… Search works" aria-label="搜索作品"/></label>
          <div className="seg" role="group" aria-label="排序">{[['date', '最新', 'Latest'], ['views', '观看', 'Views'], ['rate', '收藏率', 'Save rate'], ['follows', '涨粉', 'Follows']].map(([k, zh, en]) => <button key={k} className={sort === k ? 'active' : ''} onClick={() => setSort(k)}>{zh}<em>{en}</em></button>)}</div>
        </div>
        <div className="works-grid">{rows.map((p, i) => {
          const n = graph.index.get('post:' + p.id);
          const on = node?.id === n.id;
          return <button key={p.id} className={`work-card ${on ? 'active' : ''}`} onClick={() => setSelected(p.id)} style={{animationDelay: i * 60 + 'ms'}}>
            <span className="wc-cover">{n.cover ? <img src={n.cover} alt="" loading="lazy"/> : <span className="wc-fallback" style={{'--h': (order.indexOf(p) * 47) % 360}}><b>{p.title}</b><small>{n.media === 'video' ? '视频 · Video' : '图文 · Post'}</small></span>}<span className="wc-index">#{String(order.indexOf(p) + 1).padStart(2, '0')}</span></span>
            <span className="wc-body">
              <span className="wc-date">{p.date.slice(0, 10)} · {n.tags.length} topics</span>
              <span className="wc-title">{p.title}</span>
              <span className="wc-bar"><i style={{'--w': p.views / max}}/></span>
              <span className="wc-stats"><span>观看<em>Views</em><b>{fmt(p.views)}</b></span><span>收藏<em>Saves</em><b>{fmt(p.saves)}</b></span><span>⇄<em>Mutual</em><b>{n.mutual}</b></span></span>
            </span>
          </button>;
        })}</div>
        {!rows.length && <div className="empty"><Icon name="search" size={30}/><p>没有找到这篇作品 <em>No match</em></p><button className="pill" onClick={() => setQ('')}>清空搜索 <em>Clear</em></button></div>}
        <p className="source-line"><Icon name="info" size={13}/>{posts.length} 篇作品均为{snapshot.source}；「—」表示未提供 <em>Not provided</em>。</p>
      </section>
      {node && <aside className="library-analysis" key={node.id}><Analysis graph={graph} node={node} module={MODULES[0]} onGo={onGo} onAction={onAction} onClose={() => setSelected(null)}/></aside>}
    </div>
  </div>;
}

// —— 创作台 Drafts ——
function MiniGraph({graph, node}) {
  const nb = neighbors(graph, node.id);
  const all = [...nb.mutual.map(x => ({...x, dir: 'both'})), ...nb.out.map(x => ({...x, dir: 'out'})), ...nb.back.map(x => ({...x, dir: 'in'}))].slice(0, 16);
  const R = 92, C = 120;
  return <svg className="mini-graph" viewBox="0 0 240 240" role="img" aria-label={`${all.length} 条连接`}>
    <defs><radialGradient id="mg-core"><stop offset="0" stopColor={T.mini.glow0}/><stop offset=".5" stopColor={T.mini.core}/><stop offset="1" stopColor={T.mini.core} stopOpacity="0"/></radialGradient></defs>
    {all.map((x, i) => {
      const a = i / Math.max(all.length, 1) * Math.PI * 2 - Math.PI / 2, n = graph.index.get(x.id);
      const px = C + Math.cos(a) * R, py = C + Math.sin(a) * R;
      return <g key={x.id} style={{'--d': i * 60 + 'ms'}} className={`mg-link dir-${x.dir}`}>
        <line x1={C} y1={C} x2={px} y2={py} stroke={x.dir === 'both' ? T.mini.mutual : KINDS[n.kind].color}/>
        <circle cx={px} cy={py} r={n.kind === 'ghost' ? 3.5 : 4.5} fill={n.kind === 'ghost' ? 'none' : KINDS[n.kind].color} stroke={KINDS[n.kind].color} strokeDasharray={n.kind === 'ghost' ? '2 2' : undefined}/>
        {x.dir !== 'in' && <circle r="2.2" fill={T.mini.pulseOut} className="mg-pulse"><animateMotion dur={2 + i % 3 * .4 + 's'} repeatCount="indefinite" path={`M${C},${C} L${px},${py}`}/></circle>}
        {x.dir !== 'out' && <circle r="2" fill={T.mini.pulseIn} className="mg-pulse"><animateMotion dur={2.4 + i % 2 * .5 + 's'} repeatCount="indefinite" path={`M${px},${py} L${C},${C}`}/></circle>}
      </g>;
    })}
    <circle cx={C} cy={C} r="26" fill="url(#mg-core)"/>
    <circle cx={C} cy={C} r="8" fill={T.mini.dot}/>
  </svg>;
}

export function Drafts({graph, drafts, setDrafts, active, setActive, onNew, onDelete, onGo}) {
  const draft = drafts.find(d => d.id === active) || drafts[0];
  const area = useRef(null);
  const [suggest, setSuggest] = useState(null);
  const [pick, setPick] = useState(0);
  const change = (key, value) => setDrafts(drafts.map(d => d.id === draft.id ? {...d, [key]: value} : d));
  const titles = useMemo(() => graph.nodes.filter(n => CONTENT.has(n.kind) && n.id !== 'draft:' + draft?.id).map(n => ({id: n.id, title: n.path?.split('/').pop().replace(/\.md$/, '') || n.title, short: n.short || n.title, kind: n.kind})), [graph, draft?.id]);
  const check = el => {
    const before = el.value.slice(0, el.selectionStart);
    const m = before.match(/\[\[([^\]\n]*)$/);
    if (!m) { setSuggest(null); return; }
    const q = m[1].toLowerCase();
    const list = titles.filter(t => t.title.toLowerCase().includes(q) || t.short.toLowerCase().includes(q)).slice(0, 7);
    setSuggest({q: m[1], start: el.selectionStart - m[1].length, list}); setPick(0);
  };
  const insert = t => {
    const el = area.current, s = suggest.start, e = el.selectionStart;
    const value = el.value.slice(0, s) + t.title + ']]' + el.value.slice(e).replace(/^\]\]/, '');
    change('body', value); setSuggest(null);
    requestAnimationFrame(() => { el.focus(); const pos = s + t.title.length + 2; el.setSelectionRange(pos, pos); });
  };
  const node = draft && graph.index.get('draft:' + draft.id);
  const nb = node ? neighbors(graph, node.id) : null;
  const wiki = node ? graph.links.filter(l => l.kind === 'wiki' && l.s === node.id).map(l => graph.index.get(l.t)) : [];
  return <div className="page page-drafts">
    <PageHead zh="创作台" en="Drafts" sub="把灵感，写成下一篇。" subEn="Write with [[links]] — every link grows a backlink.">
      <button className="pill primary" onClick={() => onNew()}><Icon name="plus" size={15}/>新建草稿 <em>New draft</em></button>
    </PageHead>
    <div className="drafts-layout">
      <aside className="draft-list glass">
        <h3>我的草稿 <em>My drafts</em><b>{drafts.length}</b></h3>
        {drafts.map(d => <button key={d.id} className={d.id === draft?.id ? 'active' : ''} onClick={() => setActive(d.id)}>
          <i/><span>{d.title || '未命名草稿'}<small>{(d.body || '').length} 字 chars · {graph.index.get('draft:' + d.id)?.deg || 0} 连接 links</small></span>
        </button>)}
        {!drafts.length && <p className="empty-line">还没有草稿 <em>No drafts yet</em></p>}
      </aside>
      {draft ? <section className="editor glass">
        <div className="editor-meta"><span>03-创作台 / 正在写 <em>Writing</em></span><span><Icon name="check" size={13}/>已保存到此浏览器 <em>Saved locally</em></span></div>
        <input className="editor-title" value={draft.title} onChange={e => change('title', e.target.value)} placeholder="给这篇内容一个标题 Title" aria-label="草稿标题"/>
        <div className="editor-area">
          <textarea ref={area} value={draft.body} aria-label="草稿正文" placeholder="开始写… 输入 [[ 链接到其他笔记 Type [[ to link a note"
            onChange={e => { change('body', e.target.value); check(e.target); }} onClick={e => check(e.target)}
            onKeyDown={e => {
              if (!suggest?.list.length) return;
              if (e.key === 'ArrowDown') { e.preventDefault(); setPick((pick + 1) % suggest.list.length); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setPick((pick - 1 + suggest.list.length) % suggest.list.length); }
              else if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); insert(suggest.list[pick]); }
              else if (e.key === 'Escape') setSuggest(null);
            }}/>
          {suggest && <div className="suggest glass" role="listbox" aria-label="链接建议">
            <p>链接到笔记 <em>Link to note</em>{suggest.q && <> · “{suggest.q}”</>}</p>
            {suggest.list.map((t, i) => <button key={t.id} role="option" aria-selected={i === pick} className={i === pick ? 'on' : ''} onMouseDown={e => { e.preventDefault(); insert(t); }} style={{'--kc': KINDS[t.kind].color}}><i/>{t.short}<small>{KINDS[t.kind].label} {KINDS[t.kind].en}</small></button>)}
            {!suggest.list.length && <span className="none">没有匹配，将成为未创建的笔记 <em>Will be unresolved</em></span>}
          </div>}
        </div>
        <footer className="editor-foot">
          <span>{(draft.body || '').length} 字 <em>chars</em> · {wiki.length} 个双链 <em>wikilinks</em></span>
          <button className="pill ghost danger" onClick={() => onDelete(draft.id)}><Icon name="trash" size={14}/>删除 <em>Delete</em></button>
        </footer>
      </section> : <section className="editor glass empty"><p>新建一篇草稿开始写作 <em>Create a draft to begin</em></p></section>}
      {node && <aside className="draft-links glass">
        <h3><Icon name="pulse" size={15}/>神经连接 <em>Neural links</em></h3>
        <MiniGraph graph={graph} node={node}/>
        <div className="dl-legend"><span><i className="out"/>出链 <em>Out</em> {nb.out.length}</span><span><i className="in"/>反链 <em>In</em> {nb.back.length}</span><span><i className="both"/>双向 <em>Mutual</em> {nb.mutual.length}</span></div>
        {[['[[双链]]', 'Wikilinks', wiki.map(n => n.id)], ['提及概念', 'Concepts', nb.out.filter(x => graph.index.get(x.id).kind === 'concept').map(x => x.id)], ['双向共振', 'Resonance', nb.mutual.map(x => x.id)], ['反链 · 来源', 'Backlinks', nb.back.map(x => x.id)]].filter(g => g[2].length).map(([zh, en, ids]) => <div className="dl-group" key={zh}>
          <p>{zh} <em>{en}</em></p>
          <div className="chip-row">{ids.map(id => { const n = graph.index.get(id); const go = CONTENT.has(n.kind) || n.kind === 'concept'; return go ? <button key={id} className="chip" style={{'--kc': KINDS[n.kind].color}} onClick={() => onGo(id)}>{n.short || n.title}</button> : <span key={id} className={`chip static ${n.kind === 'ghost' ? 'ghost' : ''}`} style={{'--kc': KINDS[n.kind].color}}>{n.short || n.title}</span>; })}</div>
        </div>)}
        {!node.deg && <p className="empty-line">写下内容或 [[链接]] 后，这里会长出连接。<em>Links appear as you write.</em></p>}
      </aside>}
    </div>
  </div>;
}

// —— 选题池 Ideas ——
const LANES = [['待写', 'To write'], ['待扩展', 'To expand'], ['已转草稿', 'Drafted']];
const PRI = {高: ['High', 'high'], 中: ['Medium', 'mid'], 低: ['Low', 'low']};

export function Ideas({graph, ideas, onEdit, onNew, onGraph}) {
  return <div className="page page-ideas">
    <PageHead zh="选题池" en="Ideas" sub="下一篇，从这里开始。" subEn="Ideas linked to what you have already published.">
      <button className="pill primary" onClick={onNew}><Icon name="plus" size={15}/>添加选题 <em>New idea</em></button>
    </PageHead>
    <div className="lanes">{LANES.map(([zh, en], li) => {
      const list = ideas.filter(i => i.status === zh);
      return <section className="lane glass" key={zh} style={{animationDelay: li * 90 + 'ms'}}>
        <header><span className={`lane-dot l${li}`}/>{zh} <em>{en}</em><b>{list.length}</b></header>
        {list.map((idea, i) => {
          const n = graph.index.get('idea:' + idea.id);
          const lat = n ? latent(graph, n.id) : [];
          const works = lat.filter(x => graph.index.get(x.id).kind === 'post');
          const [pen, pc] = PRI[idea.priority] || PRI['中'];
          return <article className={`idea-card pri-${pc}`} key={idea.id} style={{animationDelay: li * 90 + i * 70 + 140 + 'ms'}}>
            <div className="ic-top"><span className="ic-pri"><i/>{idea.priority} <em>{pen}</em></span><span className="ic-plat">{idea.platform}</span></div>
            <h3>{idea.title || '未命名选题'}</h3>
            <p>{idea.note || '还没有创作备注。'}</p>
            {n?.shared?.length > 0 && <div className="chip-row">{n.shared.slice(0, 5).map(c => <span key={c} className="chip static" style={{'--kc': KINDS.concept.color}}>{c}</span>)}</div>}
            <div className="ic-reach"><Icon name="link" size={13}/>{works.length ? <>可延伸 {works.length} 篇作品 <em>builds on {works.length} works</em></> : <>暂无关联作品 <em>No related works</em></>}</div>
            <footer>
              <button className="pill ghost" onClick={() => onGraph(n.id)}><Icon name="concept" size={14}/>图谱 <em>Graph</em></button>
              <button className="pill" onClick={() => onEdit(idea)}>编辑 <em>Edit</em><Icon name="chevron" size={13}/></button>
            </footer>
          </article>;
        })}
        {!list.length && <p className="empty-line">这个状态下还没有选题 <em>Nothing here yet</em></p>}
      </section>;
    })}</div>
  </div>;
}


// —— 每日学习中心 Learning Center ——
const DAILY_LESSONS = [
  {id:'ai-basics',title:'认识生成式 AI：它能做什么，不能做什么',tag:'AI 基础',level:'入门',goal:'建立正确的 AI 使用认知。',concept:'生成式 AI 会根据上下文预测并生成内容。它擅长归纳、改写、解释和提出方案，但可能把错误信息说得很确定。',steps:['把任务说清楚：你要完成什么。','补充背景：对象、场景、已有资料。','明确限制：篇幅、语气、格式和不能做的事。','核对事实：重要数字、日期和来源要复查。'],exercise:'让 AI 用 3 种难度解释一个你熟悉的概念，再检查哪一处解释最准确。',takeaway:'把 AI 当作协作工具，而不是事实来源。'},
  {id:'prompt-framework',title:'掌握提示词四要素：角色、任务、背景、格式',tag:'提示词实战',level:'入门',goal:'写出更清楚、可复用的指令。',concept:'高质量提示词通常包含角色、任务、背景和输出格式。需要时再补充示例、约束和评价标准。',steps:['角色：说明希望 AI 以什么专业视角协助。','任务：用动词描述具体交付物。','背景：提供必要资料和目标受众。','格式：规定列表、表格、字数或结构。'],exercise:'把“帮我学英语”改写成包含四要素的提示词，并要求给出 15 分钟练习。',takeaway:'指令越具体，结果越容易检查和迭代。'},
  {id:'fact-check',title:'让 AI 回答更可靠：事实核查与来源意识',tag:'AI 素养',level:'入门',goal:'识别幻觉并降低错误风险。',concept:'模型可能生成看似合理但并不真实的细节。涉及医疗、法律、财务、实时新闻或关键决策时，必须查验可靠来源。',steps:['把事实问题和创意任务分开。','要求列出可核验的来源与发布日期。','打开原始来源核对关键句和数据。','找不到可靠证据时，明确标注未知。'],exercise:'向 AI 提问一个近期事实问题，逐条检查回答中的日期、数字和出处。',takeaway:'流畅不等于正确；证据比语气重要。'},
  {id:'research',title:'用 AI 做高效资料研究：从问题到结论',tag:'研究方法',level:'进阶',goal:'把宽泛主题拆成可研究的问题。',concept:'研究的关键不是一次问出答案，而是拆分问题、收集证据、比较观点并形成有边界的结论。',steps:['先定义研究目标和时间范围。','把主题拆成 3—5 个子问题。','分别收集官方资料、专业报道和不同观点。','记录来源、日期、证据强度与未解决问题。'],exercise:'选一个你感兴趣的 AI 工具，列出它的核心功能、价格、限制和适用人群四个研究问题。',takeaway:'先建立证据结构，再写总结。'},
  {id:'writing',title:'AI 辅助写作：从大纲到高质量初稿',tag:'内容创作',level:'入门',goal:'用 AI 提高写作效率，同时保留个人判断。',concept:'写作流程可拆为选题、受众分析、结构设计、初稿、事实核对和润色。不要让模型替代你的真实经验。',steps:['写清楚读者是谁、读完要获得什么。','先生成 3 种文章结构并选择其一。','提供真实案例、数据或个人观点。','分段生成，再统一语气并核查事实。'],exercise:'选一个主题，让 AI 给出三种不同结构；比较哪一种最适合目标读者。',takeaway:'你的经验和观点，是内容最重要的差异化。'},
  {id:'image-ai',title:'AI 图像工具入门：描述画面而不是堆砌形容词',tag:'AI 工具实战',level:'入门',goal:'学会把视觉想法转成可执行描述。',concept:'图像提示词可以按主体、场景、构图、光线、材质、色彩和画面比例组织。先确定主体与构图，再补充风格细节。',steps:['主体：画面最重要的对象是什么。','场景：它在哪里、正在做什么。','构图：远景/近景、视角、主体位置。','光线与色彩：明确主光方向和色彩关系。'],exercise:'描述一张“桌面上的未来感学习终端”概念图，分别写出主体、构图、光线和材质。',takeaway:'清晰的视觉结构比一长串风格词更有用。'},
  {id:'automation',title:'认识 AI 自动化：把重复步骤变成工作流',tag:'效率提升',level:'进阶',goal:'找到适合自动化的重复任务。',concept:'自动化适合规则明确、重复发生、输入输出稳定的工作。涉及付款、发布或删除等高风险动作时，应加入人工确认。',steps:['记录一项重复工作从开始到结束的步骤。','找出固定输入、判断条件和输出结果。','先自动化低风险、可回滚的部分。','设置失败提醒、日志和人工审核。'],exercise:'画出“收到学习资料—提取重点—生成摘要—保存笔记”的四步流程。',takeaway:'先把流程理清，再决定是否需要自动化。'},
  {id:'coding',title:'让 AI 帮你理解代码：先读懂，再修改',tag:'编程入门',level:'进阶',goal:'学会安全地使用 AI 辅助编程。',concept:'代码修改应围绕明确目标进行。先定位文件和组件，理解依赖，再做最小变更并运行测试。',steps:['描述现象、预期结果和复现步骤。','定位相关文件与组件边界。','要求给出最小修改方案和影响范围。','运行构建或测试，检查差异和回归。'],exercise:'找一个你使用的网站按钮，尝试描述它的点击行为、输入、输出和可能的状态。',takeaway:'小步修改、验证结果，避免无关重构。'},
  {id:'data',title:'用 AI 分析表格：先定义指标，再解释结果',tag:'数据分析',level:'进阶',goal:'避免只看数字、不看口径。',concept:'数据分析要先理解字段含义、单位、缺失值和统计口径。相关性不等于因果关系。',steps:['说明每列代表什么、单位是什么。','检查重复值、空值和异常值。','定义要回答的问题和比较指标。','把结论、证据和局限分开表达。'],exercise:'设计一个记录每日学习时长的表格，写出你最想观察的两个指标。',takeaway:'先确认数据质量和指标定义，再解释趋势。'},
  {id:'video',title:'AI 视频创作流程：脚本、分镜与一致性',tag:'AI 工具实战',level:'进阶',goal:'理解 AI 视频制作的基本工作流。',concept:'视频生成通常需要把创意拆成镜头，并控制主体、场景、动作和镜头运动的一致性。',steps:['先写一句话创意和目标观众。','把故事拆成 3—6 个镜头。','为每个镜头写主体、动作、景别和运镜。','检查人物、服装、场景和时间连续性。'],exercise:'把“机器人在雨夜街道寻找信号”拆成三个连续镜头。',takeaway:'先做好分镜，再生成素材，最后剪辑。'},
  {id:'security',title:'AI 使用安全：隐私、权限与敏感资料',tag:'安全与隐私',level:'入门',goal:'建立安全使用 AI 工具的习惯。',concept:'不要把密码、验证码、身份证件、私人密钥或未经授权的个人资料输入不可信服务。使用工具前应检查数据权限和隐私说明。',steps:['识别资料是否包含个人或机密信息。','只提供完成任务所需的最少内容。','对外部工具检查权限范围和数据政策。','分享或发布前人工复核输出。'],exercise:'检查你常用的一个 AI 工具，找出它请求了哪些权限，并判断是否必要。',takeaway:'最小化数据暴露，谨慎授予权限。'},
  {id:'iteration',title:'让 AI 输出变好：用评价标准进行迭代',tag:'提示词实战',level:'进阶',goal:'把“感觉不够好”变成可执行反馈。',concept:'迭代时应指出具体问题，并给出可观察的评价标准，例如准确性、完整性、可读性、语气和格式。',steps:['先定义什么样的结果算合格。','指出当前版本具体缺失或错误之处。','一次只调整一到两个关键维度。','对比修改前后是否达到标准。'],exercise:'让 AI 写一段 100 字介绍，再从准确、清楚、有吸引力三个维度给出修改意见。',takeaway:'具体反馈比简单说“再优化一下”有效。'},
  {id:'workflow',title:'设计你的个人 AI 学习工作流',tag:'实战项目',level:'进阶',goal:'把零散工具组合成稳定流程。',concept:'个人工作流由目标、输入、步骤、工具、输出和复盘构成。流程应足够简单，能够持续执行。',steps:['选一个真实且频繁发生的任务。','写下输入资料和最终交付物。','拆分步骤并为每一步选择合适工具。','记录耗时、质量和需要人工判断的节点。'],exercise:'设计一个每周学习工作流：收集主题、学习资料、做笔记、完成练习、复盘。',takeaway:'工具服务于流程，不要为了用工具而增加步骤。'},
  {id:'api',title:'理解 API：让不同 AI 服务连接起来',tag:'技术基础',level:'进阶',goal:'理解 API 在 AI 应用中的作用。',concept:'API 是软件之间约定好的通信接口。客户端发送请求，服务端处理后返回数据；密钥应保存在服务端，不能写进公开前端代码。',steps:['理解请求地址、方法和参数。','了解 JSON 请求体与响应结构。','区分前端展示和服务端调用。','把密钥放在安全的环境变量中。'],exercise:'用自己的话解释：网页前端为什么不应该直接暴露 AI API Key？',takeaway:'接口负责通信，密钥必须受到保护。'},
  {id:'evaluation',title:'评估 AI 工具：别只看演示效果',tag:'工具选择',level:'进阶',goal:'建立适合自己的工具评估框架。',concept:'工具选择要考虑任务质量、稳定性、速度、成本、隐私、可导出性和学习成本，而不只是宣传演示。',steps:['列出你真正要完成的任务。','用相同输入测试候选工具。','记录质量、耗时、价格和限制。','根据使用频率和风险做选择。'],exercise:'选两个你用过的 AI 助手，用同一道任务比较它们的结果。',takeaway:'用真实任务测试，不要只看营销演示。'},
  {id:'capstone',title:'阶段实战：完成一个可展示的 AI 小项目',tag:'实战项目',level:'项目实践',goal:'把本阶段知识整合成一个成果。',concept:'一个合格的小项目需要明确用户、问题、输入、处理步骤和可验证的输出。先做最小可用版本，再逐步完善。',steps:['选择一个具体问题和目标用户。','定义最小功能，不要一开始做得太大。','用 AI 辅助完成资料、设计或代码。','测试真实场景并记录下一步改进。'],exercise:'设计一个“个人学习助手”：输入学习主题，输出学习计划、知识卡片和练习题。',takeaway:'完成一个小而真实的项目，比收藏很多工具更有价值。'}
];

export function LearningCenter() {
  const today = new Date();
  const dateKey = [today.getFullYear(), String(today.getMonth()+1).padStart(2,'0'), String(today.getDate()).padStart(2,'0')].join('-');
  const dayNumber = Math.floor(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() / 86400000);
  const lesson = DAILY_LESSONS[((dayNumber % DAILY_LESSONS.length) + DAILY_LESSONS.length) % DAILY_LESSONS.length];
  const [completed, setCompleted] = useState(() => {
    try { return JSON.parse(localStorage.getItem('neural-learning-progress-v1') || '{}'); } catch { return {}; }
  });
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [asking, setAsking] = useState(false);
  const done = Boolean(completed[dateKey]);
  const toggle = () => {
    const next = {...completed};
    if (done) delete next[dateKey]; else next[dateKey] = lesson.id;
    setCompleted(next);
    try { localStorage.setItem('neural-learning-progress-v1', JSON.stringify(next)); } catch {}
  };
  const askTutor = async () => {
    if (!question.trim() || asking) return;
    setAsking(true);
    setAnswer('');
    try {
      const reply = await askLearningTutor({question: question.trim(), lesson: lesson.title});
      setAnswer(reply);
    } catch (error) {
      setAnswer(error.message || 'AI 导师暂时不可用，请稍后重试。');
    } finally {
      setAsking(false);
    }
  };
  return <div className="page page-learning">
    <PageHead zh="学习中心" en="Learning Center" sub="每天进步一点，持续构建你的 AI 能力。" subEn="A daily learning path — concepts, hands-on steps and practice."/>
    <section className="learning-today glass">
      <div className="learning-kicker"><span>DAILY LEARNING</span><span>{dateKey}</span></div>
      <div className="learning-hero-row">
        <div><p className="learning-tag">{lesson.tag} · {lesson.level}</p><h2>{lesson.title}</h2><p className="learning-goal">{lesson.goal}</p></div>
        <div className="learning-day"><strong>{String(dayNumber % 365 + 1).padStart(2,'0')}</strong><span>DAY</span></div>
      </div>
      <div className="learning-status"><span><i className={done ? 'is-done' : ''}/>{done ? '今日已完成' : '今日学习进行中'}</span><button className="pill primary" onClick={toggle}>{done ? '撤销完成' : '标记今日完成'} <em>{done ? 'Undo' : 'Complete'}</em></button></div>
    </section>
    <div className="learning-grid">
      <section className="learning-panel glass"><header><h3>核心知识 <em>Key concept</em></h3></header><p>{lesson.concept}</p></section>
      <section className="learning-panel glass"><header><h3>实操步骤 <em>How to practice</em></h3></header><ol>{lesson.steps.map((step,i)=><li key={i}>{step}</li>)}</ol></section>
      <section className="learning-panel learning-exercise glass"><header><h3>今日练习 <em>Daily exercise</em></h3></header><p>{lesson.exercise}</p>
        <div className="learning-tutor">
          <label htmlFor="learning-answer">把你的答案或疑问交给 AI 导师</label>
          <textarea id="learning-answer" value={question} onChange={e => setQuestion(e.target.value)} placeholder="写下你的练习答案，或描述你没弄懂的地方…" rows={4}/>
          <button className="pill primary" onClick={askTutor} disabled={asking || !question.trim()}>{asking ? '导师思考中…' : '提交给 AI 导师'} <em>{asking ? 'Thinking' : 'Ask DeepSeek'}</em></button>
          {answer && <div className="learning-tutor-answer" aria-live="polite"><strong>导师反馈</strong><p>{answer}</p></div>}
        </div>
      </section>
      <section className="learning-panel learning-takeaway glass"><header><h3>今日要点 <em>Takeaway</em></h3></header><p>{lesson.takeaway}</p></section>
    </div>
    <p className="learning-footnote">课程按日期从 AI 基础、提示词、工具实战到项目实践循序推进。学习记录仅保存在当前浏览器；AI 导师通过安全服务端连接 DeepSeek。</p>
  </div>;
}
