import type { CliOptions, RuntimeConfig } from './types.js';
import { requireEnv } from './utils.js';
import { validateDomain } from './validators.js';

export function createConfig(options: CliOptions): RuntimeConfig {
  const cloudflareAccountId = requireEnv('CLOUDFLARE_ACCOUNT_ID');
  const cloudflareApiToken = requireEnv('CLOUDFLARE_API_TOKEN');

  if (options.domain) {
    validateDomain(options.domain);
  }

  return {
    projectName: options.projectName,
    targetDir: options.targetDir,
    domain: options.domain,
    githubRepo: options.githubRepo || options.projectName,
    cloudflareAccountId,
    cloudflareApiToken,
    d1DatabaseName: options.projectName,
    d1DatabaseId: '',
    r2BucketName: options.projectName,
    kvNamespaceName: options.projectName,
    kvNamespaceId: '',
  };
}
