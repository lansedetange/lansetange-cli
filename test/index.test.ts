import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseArgs } from '../src/args.ts';
import {
  parseD1DatabaseId,
  parseKVNamespaceId,
} from '../src/cloudflare.ts';
import { formatEnvValue } from '../src/env.ts';
import { isCliEntrypoint } from '../src/index.ts';
import { getInstallPlan } from '../src/preflight.ts';
import { readExistingState, writeState } from '../src/state.ts';
import type { RuntimeConfig } from '../src/types.ts';
import {
  normalizeSlug,
  validateDomain,
  validateSlug,
} from '../src/validators.ts';
import { stripJsonc } from '../src/wrangler-config.ts';

describe('parseArgs', () => {
  it('normalizes the project name and applies defaults', () => {
    const options = parseArgs(['My App']);

    expect(options.projectName).toBe('my-app');
    expect(options.targetDir).toBe(`${process.cwd()}/my-app`);
    expect(options.yes).toBe(false);
    expect(options.resume).toBe(false);
  });

  it('parses supported option values and boolean flags', () => {
    const options = parseArgs([
      'demo-app',
      '--domain=demo.example.com',
      '--repo',
      'mkfasthq/demo-app',
      '--resume',
      '--yes',
    ]);

    expect(options).toMatchObject({
      projectName: 'demo-app',
      domain: 'demo.example.com',
      githubRepo: 'mkfasthq/demo-app',
      resume: true,
      yes: true,
    });
    expect(options.targetDir).toBe(`${process.cwd()}/demo-app`);
  });

  it('parses the destroy command', () => {
    const options = parseArgs(['destroy', 'demo-app', '--yes']);

    expect(options).toMatchObject({
      command: 'destroy',
      projectName: 'demo-app',
      yes: true,
    });
  });

  it('rejects unknown flags and missing project names', () => {
    expect(() => parseArgs(['--unknown'])).toThrow('Unknown option: --unknown');
    expect(() => parseArgs([])).toThrow('Project name is required.');
    expect(() => parseArgs(['demo-app', 'destroy'])).toThrow(
      'destroy must be the first positional argument.'
    );
  });
});

describe('validation helpers', () => {
  it('normalizes slugs consistently', () => {
    expect(normalizeSlug('  Hello, TanStarter!!  ')).toBe('hello-tanstarter');
    expect(normalizeSlug('A---B___C')).toBe('a-b-c');
  });

  it('validates slug shape', () => {
    expect(() => validateSlug('abc', 'project name')).not.toThrow();
    expect(() => validateSlug('ab', 'project name')).toThrow('project name must be 3-63 chars');
    expect(() => validateSlug('-abc', 'project name')).toThrow('project name must be 3-63 chars');
  });

  it('validates simple domain names', () => {
    expect(() => validateDomain('app.example.com')).not.toThrow();
    expect(() => validateDomain('-bad.example.com')).toThrow('--domain must be a valid domain name.');
  });
});

describe('wrangler output parsing', () => {
  it('parses D1 database ids from JSON-like and plain output', () => {
    const id = '12345678-1234-1234-1234-123456789abc';

    expect(parseD1DatabaseId(`"database_id": "${id}"`)).toBe(id);
    expect(parseD1DatabaseId(`Created database ${id}`)).toBe(id);
  });

  it('parses KV namespace ids from JSON-like and plain output', () => {
    const id = '0123456789abcdef0123456789abcdef';

    expect(parseKVNamespaceId(`id = "${id}"`)).toBe(id);
    expect(parseKVNamespaceId(`namespace ${id} created`)).toBe(id);
  });
});

describe('file content helpers', () => {
  it('strips JSONC comments and trailing commas', () => {
    const jsonc = `{
      // comment
      "name": "demo",
      "nested": {
        "enabled": true,
      },
    }`;

    expect(JSON.parse(stripJsonc(jsonc))).toEqual({
      name: 'demo',
      nested: { enabled: true },
    });
  });

  it('quotes env values and escapes single quotes', () => {
    expect(formatEnvValue("that's fine")).toBe("'that\\'s fine'");
  });
});

describe('setup state', () => {
  it('normalizes older state files without a stored GitHub repo', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanstarter-state-'));
    const config = {
      projectName: 'demo-app',
      targetDir: tempDir,
      domain: '',
      cloudflareAccountId: 'account-id',
      cloudflareApiToken: 'api-token',
      d1DatabaseName: 'demo-app',
      d1DatabaseId: 'database-id',
      r2BucketName: 'demo-app',
      kvNamespaceName: 'demo-app',
      kvNamespaceId: '0123456789abcdef0123456789abcdef',
    } as RuntimeConfig;

    writeState(tempDir, {
      completedSteps: [],
      config,
      updatedAt: new Date().toISOString(),
    });

    const state = readExistingState(tempDir);

    expect(state.config.githubRepo).toBe('demo-app');
  });
});

describe('install planning', () => {
  const has = (...commands: string[]) => (command: string) =>
    commands.includes(command);

  it('uses corepack for pnpm when available', () => {
    expect(getInstallPlan('pnpm', 'darwin', has('corepack'))).toEqual([
      { command: 'corepack', args: ['enable'] },
      { command: 'corepack', args: ['prepare', 'pnpm@latest', '--activate'] },
    ]);
  });

  it('uses Homebrew for GitHub CLI on macOS', () => {
    expect(getInstallPlan('gh', 'darwin', has('brew'))).toEqual([
      { command: 'brew', args: ['install', 'gh'] },
    ]);
  });

  it('uses sudo apt-get for git on non-root Linux', () => {
    expect(getInstallPlan('git', 'linux', has('apt-get'), false)).toEqual([
      { command: 'sudo', args: ['apt-get', 'update'] },
      { command: 'sudo', args: ['apt-get', 'install', '-y', 'git'] },
    ]);
  });
});

describe('entrypoint detection', () => {
  it('treats npm bin symlinks as the CLI entrypoint', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanstarter-bin-'));
    const realEntrypoint = path.join(tempDir, 'index.js');
    const symlinkEntrypoint = path.join(tempDir, 'tanstarter');

    fs.writeFileSync(realEntrypoint, '#!/usr/bin/env node\n', 'utf8');
    fs.symlinkSync(realEntrypoint, symlinkEntrypoint);

    expect(
      isCliEntrypoint(symlinkEntrypoint, pathToFileURL(realEntrypoint).href)
    ).toBe(true);
  });
});
