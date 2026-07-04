#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './args.js';
import { cloudflareAuth, createD1, createKV, createR2, } from './cloudflare.js';
import { runInherited } from './commands.js';
import { createConfig } from './config.js';
import { ensureEnvFiles } from './env.js';
import { commitAndPush, createGithubRepo, cloneTemplate, initializeGit } from './git.js';
import { preflight } from './preflight.js';
import { confirmSetup } from './prompt.js';
import { markCompleted, readState, writeState } from './state.js';
import { updatePackageName } from './template.js';
import { writeWranglerConfig } from './wrangler-config.js';
async function main() {
    const options = parseArgs(process.argv.slice(2));
    const initialConfig = createConfig(options);
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
            run: () => runInherited('pnpm', ['install'], state.config),
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
        { id: 'create-r2', run: () => createR2(state.config) },
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
            run: () => runInherited('pnpm', ['run', 'sync-worker-secrets'], state.config),
        },
        {
            id: 'create-github-repo',
            run: () => createGithubRepo(options, state.config),
        },
        {
            id: 'sync-github-secrets',
            run: () => {
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
            run: () => commitAndPush(state.config),
        },
        {
            id: 'deploy',
            run: () => runInherited('pnpm', ['run', 'deploy'], state.config),
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
if (isCliEntrypoint(process.argv[1], import.meta.url)) {
    main().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`\nTanStarter CLI failed:\n${message}`);
        console.error('\nFix the issue and rerun with --resume when applicable.');
        process.exit(1);
    });
}
export function isCliEntrypoint(argvPath, moduleUrl) {
    if (!argvPath)
        return false;
    const modulePath = fileURLToPath(moduleUrl);
    try {
        return fs.realpathSync(argvPath) === fs.realpathSync(modulePath);
    }
    catch {
        return path.resolve(argvPath) === path.resolve(modulePath);
    }
}
