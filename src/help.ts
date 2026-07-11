import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function printHelp(): void {
  console.log(`TanStarter CLI

Usage:
  lansedetange-cli create [options]
  lansedetange-cli delete <project-name> [options]

Options:
  --repo <owner/name>     Create or use this GitHub repo
  --template <name>       Use mkfast-template or mkfast-app
  --domain <domain>       Cloudflare custom domain route
  --resume                Resume a failed setup with lansedetange-cli create <project-name> --resume
  -h, --help              Show help
  -v, --version           Show version

Required environment:
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN`);
}

export function printVersion(): void {
  const packagePath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
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
