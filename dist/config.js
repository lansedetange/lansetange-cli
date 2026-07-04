import { requireEnv } from './utils.js';
import { validateDomain, validateGithubRepo } from './validators.js';
export function createConfig(options) {
    const cloudflareAccountId = requireEnv('CLOUDFLARE_ACCOUNT_ID');
    const cloudflareApiToken = requireEnv('CLOUDFLARE_API_TOKEN');
    if (options.domain) {
        validateDomain(options.domain);
    }
    if (options.githubRepo) {
        validateGithubRepo(options.githubRepo);
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
