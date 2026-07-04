import fs from 'node:fs';
import path from 'node:path';

export function printHelp(): void {
  console.log(`TanStarter CLI

Usage:
  tanstarter <project-name> [options]
  tanstarter delete <project-name> [options]

Options:
  --repo <owner/name>     Create or use this GitHub repo
  --domain <domain>       Cloudflare custom domain route
  --resume                Resume from .tanstarter/state.json
  -h, --help              Show help
  -v, --version           Show version

Required environment:
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN`);
}

export function printVersion(): void {
  const packagePath = path.resolve(
    path.dirname(new URL(import.meta.url).pathname),
    '..',
    'package.json'
  );

  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as {
      version?: string;
    };
    console.log(pkg.version ?? '0.0.0');
  } catch {
    console.log('0.0.0');
  }
}
