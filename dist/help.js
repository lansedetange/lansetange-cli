import fs from 'node:fs';
import path from 'node:path';
export function printHelp() {
    console.log(`TanStarter CLI

Usage:
  tanstarter <project-name> [options]

Options:
  --template <url>        Template git URL
  --branch <name>         Template branch
  --dir <path>            Target directory
  --domain <domain>       Cloudflare custom domain route
  --github-repo <repo>    Create or use this GitHub repo
  --skip-install          Skip pnpm install
  --skip-github-repo      Skip GitHub repository creation
  --skip-push             Skip initial commit and push
  --skip-github-secrets   Skip GitHub Actions secrets sync
  --skip-worker-secrets   Skip Cloudflare Worker secrets sync
  --skip-deploy           Skip deployment
  --resume                Resume from .tanstarter/state.json
  -y, --yes               Skip confirmation
  -h, --help              Show help
  -v, --version           Show version

Required environment:
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN`);
}
export function printVersion() {
    const packagePath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'package.json');
    try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        console.log(pkg.version ?? '0.0.0');
    }
    catch {
        console.log('0.0.0');
    }
}
