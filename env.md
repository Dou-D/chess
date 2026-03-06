在 Supabase 控制台启用匿名登录：Authentication -> Providers -> Anonymous。
在 Supabase 的 SQL Editor 执行 schema.sql。
本地创建 .env.local，填入：
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
GitHub 仓库里添加 Actions Secrets：
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_PAGES_PROJECT_NAME
在 Cloudflare Pages 项目里配置前端环境变量：
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
推送到 main 分支触发部署。