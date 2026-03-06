# Environment Checklist

## Supabase

- 启用匿名登录：`Authentication -> Providers -> Anonymous`
- 在 SQL Editor 执行：`supabase/schema.sql`
- 确认 `profiles.public_id` 字段已创建（新版本邀请依赖此字段）
- 确保 Realtime publication 包含：
  - `public.invites`
  - `public.games`
  - `public.moves`

## Local

创建 `.env.local`：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## GitHub Secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Deploy

- 推送 `main` 分支或手动触发 workflow。

## Cloudflare Pages URL

- 生产：`https://<project>.pages.dev`
- 预览：`https://<hash>.<project>.pages.dev`
