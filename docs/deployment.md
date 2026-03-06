# Deployment

## Build

```bash
pnpm install
pnpm build
```

## GitHub Actions

Workflow file:

- `.github/workflows/deploy-pages.yml`

Required GitHub repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Cloudflare Requirement

`CLOUDFLARE_PAGES_PROJECT_NAME` must match an existing Cloudflare **Pages** project name (not Workers project name).
