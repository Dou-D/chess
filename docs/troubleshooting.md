# 故障排查

## 1. 页面提示缺少环境变量

现象：页面出现“缺少环境变量，请创建 `.env.local`”。

原因：

- 本地运行时未设置 `.env.local`。
- 线上构建时未注入 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`。
- 打开了旧的预览链接而不是最新生产部署。

排查：

1. 本地：检查项目根目录 `.env.local` 是否存在并包含 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`。
2. 线上：检查 GitHub Actions Secrets 是否配置并拼写正确。
3. 修改 Secrets 后重新触发 workflow（Vite 变量在构建期注入）。
4. 打开 `https://<project>.pages.dev` 生产域名验证，不要只看旧预览链接。

## 2. 邀请发出后对方收不到

现象：发送邀请成功提示出现，但对方“收到的邀请”为空。

常见原因：

- `profiles.public_id` 字段未创建或未迁移。
- `profiles` 的 RLS 策略不允许按 `public_id` 查询目标用户。
- 对方尚未设置并保存自己的对战 ID。

排查：

1. 在 Supabase 执行最新 `supabase/schema.sql`。
2. 确认 `profiles` 表有 `public_id` 字段与唯一索引。
3. 确认双方都在页面保存了 `public_id`。
4. 确认 Realtime publication 包含 `public.invites`。

## 3. 打开页面自动进入上一局

现象：刷新或新开页面后，自动回到历史对局。

当前预期：

- 新会话不自动续接历史局。
- 仅本会话中新创建/新接受的邀请会自动进入对局。

排查：

1. 确认前端已更新到最新版本（包含 session-scoped active game 逻辑）。
2. 清空浏览器缓存并硬刷新后重试。
3. 检查是否误打开了旧预览部署链接。

## 4. 对局结束后棋盘闪烁

现象：结束瞬间棋盘快速闪烁，刷新后恢复。

根因：

- 已接受邀请被重复消费，`activeGame` 在结束后反复切换。

修复状态：

- 前端已加入“已接受对局只消费一次”的标记。
- Canvas 已使用静态层缓存，减少无效重绘。

若仍出现：

1. 确认线上是最新构建。
2. 打开浏览器无痕窗口排除扩展影响。
3. 提供复现步骤和录屏，便于继续定位具体状态抖动点。

## 5. 棋盘白板不可见

现象：页面有棋盘区域但内容全白。

可能原因：

- Canvas 首帧绘制被错误跳过。
- 部分样式或容器尺寸异常。

修复状态：

- 已去掉过早的首帧跳过逻辑。
- 增加 Canvas 背景色兜底。

若仍出现：

1. 确认 `pnpm build` 产物为最新。
2. 检查浏览器控制台是否有 Canvas 报错。
3. 尝试切换浏览器（Chrome/Edge）交叉验证。

## 6. Cloudflare 域名变成哈希前缀

现象：访问地址类似 `https://<hash>.<project>.pages.dev`。

说明：

- 这是 Cloudflare Pages 的预览链接。
- 稳定生产地址应为 `https://<project>.pages.dev`。

建议：

1. 在 Pages 项目中确认 Production branch 为 `main`。
2. 对外只使用生产域名或自定义域名。
3. 预览链接仅用于一次性验收。
