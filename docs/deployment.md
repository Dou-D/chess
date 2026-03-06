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

## Domain Notes

- `https://<project>.pages.dev` is the stable production domain.
- `https://<hash>.<project>.pages.dev` is a preview deployment domain for a specific build.
- If you changed secrets, re-run workflow to rebuild; Vite env is injected at build time.

## Online "Missing env" Troubleshooting

If page shows missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` online:

1. Verify secrets exist in GitHub repository Actions secrets.
2. Re-run deployment workflow after updating secrets.
3. Ensure you are opening production domain, not an old preview link.
