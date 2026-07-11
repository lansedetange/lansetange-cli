import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import type { RuntimeConfig } from './types.js';

export function ensureEnvFiles(config: RuntimeConfig): void {
  const processEnvValues = getProcessEnvValuesFromExample(config.targetDir);
  const sharedValues: Record<string, string> = {
    CLOUDFLARE_ACCOUNT_ID: config.cloudflareAccountId,
    CLOUDFLARE_API_TOKEN: config.cloudflareApiToken,
    CLOUDFLARE_DATABASE_ID: config.d1DatabaseId,
  };

  for (const envFile of ['.env', '.env.production']) {
    const envPath = path.join(config.targetDir, envFile);
    ensureEnvFile(envPath, config.targetDir);
    const existing = parseEnvFile(envPath);
    const baseUrl =
      envFile === '.env'
        ? 'http://localhost:3000'
        : getProductionBaseUrl(config);
    const betterAuthSecret =
      existing.BETTER_AUTH_SECRET ||
      process.env.BETTER_AUTH_SECRET ||
      crypto.randomBytes(32).toString('base64url');

    updateEnvFile(envPath, {
      ...processEnvValues,
      ...sharedValues,
      VITE_BASE_URL: baseUrl,
      BETTER_AUTH_SECRET: betterAuthSecret,
    });
    if (envFile === '.env.production') {
      removeEmptyEnvValues(envPath);
    }
  }
}

function getProductionBaseUrl(config: RuntimeConfig): string {
  if (config.domain) return `https://${config.domain}`;
  return config.deploymentUrl || 'http://localhost:3000';
}

function ensureEnvFile(filePath: string, targetDir: string): void {
  if (fs.existsSync(filePath)) return;

  const examplePath = path.join(targetDir, '.env.example');
  const content = fs.existsSync(examplePath)
    ? fs.readFileSync(examplePath, 'utf8')
    : '';
  fs.writeFileSync(filePath, content, 'utf8');
}

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};

  const env: Record<string, string> = {};
  const content = fs.readFileSync(filePath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;

    const key = match[1];
    const rawValue = match[2];
    if (!key || rawValue === undefined) continue;
    env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }

  return env;
}

function getProcessEnvValuesFromExample(
  targetDir: string
): Record<string, string> {
  const examplePath = path.join(targetDir, '.env.example');
  if (!fs.existsSync(examplePath)) return {};

  const values: Record<string, string> = {};
  const example = parseEnvFile(examplePath);

  for (const key of Object.keys(example)) {
    const value = process.env[key];
    if (value !== undefined && value !== '') {
      values[key] = value;
    }
  }

  return values;
}

function updateEnvFile(filePath: string, values: Record<string, string>): void {
  const seen = new Set<string>();
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).map((line) => {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (!match) return line;

    const key = match[1];
    if (!key || !(key in values)) return line;

    seen.add(key);
    return `${key}=${formatEnvValue(values[key] ?? '')}`;
  });

  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key)) {
      lines.push(`${key}=${formatEnvValue(value)}`);
    }
  }

  fs.writeFileSync(
    filePath,
    `${lines.join('\n').replace(/\n+$/, '')}\n`,
    'utf8'
  );
}

function removeEmptyEnvValues(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter((line) => {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) return true;
    const rawValue = match[2]?.trim() ?? '';
    return rawValue !== '' && rawValue !== "''" && rawValue !== '""';
  });

  fs.writeFileSync(
    filePath,
    `${lines.join('\n').replace(/\n+$/, '')}\n`,
    'utf8'
  );
}

export function formatEnvValue(value: string): string {
  return `'${value.replace(/'/g, "\\'")}'`;
}
