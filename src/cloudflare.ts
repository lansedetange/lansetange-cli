import { runCommand, runInherited } from './commands.js';
import type { RuntimeConfig } from './types.js';

export function cloudflareAuth(config: RuntimeConfig): void {
  runInherited('pnpm', ['exec', 'wrangler', 'whoami'], config);
}

export function createD1(config: RuntimeConfig): RuntimeConfig {
  if (config.d1DatabaseId) return config;

  const result = runCommand(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'create',
      config.d1DatabaseName,
      '--update-config=false',
    ],
    config
  );
  const outputText = `${result.stdout}\n${result.stderr}`;
  const databaseId = parseD1DatabaseId(outputText);

  if (!databaseId) {
    throw new Error(
      `Could not parse D1 database_id from Wrangler output:\n${outputText}`
    );
  }

  return { ...config, d1DatabaseId: databaseId };
}

export function createR2(config: RuntimeConfig): void {
  runInherited(
    'pnpm',
    [
      'exec',
      'wrangler',
      'r2',
      'bucket',
      'create',
      config.r2BucketName,
      '--update-config=false',
    ],
    config
  );
}

export function createKV(config: RuntimeConfig): RuntimeConfig {
  if (config.kvNamespaceId) return config;

  const result = runCommand(
    'pnpm',
    [
      'exec',
      'wrangler',
      'kv',
      'namespace',
      'create',
      config.kvNamespaceName,
      '--update-config=false',
    ],
    config
  );
  const outputText = `${result.stdout}\n${result.stderr}`;
  const namespaceId = parseKVNamespaceId(outputText);

  if (!namespaceId) {
    throw new Error(
      `Could not parse KV namespace id from Wrangler output:\n${outputText}`
    );
  }

  return { ...config, kvNamespaceId: namespaceId };
}

export function deleteD1(config: RuntimeConfig): void {
  runInherited(
    'pnpm',
    [
      'exec',
      'wrangler',
      'd1',
      'delete',
      config.d1DatabaseName,
      '--skip-confirmation',
    ],
    config
  );
}

export function deleteWorker(config: RuntimeConfig): void {
  runInherited(
    'pnpm',
    ['exec', 'wrangler', 'delete', config.projectName, '--force'],
    config
  );
}

export function deleteR2(config: RuntimeConfig): void {
  runInherited(
    'pnpm',
    ['exec', 'wrangler', 'r2', 'bucket', 'delete', config.r2BucketName],
    config
  );
}

export function deleteKV(config: RuntimeConfig): void {
  if (!config.kvNamespaceId) {
    console.log('KV namespace id is missing; skipping KV deletion.');
    return;
  }

  runInherited(
    'pnpm',
    [
      'exec',
      'wrangler',
      'kv',
      'namespace',
      'delete',
      '--namespace-id',
      config.kvNamespaceId,
    ],
    config
  );
}

export function parseD1DatabaseId(output: string): string | undefined {
  const databaseIdMatch = output.match(
    /database_id["'\s:=]+([0-9a-f]{8}-[0-9a-f-]{27})/i
  );
  if (databaseIdMatch) return databaseIdMatch[1];

  return output.match(/[0-9a-f]{8}-[0-9a-f-]{27}/i)?.[0];
}

export function parseKVNamespaceId(output: string): string | undefined {
  const idMatch = output.match(/\bid["'\s:=]+([0-9a-f]{32})\b/i);
  if (idMatch) return idMatch[1];

  return output.match(/\b[0-9a-f]{32}\b/i)?.[0];
}
