# TanStarter CLI

Create a TanStarter app from the template, provision Cloudflare D1/R2/KV, and
write the generated Cloudflare values back into the project.

## Usage

```bash
export CLOUDFLARE_ACCOUNT_ID="..."
export CLOUDFLARE_API_TOKEN="..."

npx tanstarter-cli@latest my-app
```

## Prerequisites

- Node.js 20 or later.
- A GitHub account authenticated with GitHub CLI.
- A Cloudflare account with `CLOUDFLARE_ACCOUNT_ID` and
  `CLOUDFLARE_API_TOKEN` available in your shell.

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
- `--repo <owner/name>`: create or use this GitHub repository instead
  of a private repo named after `<project-name>`.
- `--resume`: continue a failed setup from `.tanstarter/state.json`.
- `--yes`: run non-interactively.

If a run fails after the project directory is created, fix the issue and run:

```bash
tanstarter my-app --resume
```

## Publishing

This package uses npm Trusted Publishing with GitHub Actions, so publishing does
not require an npm automation token in GitHub secrets.

Configure the package on npmjs.com under **Settings > Trusted Publisher**:

- Publisher: GitHub Actions
- Organization or user: `MkFastHQ`
- Repository: `tanstarter-cli`
- Workflow filename: `publish.yml`
- Environment name: `npm`
- Allowed actions: `npm publish`

The `npm` GitHub environment can be configured with required reviewers if you
want a manual approval step before publishing.

For later releases, bump the version from a clean `main` branch:

```bash
pnpm install --frozen-lockfile
npm version patch
git push --follow-tags
```

Use `npm version minor` or `npm version major` instead of `patch` when the
release contains larger user-facing changes. Run `pnpm run release:dry` to
preview the package that npm will publish. Do not push a tag for a version that
already exists on npm.
