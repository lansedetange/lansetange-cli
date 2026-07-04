import { runCommand, runCommandAndEcho, runInherited } from './commands.js';
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
  runCommandAndEcho(
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
  runCommandAndEcho(
    'pnpm',
    ['exec', 'wrangler', 'delete', config.projectName, '--force'],
    config
  );
}

export async function deleteR2(config: RuntimeConfig): Promise<void> {
  await emptyR2Bucket(config);
  runCommandAndEcho(
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

  runCommandAndEcho(
    'pnpm',
    [
      'exec',
      'wrangler',
      'kv',
      'namespace',
      'delete',
      '--namespace-id',
      config.kvNamespaceId,
      '--skip-confirmation',
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

async function emptyR2Bucket(config: RuntimeConfig): Promise<void> {
  let deletedCount = 0;

  console.log(`Emptying R2 bucket before deletion: ${config.r2BucketName}`);

  while (true) {
    const page = await listR2Objects(config);
    const objects = page.result.map((object) => object.key);
    if (objects.length === 0) break;

    for (const key of objects) {
      await deleteR2Object(config, key);
      deletedCount += 1;
    }
  }

  if (deletedCount > 0) {
    console.log(`Deleted ${deletedCount} R2 object(s) before deleting bucket.`);
  } else {
    console.log('R2 bucket is already empty.');
  }
}

async function listR2Objects(config: RuntimeConfig): Promise<R2ObjectListResponse> {
  const params = new URLSearchParams({ per_page: '1000' });

  const body = await cloudflareRequest<Array<{ key: string }>>(
    config,
    'GET',
    `${buildR2ObjectsPath(config)}?${params.toString()}`
  );

  const page: R2ObjectListResponse = {
    result: body.result,
  };
  return page;
}

async function deleteR2Object(
  config: RuntimeConfig,
  key: string
): Promise<void> {
  await cloudflareRequest(
    config,
    'DELETE',
    buildR2ObjectPath(config, key)
  );
}

export function buildR2ObjectsPath(config: RuntimeConfig): string {
  return `/accounts/${config.cloudflareAccountId}/r2/buckets/${encodeURIComponent(
    config.r2BucketName
  )}/objects`;
}

export function buildR2ObjectPath(config: RuntimeConfig, key: string): string {
  return `${buildR2ObjectsPath(config)}/${encodeURIComponent(key)}`;
}

async function cloudflareRequest<T = unknown>(
  config: RuntimeConfig,
  method: string,
  path: string
): Promise<CloudflareApiResponse<T>> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.cloudflareApiToken}`,
    },
  });
  const body = (await response.json().catch(() => undefined)) as
    | CloudflareApiResponse<T>
    | undefined;

  if (!response.ok || body?.success === false) {
    const errors = body?.errors?.map((error) => error.message).join('; ');
    throw new Error(
      `Cloudflare API ${method} ${path} failed: ${
        errors || response.statusText || response.status
      }`
    );
  }

  return body as CloudflareApiResponse<T>;
}

interface R2ObjectListResponse {
  result: Array<{ key: string }>;
}

interface CloudflareApiResponse<T> {
  success: boolean;
  result: T;
  errors?: Array<{ message: string }>;
}
