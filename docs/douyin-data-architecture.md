# 抖音数据中心：数据底座

## 当前范围
首期只支持抖音（platform 固定为 `douyin`）。数据表已预留账号档案、账号每日快照、视频作品、视频每日快照和导入批次。

## 数据保存原则
- 每次采集/录入都追加带时间戳的快照，不覆盖历史表现。
- 账号与视频记录均带 `owner_id`，为未来多用户隔离做准备。
- `source` 标记手动录入、CSV 导入或官方 API。
- 原始行可放在 `raw_json`，便于以后适配抖音导出格式。
- 数据库只存指标和必要元数据；导入文件本身未来可放 Cloudflare R2。

## Cloudflare D1 初始化
1. 在 Cloudflare Dashboard 打开 Workers & Pages → D1 SQL Database，创建数据库，例如 `creator-data`。
2. 在数据库 Console 执行 `migrations/0001_douyin_data.sql` 的全部 SQL；或在本地安装 Wrangler 后执行：
   `wrangler d1 execute creator-data --remote --file=migrations/0001_douyin_data.sql`
3. 在 Pages 项目 Settings → Functions → D1 database bindings 添加绑定，变量名建议 `DB`，选择刚创建的数据库。
4. 目前不要把 D1 绑定后就直接开放读写 API。现有网站尚未建立用户身份认证；必须先确定只有账号所有者本人能访问数据，再开发 API，避免公开网址上的访客读到或修改私人账号数据。

## 下一阶段
- 建立可靠的所有者身份验证和数据访问控制。
- 增加账号/视频录入、CSV 导入与数据校验 API。
- 接入前端抖音数据中心，并把账号、视频映射为可点击的神经网络节点。
- 研究抖音官方开放平台当前授权范围；只有官方允许且用户授权的数据才自动同步。
