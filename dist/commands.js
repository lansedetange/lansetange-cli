import { execFileSync, spawnSync } from 'node:child_process';
import os from 'node:os';
import process from 'node:process';
import { bufferToString } from './utils.js';
export function runCommand(command, args, config) {
    printCommand(command, args);
    const result = spawnWithConfig(command, args, config.targetDir, config, 'pipe');
    if (result.status !== 0) {
        throw commandError(command, args, result);
    }
    return {
        stdout: bufferToString(result.stdout),
        stderr: bufferToString(result.stderr),
    };
}
export function runInherited(command, args, config) {
    printCommand(command, args);
    const result = spawnWithConfig(command, args, config.targetDir, config, 'inherit');
    if (result.status !== 0) {
        throw commandError(command, args, result);
    }
}
export function runInheritedNonInteractive(command, args, config) {
    printCommand(command, args);
    const result = spawnWithConfig(command, args, config.targetDir, config, ['ignore', 'inherit', 'inherit']);
    if (result.status !== 0) {
        throw commandError(command, args, result);
    }
}
export function runCommandAndEcho(command, args, config) {
    printCommand(command, args);
    const result = spawnWithConfig(command, args, config.targetDir, config, 'pipe');
    const stdout = bufferToString(result.stdout);
    const stderr = bufferToString(result.stderr);
    if (stdout)
        process.stdout.write(stdout);
    if (stderr)
        process.stderr.write(stderr);
    if (result.status !== 0) {
        throw commandError(command, args, result);
    }
    return { stdout, stderr };
}
export function runInheritedRaw(command, args, cwd) {
    printCommand(command, args);
    const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
    if (result.status !== 0) {
        throw commandError(command, args, result);
    }
}
export function runQuiet(command, args, cwd) {
    printCommand(command, args);
    const result = spawnSync(command, args, { cwd, stdio: 'ignore' });
    if (result.status !== 0) {
        throw new Error(`Command failed: ${[command, ...args].join(' ')}`);
    }
}
function printCommand(command, args) {
    console.log(`\n💻 $ ${formatCommand([command, ...args])}`);
}
function formatCommand(parts) {
    return parts.map(quoteArg).join(' ');
}
function quoteArg(value) {
    if (/^[A-Za-z0-9_./:=@%+-]+$/.test(value))
        return value;
    return JSON.stringify(value);
}
export function commandExists(command) {
    return spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0;
}
export function execVersion(command) {
    return execFileSync(command, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
}
function spawnWithConfig(command, args, cwd, config, stdio) {
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
function commandError(command, args, result) {
    const stdout = bufferToString(result.stdout).trim();
    const stderr = bufferToString(result.stderr).trim();
    return new Error([`Command failed: ${[command, ...args].join(' ')}`, stdout, stderr]
        .filter(Boolean)
        .join(os.EOL));
}
