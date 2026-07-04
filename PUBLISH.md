# Publishing

This document is for maintainers of `tanstarter-cli`. End users do not need it.

The package is published to npm through GitHub Actions and npm Trusted
Publishing. Do not add an `NPM_TOKEN` secret for normal releases.

## Current Setup

- npm package: `tanstarter-cli`
- GitHub repository: `MkFastHQ/tanstarter-cli`
- Publish workflow: `.github/workflows/publish.yml`
- GitHub environment: `npm`
- npm provenance: enabled with `npm publish --provenance --access public`

The workflow runs only when a semantic version tag is pushed:

```text
v*.*.*
```

Examples: `v0.2.3`, `v1.0.0`.

## npm Trusted Publisher

In npmjs.com, open the package settings and configure **Trusted Publisher**:

- Publisher: `GitHub Actions`
- Organization or user: `MkFastHQ`
- Repository: `tanstarter-cli`
- Workflow filename: `publish.yml`
- Environment name: `npm`
- Allowed actions: `Allow npm publish`

The `npm` GitHub environment may require manual approval before the job can
publish. That is optional, but useful if more people get repository access.

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
gh run list --repo MkFastHQ/tanstarter-cli --limit 5
```

## Verify the Release

After the workflow succeeds:

```bash
npm view tanstarter-cli version versions --json
gh release list --repo MkFastHQ/tanstarter-cli --limit 5
```

Install smoke test:

```bash
npx tanstarter-cli@latest --version
```

## Version Notes

Already published npm versions cannot be republished.

The early `0.2.0` and `0.2.1` tags exist in GitHub history, but those versions
were not published to npm because the first trusted-publishing attempts failed.
Do not reuse those version numbers.

## Provenance Troubleshooting

If npm fails with an error like:

```text
Error verifying sigstore provenance bundle:
Failed to validate repository information
```

check `package.json`. The repository URL must match the GitHub repository from
the provenance statement:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/MkFastHQ/tanstarter-cli"
  }
}
```

Avoid changing this to lowercase owner names, `git+...`, or `.git` suffixes
unless npm provenance validation explicitly accepts the new form.

## GitHub Releases and Packages

The publish workflow creates a GitHub Release after npm publish succeeds.

The GitHub sidebar **Packages** section is separate from npmjs.com. Publishing
to the public npm registry does not populate GitHub Packages. Filling that
section would require a separate GitHub Packages publish flow, usually with a
scoped package name such as `@mkfasthq/tanstarter-cli`, which is not needed for
this CLI.
