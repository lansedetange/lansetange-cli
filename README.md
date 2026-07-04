# TanStarter CLI

Create a TanStarter app from the template, provision Cloudflare D1/R2/KV, and
write the generated Cloudflare values back into the project.

## Usage

```bash
export CLOUDFLARE_ACCOUNT_ID="..."
export CLOUDFLARE_API_TOKEN="..."

npx tanstarter-cli@latest my-app
```

During setup the CLI checks for `node`, `pnpm`, `git`, `gh`, GitHub CLI auth,
Git author identity, and Cloudflare credentials. If `pnpm`, `git`, or `gh` is
missing, the CLI attempts to install it with the available system package
manager before continuing. Wrangler is installed from the template dependencies
after the project is cloned and `pnpm install` runs. The CLI then creates D1
and R2 resources plus a KV namespace, updates `wrangler.jsonc`, writes `.env`
and `.env.production`, runs migrations, syncs Worker secrets, creates a private
GitHub repository, syncs GitHub Actions secrets, builds, commits, pushes to
`main`, and deploys.

Any variables from the template `.env.example` that already exist in your shell
environment are copied into the generated `.env` and `.env.production` files.
Generated Cloudflare, D1, KV, base URL, and auth secret values take precedence.

## Command

```bash
tanstarter <project-name> [options]
```

Options:

- `--domain <domain>`: configure a Cloudflare custom domain route.
- `--github-repo <owner/name>`: create or use this GitHub repository instead
  of a private repo named after `<project-name>`.
- `--resume`: continue a failed setup from `.tanstarter/state.json`.
- `--yes`: run non-interactively.

If a run fails after the project directory is created, fix the issue and run:

```bash
tanstarter my-app --resume
```
