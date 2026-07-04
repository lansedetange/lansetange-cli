import { describe, expect, it } from 'vitest';

import {
  formatEnvValue,
  normalizeSlug,
  parseArgs,
  parseD1DatabaseId,
  parseKVNamespaceId,
  stripJsonc,
  validateDomain,
  validateSlug,
} from '../src/index.ts';

describe('parseArgs', () => {
  it('normalizes the project name and applies defaults', () => {
    const options = parseArgs(['My App']);

    expect(options.projectName).toBe('my-app');
    expect(options.targetDir).toBe(`${process.cwd()}/my-app`);
    expect(options.templateUrl).toBe('https://github.com/MkFastHQ/mkfast-template.git');
    expect(options.yes).toBe(false);
    expect(options.resume).toBe(false);
  });

  it('parses option values and boolean flags', () => {
    const options = parseArgs([
      'demo-app',
      '--template',
      'https://example.com/template.git',
      '--branch=preview',
      '--dir',
      './target',
      '--domain=demo.example.com',
      '--github-repo',
      'mkfasthq/demo-app',
      '--skip-install',
      '--skip-github-repo',
      '--skip-push',
      '--skip-github-secrets',
      '--skip-worker-secrets',
      '--skip-deploy',
      '--resume',
      '--yes',
    ]);

    expect(options).toMatchObject({
      projectName: 'demo-app',
      templateUrl: 'https://example.com/template.git',
      branch: 'preview',
      domain: 'demo.example.com',
      githubRepo: 'mkfasthq/demo-app',
      skipInstall: true,
      skipGithubRepo: true,
      skipPush: true,
      skipGithubSecrets: true,
      skipWorkerSecrets: true,
      skipDeploy: true,
      resume: true,
      yes: true,
    });
    expect(options.targetDir).toBe(`${process.cwd()}/target`);
  });

  it('rejects unknown flags and missing project names', () => {
    expect(() => parseArgs(['--unknown'])).toThrow('Unknown option: --unknown');
    expect(() => parseArgs([])).toThrow('Project name is required.');
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
