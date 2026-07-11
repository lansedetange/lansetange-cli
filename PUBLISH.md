# Publishing

This document is for maintainers of `lansedetange-cli`. End users do not need it.

The package is published to npm through GitHub Actions and npm Trusted
Publishing. Do not add an `NPM_TOKEN` secret for normal releases.

## Current Setup

- npm package: `lansedetange-cli`
- GitHub repository: `lansedetange/lansetange-cli`
- Publish workflow: `.github/workflows/publish.yml`
- GitHub environment: `npm`
- npm provenance: enabled with `npm publish --provenance --access public`

The workflow runs only when a semantic version tag is pushed:

```text
v*.*.*
```

Examples: `v0.2.3`, `v1.0.0`.

## Release Checklist

Start from a clean `main` branch:

```bash
git checkout main
git pull
git status
```

Run local verification:

```bash
pnpm install --frozen-lockfile
pnpm run check
pnpm run test
pnpm run build
npm pack --dry-run
```

Bump the version and push the generated commit and tag:

```bash
npm version patch
git push --follow-tags
```

Use `npm version minor` for larger user-facing additions and `npm version major`
for breaking changes.

The tag push triggers the publish workflow. Watch it with:

```bash
gh run list --repo lansedetange/lansetange-cli --limit 5
```

## Verify the Release

After the workflow succeeds:

```bash
npm view lansedetange-cli version versions --json
gh release list --repo lansedetange/lansetange-cli --limit 5
```

Install smoke test:

```bash
npx lansedetange-cli@latest --version
```
