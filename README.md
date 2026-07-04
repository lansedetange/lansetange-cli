# TanStarter CLI

Create a TanStarter app from the template and deploy it to Cloudflare Workers in about 10 minutes.

## Quick Start

```bash
export CLOUDFLARE_ACCOUNT_ID="..."
export CLOUDFLARE_API_TOKEN="..."

npx tanstarter-cli@latest my-app
```

When run in an interactive terminal, the CLI asks for missing optional settings
and resource names before it starts creating anything:

- D1 database name
- R2 bucket name
- KV namespace name
- Custom domain
- GitHub repository

Press Enter to keep each shown default value.

After the setup finishes, TanStarter prints a boxed summary with the local
directory, local URL, production URL, GitHub repository, Cloudflare resource
names, and the matching delete command.

## Command

```bash
tanstarter <project-name> [options]
tanstarter delete <project-name> [options]
```

Options:

- `--domain <domain>`: configure a Cloudflare custom domain route.
- `--repo <owner/name>`: create this GitHub repository.
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

To delete the Cloudflare and GitHub resources created by a demo run:

```bash
tanstarter delete my-app
```

This uses `my-app/.tanstarter/state.json` to find the created D1, R2, KV, and
GitHub resources. If a custom domain was configured, deleting the Worker also
removes the Worker custom domain route; DNS records in your Cloudflare zone are
not deleted automatically. The local project directory is left in place.

The GitHub repo and custom domain are saved in `.tanstarter/state.json` during
setup, so you normally do not need to pass them again when deleting. If you need
to override the repo target manually:

```bash
tanstarter delete my-app --repo mkfasthq/my-app
```

## Prerequisites

- Node.js 20 or later.
- A Cloudflare account with `CLOUDFLARE_ACCOUNT_ID` and
  `CLOUDFLARE_API_TOKEN` available in your shell.
- A GitHub account authenticated with GitHub CLI.
- To delete GitHub repositories with `tanstarter delete`, GitHub CLI needs the
  `delete_repo` scope. You can grant it with `gh auth refresh -s delete_repo`.

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

## License

MIT
