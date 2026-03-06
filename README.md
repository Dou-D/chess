# Gomoku Web (Supabase + pnpm)

网页端双人五子棋，支持：

- 匿名登录
- 输入对方 ID 发起邀请
- 对方同意后立即开局
- 15x15 实时对战与胜负判定
- TailwindCSS + shadcn 风格组件
- GSAP 胜负结束动画
- 双方确认再来一局协议（超时断开）
- 手机/iPad 响应式布局
- GitHub Actions 自动部署到 Cloudflare Pages（免费 CDN）

## 1. 本地开发

```bash
pnpm install
pnpm dev
```

## 2. Supabase 配置

1. 创建 Supabase 项目。
2. 在 `Authentication -> Providers` 中启用 `Anonymous`。
3. 打开 `SQL Editor`，执行 `supabase/schema.sql` 全部内容。
   - 如果你之前已经部署过旧版本，也要重新执行一次以创建 `rematch_votes` 表。
4. 在项目根目录创建 `.env.local`：

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

5. 重新运行 `pnpm dev`。

6. 确保 Realtime publication 包含：
   - `public.invites`
   - `public.games`
   - `public.moves`
   - `public.rematch_votes`

## 3. 双人对战使用方式

1. A 和 B 分别在不同浏览器（或隐身窗口）打开页面。
2. 两边会自动匿名登录，并显示自己的用户 ID。
3. A 复制 B 的 ID，输入后发送邀请。
4. B 在“收到的邀请”里点击“同意”。
5. 双方自动进入同一局；黑棋先手。

## 4. 结束与再来一局机制

- 对局结束后会出现 GSAP 动画面板（Victory/Defeat/Draw）。
- 只有当双方都点击“再来一局”时，系统才会创建下一局。
- 任意一方选择“结束并断开连接”，实时连接会关闭。
- 如果 60 秒内未达成双方确认，判定超时并关闭实时连接。

## 5. GitHub Actions + Cloudflare Pages

工作流文件：`.github/workflows/deploy-pages.yml`

触发条件：

- push 到 `main`
- 手动触发 `workflow_dispatch`

在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 中添加：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

说明：当前项目在 GitHub Actions 中执行 `pnpm build`，所以前端变量优先放在 GitHub Secrets 中即可。

## 6. 目录说明

- `src/hooks/use-gomoku-game.ts`: 对局核心逻辑（登录、邀请、订阅、落子、胜负）
- `src/components/game/*`: 五子棋业务组件
- `src/components/ui/*`: shadcn 风格基础组件
- `src/index.css`: Tailwind 入口样式
- `supabase/schema.sql`: 数据表 + RLS + Policy
- `.github/workflows/deploy-pages.yml`: CI/CD 自动部署流程
- `INIT.md`: 开发执行 prompt

## 7. 文档索引

- `docs/architecture.md`
- `docs/supabase.md`
- `docs/gameplay.md`
- `docs/deployment.md`
- `docs/env.md`
