# TanStarter CLI

Create a TanStarter app from the template and deploy it to Cloudflare Workers in about 10 minutes.

## Quick Start

```bash
export CLOUDFLARE_ACCOUNT_ID="..."
export CLOUDFLARE_API_TOKEN="..."

npx tanstarter-cli@latest my-app
```

## Prerequisites

- Node.js 20 or later.
- A Cloudflare account with `CLOUDFLARE_ACCOUNT_ID` and
  `CLOUDFLARE_API_TOKEN` available in your shell.
- A GitHub account authenticated with GitHub CLI.

The CLI checks for `node`, `pnpm`, `git`, `gh`, GitHub CLI auth, and Cloudflare
credentials. If `pnpm`, `git`, or `gh` is missing, the CLI attempts to install
it with the available system package manager before continuing.

## What It Does

The setup flow:

1. Clones the TanStarter template.
2. Installs dependencies with `pnpm install`.
3. Creates Cloudflare D1, R2, and KV resources.
4. Updates `wrangler.jsonc`.
5. Writes `.env` and `.env.production`.
6. Runs database migrations.
7. Syncs Worker secrets.
8. Creates a GitHub repository.
9. Syncs GitHub Actions secrets.
10. Builds, commits, pushes to `main`, and deploys.

Environment variables from the template `.env.example` are copied from your
shell into the generated `.env` and `.env.production` files when present.
Generated Cloudflare, D1, KV, base URL, and auth secret values take precedence.

## Command

```bash
tanstarter <project-name> [options]
```

Options:

- `--domain <domain>`: configure a Cloudflare custom domain route.
- `--repo <owner/name>`: create or use this GitHub repository instead
  of a private repo named after `<project-name>`.
- `--resume`: continue a failed setup from `.tanstarter/state.json`.
- `--yes`: run non-interactively.

Example:

```bash
tanstarter my-app --domain app.example.com --repo mkfasthq/my-app
```

If a run fails after the project directory is created, fix the issue and run:

```bash
tanstarter my-app --resume
```

## License

MIT
