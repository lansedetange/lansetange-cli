#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
const DEFAULT_TEMPLATE_URL = 'https://github.com/MkFastHQ/mkfast-template.git';
const STATE_DIR = '.tanstarter';
const STATE_FILE = 'state.json';
const REQUIRED_COMMANDS = ['node', 'pnpm', 'git', 'gh', 'wrangler'];
const CLOUDFLARE_DOCS_URL = 'https://docs.tanstarter.dev/docs/cloudflare';
const INSTALL_NOTES = {
    pnpm: 'https://pnpm.io/installation',
    git: 'https://git-scm.com/downloads',
    gh: 'https://cli.github.com/',
    wrangler: 'https://developers.cloudflare.com/workers/wrangler/install-and-update/',
};
async function main() {
    const options = parseArgs(process.argv.slice(2));
    const initialConfig = createRuntimeConfig(options);
    let state = options.resume
        ? readState(options.targetDir, initialConfig)
        : {
            completedSteps: [],
            config: initialConfig,
            updatedAt: new Date().toISOString(),
        };
    const steps = [
        { id: 'preflight', run: () => preflight(state.config) },
        { id: 'clone-template', run: () => cloneTemplate(options) },
        { id: 'initialize-git', run: () => initializeGit(state.config.targetDir) },
        {
            id: 'install',
            run: () => {
                if (options.skipInstall) {
                    console.log('Skipping pnpm install.');
                    return;
                }
                runInherited('pnpm', ['install'], state.config);
            },
        },
        { id: 'cloudflare-auth', run: () => cloudflareAuth(state.config) },
        {
            id: 'create-d1',
            run: () => {
                const nextConfig = createD1(state.config);
                state = writeState(state.config.targetDir, {
                    ...state,
                    config: nextConfig,
                });
            },
        },
        {
            id: 'create-r2',
            run: () => createR2(state.config),
        },
        {
            id: 'create-kv',
            run: () => {
                const nextConfig = createKV(state.config);
                state = writeState(state.config.targetDir, {
                    ...state,
                    config: nextConfig,
                });
            },
        },
        {
            id: 'write-config',
            run: () => {
                writeWranglerConfig(state.config);
                ensureEnvFiles(state.config);
                updatePackageName(state.config);
            },
        },
        {
            id: 'cf-typegen',
            run: () => runInherited('pnpm', ['run', 'cf-typegen'], state.config),
        },
        {
            id: 'db-migrate-local',
            run: () => runInherited('pnpm', ['run', 'db:migrate:local'], state.config),
        },
        {
            id: 'db-migrate-remote',
            run: () => runInherited('pnpm', ['run', 'db:migrate:remote'], state.config),
        },
        {
            id: 'sync-worker-secrets',
            run: () => {
                if (options.skipWorkerSecrets) {
                    console.log('Skipping Worker secrets sync.');
                    return;
                }
                runInherited('pnpm', ['run', 'sync-worker-secrets'], state.config);
            },
        },
        {
            id: 'create-github-repo',
            run: () => {
                if (options.skipGithubRepo) {
                    console.log('Skipping GitHub repository creation.');
                    return;
                }
                createGithubRepo(options, state.config);
            },
        },
        {
            id: 'sync-github-secrets',
            run: () => {
                if (options.skipGithubSecrets || options.skipGithubRepo) {
                    console.log('Skipping GitHub secrets sync.');
                    return;
                }
                const args = ['run', 'sync-github-secrets'];
                if (options.githubRepo) {
                    args.push('--', '--repo', options.githubRepo);
                }
                runInherited('pnpm', args, state.config);
            },
        },
        { id: 'build', run: () => runInherited('pnpm', ['run', 'build'], state.config) },
        {
            id: 'commit-and-push',
            run: () => {
                if (options.skipPush) {
                    console.log('Skipping initial commit and push.');
                    return;
                }
                commitAndPush(state.config);
            },
        },
        {
            id: 'deploy',
            run: () => {
                if (options.skipDeploy) {
                    console.log('Skipping deploy.');
                    return;
                }
                runInherited('pnpm', ['run', 'deploy'], state.config);
            },
        },
    ];
    await confirmSetup(options, state.config);
    for (const step of steps) {
        if (state.completedSteps.includes(step.id)) {
            console.log(`✓ ${step.id} already completed`);
            continue;
        }
        console.log(`\n→ ${step.id}`);
        await step.run();
        state = markCompleted(state.config.targetDir, state, step.id);
    }
    console.log(`\nTanStarter project is ready: ${state.config.targetDir}`);
}
export function parseArgs(args) {
    let projectName = '';
    let templateUrl = DEFAULT_TEMPLATE_URL;
    let branch;
    let targetDir = '';
    let domain = '';
    let githubRepo;
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
        if (!arg)
            continue;
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
function createRuntimeConfig(options) {
    const cloudflareAccountId = requireEnv('CLOUDFLARE_ACCOUNT_ID');
    const cloudflareApiToken = requireEnv('CLOUDFLARE_API_TOKEN');
    if (options.domain) {
        validateDomain(options.domain);
    }
    return {
        projectName: options.projectName,
        targetDir: options.targetDir,
        domain: options.domain,
        cloudflareAccountId,
        cloudflareApiToken,
        d1DatabaseName: options.projectName,
        d1DatabaseId: '',
        r2BucketName: options.projectName,
        kvNamespaceName: options.projectName,
        kvNamespaceId: '',
    };
}
async function confirmSetup(options, config) {
    if (options.yes || !process.stdin.isTTY || options.resume)
        return;
    console.log('\nTanStarter will create:');
    console.log(`  Project: ${config.projectName}`);
    console.log(`  Directory: ${config.targetDir}`);
    console.log(`  Template: ${options.templateUrl}`);
    console.log(`  Worker: ${config.projectName}`);
    console.log(`  D1 database: ${config.d1DatabaseName}`);
    console.log(`  R2 bucket: ${config.r2BucketName}`);
    console.log(`  KV namespace: ${config.kvNamespaceName}`);
    console.log(`  Domain: ${config.domain || '(none)'}`);
    console.log(`  GitHub repo: ${options.skipGithubRepo
        ? '(skipped)'
        : options.githubRepo || config.projectName}`);
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        const answer = await rl.question('\nContinue? [Y/n] ');
        if (answer.trim() && !/^y(es)?$/i.test(answer.trim())) {
            throw new Error('Setup cancelled.');
        }
    }
    finally {
        rl.close();
    }
}
function preflight(config) {
    console.log('Checking local prerequisites...');
    ensureRequiredCommands();
    for (const command of REQUIRED_COMMANDS) {
        console.log(`✓ ${command} ${execVersion(command).split('\n')[0]}`);
    }
    runQuiet('gh', ['auth', 'status'], process.cwd());
    console.log('✓ GitHub CLI authenticated');
    checkGitIdentity();
    console.log('✓ Git author identity configured');
    console.log(`✓ CLOUDFLARE_ACCOUNT_ID=${config.cloudflareAccountId}`);
    console.log(`✓ CLOUDFLARE_API_TOKEN=${maskSecret(config.cloudflareApiToken)}`);
    runQuietWithCloudflareEnv('wrangler', ['whoami'], process.cwd(), config);
    console.log('✓ Cloudflare credentials accepted by wrangler');
    console.log(`Cloudflare setup docs: ${CLOUDFLARE_DOCS_URL}`);
}
function ensureRequiredCommands() {
    for (const command of REQUIRED_COMMANDS) {
        if (commandExists(command))
            continue;
        installMissingCommand(command);
        if (!commandExists(command)) {
            throw new Error(`${command} is required but could not be installed automatically. Install it manually: ${INSTALL_NOTES[command] ?? 'check your package manager docs'}`);
        }
    }
}
function installMissingCommand(command) {
    if (command === 'node') {
        throw new Error('node is required to run TanStarter CLI.');
    }
    const steps = getInstallPlan(command, process.platform, commandExists, typeof process.getuid === 'function' && process.getuid() === 0);
    if (steps.length === 0) {
        throw new Error(`${command} is required but TanStarter CLI could not find a supported installer. Install it manually: ${INSTALL_NOTES[command] ?? 'check your package manager docs'}`);
    }
    console.log(`Installing missing command: ${command}`);
    for (const step of steps) {
        console.log(`→ ${[step.command, ...step.args].join(' ')}`);
        runInheritedRaw(step.command, step.args, process.cwd());
    }
}
function cloneTemplate(options) {
    if (options.resume && fs.existsSync(options.targetDir)) {
        console.log('Project directory already exists; skipping clone.');
        return;
    }
    if (fs.existsSync(options.targetDir)) {
        const entries = fs.readdirSync(options.targetDir);
        if (entries.length > 0) {
            throw new Error(`Target directory is not empty: ${options.targetDir}`);
        }
    }
    const args = ['clone', '--depth', '1'];
    if (options.branch) {
        args.push('--branch', options.branch);
    }
    args.push(options.templateUrl, options.targetDir);
    runInheritedRaw('git', args, process.cwd());
}
function initializeGit(targetDir) {
    ensureGitignoreEntry(targetDir, STATE_DIR);
    const gitDir = path.join(targetDir, '.git');
    if (fs.existsSync(gitDir)) {
        fs.rmSync(gitDir, { recursive: true, force: true });
    }
    runInheritedRaw('git', ['init'], targetDir);
    runInheritedRaw('git', ['add', '.'], targetDir);
}
function createGithubRepo(options, config) {
    if (gitRemoteExists(config.targetDir, 'origin')) {
        console.log('Git remote origin already exists; skipping repo creation.');
        return;
    }
    const repo = options.githubRepo || config.projectName;
    const viewResult = spawnSync('gh', ['repo', 'view', repo], {
        cwd: config.targetDir,
        stdio: 'ignore',
    });
    if (viewResult.status === 0) {
        const remoteUrl = getGithubRepoUrl(repo, config.targetDir);
        runInheritedRaw('git', ['remote', 'add', 'origin', remoteUrl], config.targetDir);
        return;
    }
    runInheritedRaw('gh', ['repo', 'create', repo, '--private', '--source=.', '--remote=origin'], config.targetDir);
}
function commitAndPush(config) {
    if (!gitRemoteExists(config.targetDir, 'origin')) {
        console.log('Git remote origin is not configured; skipping push.');
        return;
    }
    runInheritedRaw('git', ['add', '.'], config.targetDir);
    if (hasGitChanges(config.targetDir)) {
        runInheritedRaw('git', ['commit', '-m', 'chore: initialize TanStarter project'], config.targetDir);
    }
    else if (!hasGitCommit(config.targetDir)) {
        console.log('No files to commit; skipping push.');
        return;
    }
    runInheritedRaw('git', ['branch', '-M', 'main'], config.targetDir);
    runInheritedRaw('git', ['push', '-u', 'origin', 'main'], config.targetDir);
}
function cloudflareAuth(config) {
    runInherited('pnpm', ['exec', 'wrangler', 'whoami'], config);
}
function createD1(config) {
    if (config.d1DatabaseId)
        return config;
    const result = runCommand('pnpm', [
        'exec',
        'wrangler',
        'd1',
        'create',
        config.d1DatabaseName,
        '--update-config=false',
    ], config);
    const outputText = `${result.stdout}\n${result.stderr}`;
    const databaseId = parseD1DatabaseId(outputText);
    if (!databaseId) {
        throw new Error(`Could not parse D1 database_id from Wrangler output:\n${outputText}`);
    }
    return { ...config, d1DatabaseId: databaseId };
}
function createR2(config) {
    runInherited('pnpm', [
        'exec',
        'wrangler',
        'r2',
        'bucket',
        'create',
        config.r2BucketName,
        '--update-config=false',
    ], config);
}
function createKV(config) {
    if (config.kvNamespaceId)
        return config;
    const result = runCommand('pnpm', ['exec', 'wrangler', 'kv', 'namespace', 'create', config.kvNamespaceName], config);
    const outputText = `${result.stdout}\n${result.stderr}`;
    const namespaceId = parseKVNamespaceId(outputText);
    if (!namespaceId) {
        throw new Error(`Could not parse KV namespace id from Wrangler output:\n${outputText}`);
    }
    return { ...config, kvNamespaceId: namespaceId };
}
function writeWranglerConfig(config) {
    const wranglerPath = path.join(config.targetDir, 'wrangler.jsonc');
    const wranglerConfig = readWranglerConfig(wranglerPath);
    const next = {
        ...wranglerConfig,
        name: config.projectName,
        d1_databases: [
            {
                binding: 'DB',
                database_name: config.d1DatabaseName,
                database_id: config.d1DatabaseId,
                migrations_dir: './src/db/migrations',
            },
        ],
        r2_buckets: [
            {
                bucket_name: config.r2BucketName,
                binding: 'BUCKET',
            },
        ],
        kv_namespaces: [
            {
                binding: 'CACHE',
                id: config.kvNamespaceId,
            },
        ],
    };
    if (config.domain) {
        next.routes = [
            {
                pattern: config.domain,
                custom_domain: true,
            },
        ];
    }
    else {
        delete next.routes;
    }
    let jsonc = JSON.stringify(next, null, 2);
    if (!config.domain) {
        const commentedRoutes = [
            '  // Custom domains are disabled by TanStarter CLI.',
            '  // Pass --domain example.com to enable routes.',
            '  // "routes": [',
            '  //   {',
            '  //     "pattern": "example.com",',
            '  //     "custom_domain": true',
            '  //   }',
            '  // ],',
            '',
        ].join('\n');
        jsonc = jsonc.replace(/\n {2}"d1_databases"/, `\n${commentedRoutes}  "d1_databases"`);
    }
    fs.writeFileSync(wranglerPath, `${jsonc}\n`, 'utf8');
}
function ensureEnvFiles(config) {
    const baseUrl = config.domain
        ? `https://${config.domain}`
        : 'http://localhost:3000';
    const processEnvValues = getProcessEnvValuesFromExample(config.targetDir);
    const values = {
        VITE_BASE_URL: baseUrl,
        CLOUDFLARE_ACCOUNT_ID: config.cloudflareAccountId,
        CLOUDFLARE_API_TOKEN: config.cloudflareApiToken,
        CLOUDFLARE_DATABASE_ID: config.d1DatabaseId,
    };
    for (const envFile of ['.env', '.env.production']) {
        const envPath = path.join(config.targetDir, envFile);
        ensureEnvFile(envPath, config.targetDir);
        const existing = parseEnvFile(envPath);
        const betterAuthSecret = existing.BETTER_AUTH_SECRET ||
            process.env.BETTER_AUTH_SECRET ||
            crypto.randomBytes(32).toString('base64url');
        updateEnvFile(envPath, {
            ...processEnvValues,
            ...values,
            BETTER_AUTH_SECRET: betterAuthSecret,
        });
    }
}
function updatePackageName(config) {
    const packagePath = path.join(config.targetDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    packageJson.name = config.projectName;
    fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}
function readState(targetDir, fallbackConfig) {
    const statePath = path.join(targetDir, STATE_DIR, STATE_FILE);
    if (!fs.existsSync(statePath)) {
        return writeState(targetDir, {
            completedSteps: [],
            config: fallbackConfig,
            updatedAt: new Date().toISOString(),
        });
    }
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return {
        ...state,
        config: {
            ...fallbackConfig,
            ...state.config,
            kvNamespaceName: state.config.kvNamespaceName || fallbackConfig.kvNamespaceName,
            kvNamespaceId: state.config.kvNamespaceId || fallbackConfig.kvNamespaceId,
        },
    };
}
function writeState(targetDir, state) {
    const next = { ...state, updatedAt: new Date().toISOString() };
    const statePath = path.join(targetDir, STATE_DIR, STATE_FILE);
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, `${JSON.stringify(next, null, 2)}\n`);
    return next;
}
function markCompleted(targetDir, state, step) {
    const completedSteps = state.completedSteps.includes(step)
        ? state.completedSteps
        : [...state.completedSteps, step];
    const next = {
        ...state,
        completedSteps,
        updatedAt: new Date().toISOString(),
    };
    if (!fs.existsSync(targetDir)) {
        return next;
    }
    return writeState(targetDir, next);
}
function runCommand(command, args, config) {
    const result = spawn(command, args, config.targetDir, config, 'pipe');
    if (result.status !== 0) {
        throw commandError(command, args, result);
    }
    return {
        stdout: bufferToString(result.stdout),
        stderr: bufferToString(result.stderr),
    };
}
function runInherited(command, args, config) {
    const result = spawn(command, args, config.targetDir, config, 'inherit');
    if (result.status !== 0) {
        throw commandError(command, args, result);
    }
}
function runInheritedRaw(command, args, cwd) {
    const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
    if (result.status !== 0) {
        throw commandError(command, args, result);
    }
}
function runQuiet(command, args, cwd) {
    const result = spawnSync(command, args, { cwd, stdio: 'ignore' });
    if (result.status !== 0) {
        throw new Error(`Command failed: ${[command, ...args].join(' ')}`);
    }
}
function checkGitIdentity() {
    const email = spawnSync('git', ['config', '--get', 'user.email'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    const name = spawnSync('git', ['config', '--get', 'user.name'], {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (email.status !== 0 ||
        name.status !== 0 ||
        typeof email.stdout !== 'string' ||
        typeof name.stdout !== 'string' ||
        email.stdout.trim() === '' ||
        name.stdout.trim() === '') {
        throw new Error('Git user.name and user.email are required for the initial commit.');
    }
}
function runQuietWithCloudflareEnv(command, args, cwd, config) {
    const result = spawnSync(command, args, {
        cwd,
        env: {
            ...process.env,
            CLOUDFLARE_ACCOUNT_ID: config.cloudflareAccountId,
            CLOUDFLARE_API_TOKEN: config.cloudflareApiToken,
        },
        stdio: 'ignore',
    });
    if (result.status !== 0) {
        throw new Error(`Command failed: ${[command, ...args].join(' ')}`);
    }
}
function gitRemoteExists(cwd, remote) {
    const result = spawnSync('git', ['remote', 'get-url', remote], {
        cwd,
        stdio: 'ignore',
    });
    return result.status === 0;
}
function hasGitChanges(cwd) {
    const result = spawnSync('git', ['status', '--porcelain'], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    return typeof result.stdout === 'string' && result.stdout.trim() !== '';
}
function hasGitCommit(cwd) {
    const result = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], {
        cwd,
        stdio: 'ignore',
    });
    return result.status === 0;
}
function getGithubRepoUrl(repo, cwd) {
    const result = spawnSync('gh', ['repo', 'view', repo, '--json', 'url', '--jq', '.url'], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (result.status !== 0 || typeof result.stdout !== 'string') {
        throw new Error(`Could not resolve GitHub repo URL for ${repo}.`);
    }
    return `${result.stdout.trim().replace(/\.git$/, '')}.git`;
}
function spawn(command, args, cwd, config, stdio) {
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
function commandExists(command) {
    return spawnSync(command, ['--version'], { stdio: 'ignore' }).status === 0;
}
export function getInstallPlan(command, platform, hasCommand, isRoot = false) {
    if (command === 'node')
        return [];
    if (command === 'pnpm') {
        if (hasCommand('corepack')) {
            return [
                { command: 'corepack', args: ['enable'] },
                { command: 'corepack', args: ['prepare', 'pnpm@latest', '--activate'] },
            ];
        }
        if (hasCommand('npm')) {
            return [{ command: 'npm', args: ['install', '-g', 'pnpm'] }];
        }
        return [];
    }
    if (command === 'wrangler') {
        if (hasCommand('npm')) {
            return [{ command: 'npm', args: ['install', '-g', 'wrangler'] }];
        }
        return [];
    }
    if (platform === 'darwin' && hasCommand('brew')) {
        return [{ command: 'brew', args: ['install', command] }];
    }
    if (platform === 'win32') {
        if (hasCommand('winget')) {
            const packageId = command === 'gh' ? 'GitHub.cli' : 'Git.Git';
            return [
                {
                    command: 'winget',
                    args: ['install', '--id', packageId, '-e'],
                },
            ];
        }
        if (hasCommand('choco')) {
            const packageName = command === 'gh' ? 'gh' : 'git';
            return [{ command: 'choco', args: ['install', packageName, '-y'] }];
        }
        return [];
    }
    if (platform === 'linux') {
        if (hasCommand('brew')) {
            return [{ command: 'brew', args: ['install', command] }];
        }
        if (hasCommand('apt-get')) {
            return systemInstallSteps('apt-get', ['install', '-y', command], isRoot, [
                ['apt-get', 'update'],
            ]);
        }
        if (hasCommand('dnf')) {
            return systemInstallSteps('dnf', ['install', '-y', command], isRoot);
        }
        if (hasCommand('yum')) {
            return systemInstallSteps('yum', ['install', '-y', command], isRoot);
        }
        if (hasCommand('pacman')) {
            return systemInstallSteps('pacman', ['-Sy', '--noconfirm', command], isRoot);
        }
        if (hasCommand('apk')) {
            return systemInstallSteps('apk', ['add', command], isRoot);
        }
    }
    return [];
}
function systemInstallSteps(command, args, isRoot, before = []) {
    const wrap = (stepCommand, stepArgs) => isRoot
        ? { command: stepCommand, args: stepArgs }
        : { command: 'sudo', args: [stepCommand, ...stepArgs] };
    return [
        ...before.map(([stepCommand, ...stepArgs]) => wrap(stepCommand, stepArgs)),
        wrap(command, args),
    ];
}
function execVersion(command) {
    return execFileSync(command, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
}
function readWranglerConfig(wranglerPath) {
    return JSON.parse(stripJsonc(fs.readFileSync(wranglerPath, 'utf8')));
}
function ensureEnvFile(filePath, targetDir) {
    if (fs.existsSync(filePath))
        return;
    const examplePath = path.join(targetDir, '.env.example');
    const content = fs.existsSync(examplePath)
        ? fs.readFileSync(examplePath, 'utf8')
        : '';
    fs.writeFileSync(filePath, content, 'utf8');
}
function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath))
        return {};
    const env = {};
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
        const match = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (!match)
            continue;
        const key = match[1];
        const rawValue = match[2];
        if (!key || rawValue === undefined)
            continue;
        env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
    return env;
}
function getProcessEnvValuesFromExample(targetDir) {
    const examplePath = path.join(targetDir, '.env.example');
    if (!fs.existsSync(examplePath))
        return {};
    const values = {};
    const example = parseEnvFile(examplePath);
    for (const key of Object.keys(example)) {
        const value = process.env[key];
        if (value !== undefined && value !== '') {
            values[key] = value;
        }
    }
    return values;
}
function updateEnvFile(filePath, values) {
    const seen = new Set();
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).map((line) => {
        const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
        if (!match)
            return line;
        const key = match[1];
        if (!key || !(key in values))
            return line;
        seen.add(key);
        return `${key}=${formatEnvValue(values[key] ?? '')}`;
    });
    for (const [key, value] of Object.entries(values)) {
        if (!seen.has(key)) {
            lines.push(`${key}=${formatEnvValue(value)}`);
        }
    }
    fs.writeFileSync(filePath, `${lines.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
}
function ensureGitignoreEntry(targetDir, entry) {
    const gitignorePath = path.join(targetDir, '.gitignore');
    const existing = fs.existsSync(gitignorePath)
        ? fs.readFileSync(gitignorePath, 'utf8')
        : '';
    const lines = existing.split(/\r?\n/);
    if (lines.includes(entry))
        return;
    const next = `${existing.replace(/\n*$/, '')}\n${entry}\n`;
    fs.writeFileSync(gitignorePath, next, 'utf8');
}
export function parseD1DatabaseId(output) {
    const databaseIdMatch = output.match(/database_id["'\s:=]+([0-9a-f]{8}-[0-9a-f-]{27})/i);
    if (databaseIdMatch)
        return databaseIdMatch[1];
    return output.match(/[0-9a-f]{8}-[0-9a-f-]{27}/i)?.[0];
}
export function parseKVNamespaceId(output) {
    const idMatch = output.match(/\bid["'\s:=]+([0-9a-f]{32})\b/i);
    if (idMatch)
        return idMatch[1];
    return output.match(/\b[0-9a-f]{32}\b/i)?.[0];
}
export function stripJsonc(content) {
    let output = '';
    let inString = false;
    let quote = '';
    let escaped = false;
    for (let index = 0; index < content.length; index++) {
        const char = content[index];
        const next = content[index + 1];
        if (inString) {
            output += char;
            if (escaped) {
                escaped = false;
            }
            else if (char === '\\') {
                escaped = true;
            }
            else if (char === quote) {
                inString = false;
            }
            continue;
        }
        if (char === '"' || char === "'") {
            inString = true;
            quote = char;
            output += char;
            continue;
        }
        if (char === '/' && next === '/') {
            while (index < content.length && content[index] !== '\n')
                index++;
            output += '\n';
            continue;
        }
        if (char === '/' && next === '*') {
            index += 2;
            while (index < content.length &&
                !(content[index] === '*' && content[index + 1] === '/')) {
                index++;
            }
            index++;
            continue;
        }
        output += char;
    }
    return output.replace(/,\s*([}\]])/g, '$1');
}
export function normalizeSlug(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}
export function validateSlug(value, label) {
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(value)) {
        throw new Error(`${label} must be 3-63 chars: lowercase letters, numbers, hyphens, no leading/trailing hyphen.`);
    }
}
export function validateDomain(value) {
    if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i.test(value)) {
        throw new Error('--domain must be a valid domain name.');
    }
}
function requireEnv(key) {
    const value = process.env[key]?.trim();
    if (!value) {
        throw new Error(`${key} is required in your environment.`);
    }
    return value;
}
function requireValue(args, index, flag) {
    const value = args[index];
    if (!value || value.startsWith('-')) {
        throw new Error(`${flag} requires a value.`);
    }
    return value;
}
export function formatEnvValue(value) {
    return `'${value.replace(/'/g, "\\'")}'`;
}
function maskSecret(value) {
    if (value.length <= 8)
        return '********';
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
function bufferToString(value) {
    return value ? value.toString('utf8') : '';
}
function printHelp() {
    console.log(`TanStarter CLI

Usage:
  tanstarter <project-name> [options]

Options:
  --template <url>        Template git URL
  --branch <name>         Template branch
  --dir <path>            Target directory
  --domain <domain>       Cloudflare custom domain route
  --github-repo <repo>    Create or use this GitHub repo
  --skip-install          Skip pnpm install
  --skip-github-repo      Skip GitHub repository creation
  --skip-push             Skip initial commit and push
  --skip-github-secrets   Skip GitHub Actions secrets sync
  --skip-worker-secrets   Skip Cloudflare Worker secrets sync
  --skip-deploy           Skip deployment
  --resume                Resume from .tanstarter/state.json
  -y, --yes               Skip confirmation
  -h, --help              Show help
  -v, --version           Show version

Required environment:
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN`);
}
function printVersion() {
    const packagePath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'package.json');
    try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        console.log(pkg.version ?? '0.0.0');
    }
    catch {
        console.log('0.0.0');
    }
}
if (process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`\nTanStarter CLI failed:\n${message}`);
        console.error('\nFix the issue and rerun with --resume when applicable.');
        process.exit(1);
    });
}
