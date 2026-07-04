import { createInterface } from 'node:readline/promises';

import type { CliOptions, RuntimeConfig } from './types.js';
import {
  validateDomain,
  validateGithubRepo,
  validateSlug,
} from './validators.js';

export async function configureSetup(
  options: CliOptions,
  config: RuntimeConfig
): Promise<RuntimeConfig> {
  if (!process.stdin.isTTY || options.resume) return config;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const nextConfig = await promptForMissingOptions(rl, options, config);
    await confirmSetup(rl, nextConfig);
    return nextConfig;
  } finally {
    rl.close();
  }
}

async function promptForMissingOptions(
  rl: ReturnType<typeof createInterface>,
  options: CliOptions,
  config: RuntimeConfig
): Promise<RuntimeConfig> {
  let domain = config.domain;
  let githubRepo = config.githubRepo;

  const d1DatabaseName = await askResourceName(
    rl,
    'D1 database',
    config.d1DatabaseName
  );
  const r2BucketName = await askResourceName(
    rl,
    'R2 bucket',
    config.r2BucketName
  );
  const kvNamespaceName = await askResourceName(
    rl,
    'KV namespace',
    config.kvNamespaceName
  );

  if (!options.domain) {
    domain = await askDomain(rl);
  }

  if (!options.githubRepo) {
    githubRepo = await askGithubRepo(rl, config.githubRepo);
  }

  return {
    ...config,
    domain,
    githubRepo,
    d1DatabaseName,
    r2BucketName,
    kvNamespaceName,
  };
}

async function confirmSetup(
  rl: ReturnType<typeof createInterface>,
  config: RuntimeConfig
): Promise<void> {
  console.log('\nTanStarter will create:');
  console.log(`  Project: ${config.projectName}`);
  console.log(`  Directory: ${config.targetDir}`);
  console.log(`  Worker: ${config.projectName}`);
  console.log(`  D1 database: ${config.d1DatabaseName}`);
  console.log(`  R2 bucket: ${config.r2BucketName}`);
  console.log(`  KV namespace: ${config.kvNamespaceName}`);
  console.log(`  Domain: ${config.domain || '(none)'}`);
  console.log(`  GitHub repo: ${config.githubRepo}`);

  const answer = await rl.question(
    '\nPress Enter to continue, or type n to cancel [Y/n]: '
  );
  if (answer.trim() && !/^y(es)?$/i.test(answer.trim())) {
    throw new Error('Setup cancelled.');
  }
}

async function askDomain(
  rl: ReturnType<typeof createInterface>
): Promise<string> {
  while (true) {
    const answer = await rl.question(
      '\nCustom domain (optional, press Enter to skip): '
    );
    const domain = answer.trim();
    if (!domain) return '';

    try {
      validateDomain(domain);
      return domain;
    } catch (error) {
      console.log(error instanceof Error ? error.message : String(error));
    }
  }
}

async function askResourceName(
  rl: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: string
): Promise<string> {
  while (true) {
    const answer = await rl.question(
      `${label} name (default: ${defaultValue}, press Enter to use default): `
    );
    const value = answer.trim() || defaultValue;

    try {
      validateSlug(value, label);
      return value;
    } catch (error) {
      console.log(error instanceof Error ? error.message : String(error));
    }
  }
}

async function askGithubRepo(
  rl: ReturnType<typeof createInterface>,
  defaultRepo: string
): Promise<string> {
  while (true) {
    const answer = await rl.question(
      `GitHub repo (default: ${defaultRepo}, press Enter to use default): `
    );
    const repo = answer.trim() || defaultRepo;

    try {
      validateGithubRepo(repo);
      return repo;
    } catch (error) {
      console.log(error instanceof Error ? error.message : String(error));
    }
  }
}
