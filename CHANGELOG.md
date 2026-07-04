# Changelog

All notable changes to this package will be documented in this file.

This project follows semantic versioning.

## 0.3.9

- Stop tracking generated `dist` files in Git while keeping built output in the published npm package.

## 0.3.8

- Print each CLI command before running it so setup and delete output is easier to follow.

## 0.3.7

- Preserve the template's GitHub Actions deploy workflow instead of disabling push-triggered deploys.

## 0.3.6

- Render step boxes as a single line.
- Remove the `--yes` option and keep the guided flow as the default.
- Shorten the final summary to the project, directory, production URL, GitHub repo, and delete command.

## 0.3.5

- Add a TanStarter welcome banner with website, docs, and video links.
- Move resource-name review into its own setup step.
- Show Cloudflare setup docs only when Cloudflare environment variables are missing.

## 0.3.4

- Add framed progress output to `tanstarter delete`.
- Treat already-deleted Cloudflare and GitHub resources as successful cleanup.
- Skip Wrangler KV deletion confirmation and show a clearer GitHub `delete_repo` permission hint.

## 0.3.3

- Run environment checks before prompting for resource names.
- Clarify prompt defaults and Enter-to-continue behavior.

## 0.3.2

- Keep `.env` pointed at `http://localhost:3000` while `.env.production` uses the production URL.
- Add framed step progress output and a final project summary.
- Run Wrangler provisioning, migrations, and Worker secret sync without extra confirmation prompts.

## 0.3.1

- Rename the cleanup command to `tanstarter delete`.
- Delete the deployed Cloudflare Worker during cleanup, which also removes the Worker custom domain route.
- Keep `tanstarter destroy` as a backwards-compatible alias.

## 0.3.0

- Add `tanstarter destroy` to clean up Cloudflare and GitHub resources created by demo runs.
- Ask for D1, R2, KV, custom domain, and GitHub repo values before creating resources in interactive terminals.
- Persist the GitHub repo name in setup state so cleanup can target the correct repository.

## 0.2.4

- Fix CLI execution when launched through npm/npx bin symlinks.

## 0.1.0

- Initial public CLI package.
- Create TanStarter projects from the default template.
- Provision Cloudflare D1, R2, and KV resources.
- Write generated Cloudflare configuration and environment files.
- Initialize GitHub repository, sync secrets, build, push, and deploy.
