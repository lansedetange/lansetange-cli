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
import { ensureEnvFiles, formatEnvValue } from '../src/env.ts';
import { isCliEntrypoint } from '../src/index.ts';
import { getInstallPlan } from '../src/preflight.ts';
import { readExistingState, writeState } from '../src/state.ts';
import { disablePushDeployWorkflow } from '../src/template.ts';
import type { RuntimeConfig } from '../src/types.ts';
import {
  normalizeSlug,
  validateDomain,
  validateGithubRepo,
  validateSlug,
} from '../src/validators.ts';
import { stripJsonc } from '../src/wrangler-config.ts';

describe('parseArgs', () => {
  it('normalizes the project name and applies defaults', () => {
    const options = parseArgs(['My App']);

    expect(options.projectName).toBe('my-app');
    expect(options.targetDir).toBe(`${process.cwd()}/my-app`);
    expect(options.resume).toBe(false);
  });

  it('parses supported option values and boolean flags', () => {
    const options = parseArgs([
      'demo-app',
      '--domain=demo.example.com',
      '--repo',
      'mkfasthq/demo-app',
      '--resume',
    ]);

    expect(options).toMatchObject({
      projectName: 'demo-app',
      domain: 'demo.example.com',
      githubRepo: 'mkfasthq/demo-app',
      resume: true,
    });
    expect(options.targetDir).toBe(`${process.cwd()}/demo-app`);
  });

  it('parses the delete command', () => {
    const options = parseArgs(['delete', 'demo-app']);

    expect(options).toMatchObject({
      command: 'delete',
      projectName: 'demo-app',
    });
  });

  it('keeps destroy as a backwards-compatible alias', () => {
    const options = parseArgs(['destroy', 'demo-app']);

    expect(options.command).toBe('delete');
  });

  it('rejects unknown flags and missing project names', () => {
    expect(() => parseArgs(['--unknown'])).toThrow('Unknown option: --unknown');
    expect(() => parseArgs([])).toThrow('Project name is required.');
    expect(() => parseArgs(['demo-app', 'delete'])).toThrow(
      'delete must be the first positional argument.'
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

  it('validates GitHub repo names', () => {
    expect(() => validateGithubRepo('demo-app')).not.toThrow();
    expect(() => validateGithubRepo('mkfasthq/demo-app')).not.toThrow();
    expect(() => validateGithubRepo('mkfasthq/demo/app')).toThrow(
      '--repo must be a GitHub repo name or owner/name.'
    );
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

  it('keeps local env base URL on localhost', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanstarter-env-'));
    fs.writeFileSync(
      path.join(tempDir, '.env.example'),
      'VITE_BASE_URL=\nBETTER_AUTH_SECRET=\n',
      'utf8'
    );

    ensureEnvFiles({
      projectName: 'demo-app',
      targetDir: tempDir,
      domain: 'app.example.com',
      githubRepo: 'demo-app',
      cloudflareAccountId: 'account-id',
      cloudflareApiToken: 'api-token',
      d1DatabaseName: 'demo-app',
      d1DatabaseId: 'database-id',
      r2BucketName: 'demo-app',
      kvNamespaceName: 'demo-app',
      kvNamespaceId: '0123456789abcdef0123456789abcdef',
    });

    expect(fs.readFileSync(path.join(tempDir, '.env'), 'utf8')).toContain(
      "VITE_BASE_URL='http://localhost:3000'"
    );
    expect(
      fs.readFileSync(path.join(tempDir, '.env.production'), 'utf8')
    ).toContain("VITE_BASE_URL='https://app.example.com'");
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

describe('template updates', () => {
  it('disables push deploy workflow triggers', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tanstarter-template-'));
    const workflowsDir = path.join(tempDir, '.github', 'workflows');
    fs.mkdirSync(workflowsDir, { recursive: true });
    const workflowPath = path.join(workflowsDir, 'deploy.yml');
    fs.writeFileSync(
      workflowPath,
      [
        'name: Deploy to Cloudflare Workers',
        '',
        'on:',
        '  workflow_dispatch:',
        '  push:',
        '    branches:',
        '      - main',
        '',
      ].join('\n'),
      'utf8'
    );

    disablePushDeployWorkflow({
      projectName: 'demo-app',
      targetDir: tempDir,
      domain: '',
      githubRepo: 'demo-app',
      cloudflareAccountId: 'account-id',
      cloudflareApiToken: 'api-token',
      d1DatabaseName: 'demo-app',
      d1DatabaseId: 'database-id',
      r2BucketName: 'demo-app',
      kvNamespaceName: 'demo-app',
      kvNamespaceId: '0123456789abcdef0123456789abcdef',
    });

    const workflow = fs.readFileSync(workflowPath, 'utf8');

    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('push:');
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
