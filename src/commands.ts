import { execFileSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import os from 'node:os';
import process from 'node:process';

import type { CommandResult, RuntimeConfig } from './types.js';
import { bufferToString } from './utils.js';

export function runCommand(
  command: string,
  args: string[],
  config: RuntimeConfig
): CommandResult {
  const result = spawnWithConfig(command, args, config.targetDir, config, 'pipe');
  if (result.status !== 0) {
    throw commandError(command, args, result);
  }
  return {
    stdout: bufferToString(result.stdout),
    stderr: bufferToString(result.stderr),
  };
}

export function runInherited(
  command: string,
  args: string[],
  config: RuntimeConfig
): void {
  const result = spawnWithConfig(
    command,
    args,
    config.targetDir,
    config,
    'inherit'
  );
  if (result.status !== 0) {
    throw commandError(command, args, result);
  }
}

export function runInheritedRaw(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    throw commandError(command, args, result);
  }
}

export function runQuiet(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: 'ignore' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${[command, ...args].join(' ')}`);
  }
}

export function commandExists(command: string): boolean {
  return spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0;
}

export function execVersion(command: string): string {
  return execFileSync(command, ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function spawnWithConfig(
  command: string,
  args: string[],
  cwd: string,
  config: RuntimeConfig,
  stdio: 'pipe' | 'inherit'
): SpawnSyncReturns<Buffer> {
  return spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: config.cloudflareAccountId,
      CLOUDFLARE_API_TOKEN: config.cloudflareApiToken,
      CLOUDFLARE_DATABASE_ID: config.d1DatabaseId,
    },
    stdio,
  });
}

function commandError(
  command: string,
  args: string[],
  result: SpawnSyncReturns<Buffer>
): Error {
  const stdout = bufferToString(result.stdout).trim();
  const stderr = bufferToString(result.stderr).trim();
  return new Error(
    [`Command failed: ${[command, ...args].join(' ')}`, stdout, stderr]
      .filter(Boolean)
      .join(os.EOL)
  );
}
