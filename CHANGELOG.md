# Changelog

All notable changes to this package will be documented in this file.

This project follows semantic versioning.

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
