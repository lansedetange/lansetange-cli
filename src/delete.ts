import { createInterface } from 'node:readline/promises';

import { deleteD1, deleteKV, deleteR2, deleteWorker } from './cloudflare.js';
import { deleteGithubRepo } from './git.js';
import type { CliOptions, RuntimeConfig } from './types.js';

export async function deleteProject(
  options: CliOptions,
  config: RuntimeConfig
): Promise<void> {
  await confirmDelete(options, config);

  console.log('\nDeleting TanStarter resources...');

  const failures: string[] = [];
  runDeleteStep(failures, 'Worker', () => deleteWorker(config));
  runDeleteStep(failures, 'KV namespace', () => deleteKV(config));
  runDeleteStep(failures, 'R2 bucket', () => deleteR2(config));
  runDeleteStep(failures, 'D1 database', () => deleteD1(config));
  runDeleteStep(failures, 'GitHub repo', () =>
    deleteGithubRepo(options, config)
  );

  if (failures.length > 0) {
    throw new Error(`Some resources could not be deleted: ${failures.join(', ')}`);
  }

  console.log('\nTanStarter resources were deleted.');
  console.log(`Local project directory was left in place: ${config.targetDir}`);
}

function runDeleteStep(
  failures: string[],
  label: string,
  action: () => void
): void {
  try {
    action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nCould not delete ${label}:\n${message}`);
    failures.push(label);
  }
}

async function confirmDelete(
  options: CliOptions,
  config: RuntimeConfig
): Promise<void> {
  console.log('\nTanStarter will delete:');
  console.log(`  Worker: ${config.projectName}`);
  if (config.domain) {
    console.log(`  Worker custom domain route: ${config.domain}`);
  }
  console.log(
    `  GitHub repo: ${options.githubRepo || config.githubRepo || config.projectName}`
  );
  console.log(`  D1 database: ${config.d1DatabaseName}`);
  console.log(`  R2 bucket: ${config.r2BucketName}`);
  console.log(`  KV namespace: ${config.kvNamespaceName}`);

  if (options.yes || !process.stdin.isTTY) return;

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question('\nType "delete" to continue: ');
    if (answer.trim() !== 'delete') {
      throw new Error('Delete cancelled.');
    }
  } finally {
    rl.close();
  }
}
