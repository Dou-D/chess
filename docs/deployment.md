# 部署说明

## 构建

```bash
pnpm install
pnpm build
```

## GitHub Actions

工作流文件：

- `.github/workflows/deploy-pages.yml`

GitHub 仓库中需要配置的 Secrets：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Cloudflare 要求

`CLOUDFLARE_PAGES_PROJECT_NAME` 必须与一个已存在的 Cloudflare **Pages** 项目名称完全一致，不能填写 Workers 项目名。

## 域名说明

- `https://<project>.pages.dev` 是稳定的生产域名
- `https://<hash>.<project>.pages.dev` 是某次构建对应的预览部署域名
- 如果你修改了 Secrets，需要重新运行 workflow 重新构建；Vite 环境变量是在构建阶段注入的

## 线上“缺少环境变量”的排查

如果线上页面提示缺少 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`，请按以下步骤排查：

1. 确认 GitHub 仓库的 Actions Secrets 中已配置这些变量。
2. 更新 Secrets 后重新运行部署 workflow。
3. 确认你访问的是生产域名，而不是旧的预览链接。
