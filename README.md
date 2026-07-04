# TanStarter CLI

Create a TanStarter app from the template, provision Cloudflare D1/R2/KV, and
write the generated Cloudflare values back into the project.

## Usage

```bash
export CLOUDFLARE_ACCOUNT_ID="..."
export CLOUDFLARE_API_TOKEN="..."

pnpm dlx tanstarter-cli my-app
```

During setup the CLI checks for `node`, `pnpm`, `git`, `gh`, `wrangler`,
GitHub CLI auth, Git author identity, and Cloudflare credentials. It then
clones the TanStarter template, installs dependencies, creates D1 and R2
resources plus a KV namespace, updates `wrangler.jsonc`, writes `.env` and
`.env.production`, runs migrations, syncs Worker secrets, creates a private
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

- `--template <url>`: template git URL. Defaults to
  `https://github.com/MkFastHQ/mkfast-template.git`.
- `--branch <name>`: clone a specific template branch.
- `--dir <path>`: target directory. Defaults to `<project-name>`.
- `--domain <domain>`: configure a Cloudflare custom domain route.
- `--github-repo <owner/name>`: create or use this GitHub repository instead
  of a private repo named after `<project-name>`.
- `--skip-install`: clone and configure without running `pnpm install`.
- `--skip-github-repo`: do not create or attach a GitHub repository.
- `--skip-push`: do not create the initial commit or push to `main`.
- `--skip-github-secrets`: do not sync GitHub Actions secrets.
- `--skip-worker-secrets`: do not run `wrangler secret bulk`.
- `--skip-deploy`: stop after build instead of deploying.
- `--resume`: continue a failed setup from `.tanstarter/state.json`.
- `--yes`: run non-interactively.

If a run fails after the project directory is created, fix the issue and run:

```bash
tanstarter my-app --dir ./my-app --resume
```
