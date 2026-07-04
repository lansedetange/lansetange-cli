import path from 'node:path';
import process from 'node:process';

import { DEFAULT_TEMPLATE_URL } from './constants.js';
import { printHelp, printVersion } from './help.js';
import type { CliOptions } from './types.js';
import { requireValue } from './utils.js';
import { normalizeSlug, validateSlug } from './validators.js';

export function parseArgs(args: string[]): CliOptions {
  let projectName = '';
  let templateUrl = DEFAULT_TEMPLATE_URL;
  let branch: string | undefined;
  let targetDir = '';
  let domain = '';
  let githubRepo: string | undefined;
  let yes = false;
  let resume = false;
  let skipInstall = false;
  let skipGithubRepo = false;
  let skipPush = false;
  let skipGithubSecrets = false;
  let skipWorkerSecrets = false;
  let skipDeploy = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;

    if (arg === '-h' || arg === '--help') {
      printHelp();
      process.exit(0);
    }
    if (arg === '-v' || arg === '--version') {
      printVersion();
      process.exit(0);
    }
    if (arg === '--yes' || arg === '-y') {
      yes = true;
      continue;
    }
    if (arg === '--resume') {
      resume = true;
      continue;
    }
    if (arg === '--skip-install') {
      skipInstall = true;
      continue;
    }
    if (arg === '--skip-github-repo') {
      skipGithubRepo = true;
      continue;
    }
    if (arg === '--skip-push') {
      skipPush = true;
      continue;
    }
    if (arg === '--skip-github-secrets') {
      skipGithubSecrets = true;
      continue;
    }
    if (arg === '--skip-worker-secrets') {
      skipWorkerSecrets = true;
      continue;
    }
    if (arg === '--skip-deploy') {
      skipDeploy = true;
      continue;
    }
    if (arg === '--template') {
      templateUrl = requireValue(args, ++index, '--template');
      continue;
    }
    if (arg.startsWith('--template=')) {
      templateUrl = arg.slice('--template='.length);
      continue;
    }
    if (arg === '--branch') {
      branch = requireValue(args, ++index, '--branch');
      continue;
    }
    if (arg.startsWith('--branch=')) {
      branch = arg.slice('--branch='.length);
      continue;
    }
    if (arg === '--dir') {
      targetDir = requireValue(args, ++index, '--dir');
      continue;
    }
    if (arg.startsWith('--dir=')) {
      targetDir = arg.slice('--dir='.length);
      continue;
    }
    if (arg === '--domain') {
      domain = requireValue(args, ++index, '--domain');
      continue;
    }
    if (arg.startsWith('--domain=')) {
      domain = arg.slice('--domain='.length);
      continue;
    }
    if (arg === '--github-repo') {
      githubRepo = requireValue(args, ++index, '--github-repo');
      continue;
    }
    if (arg.startsWith('--github-repo=')) {
      githubRepo = arg.slice('--github-repo='.length);
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (!projectName) {
      projectName = arg;
      continue;
    }
    throw new Error(`Unexpected argument: ${arg}`);
  }

  if (!projectName) {
    printHelp();
    throw new Error('Project name is required.');
  }

  const normalizedProjectName = normalizeSlug(projectName);
  validateSlug(normalizedProjectName, 'project name');

  return {
    projectName: normalizedProjectName,
    targetDir: path.resolve(process.cwd(), targetDir || normalizedProjectName),
    templateUrl,
    ...(branch ? { branch } : {}),
    domain,
    ...(githubRepo ? { githubRepo } : {}),
    yes,
    resume,
    skipInstall,
    skipGithubRepo,
    skipPush,
    skipGithubSecrets,
    skipWorkerSecrets,
    skipDeploy,
  };
}
