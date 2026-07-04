#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './args.js';
import { cloudflareAuth, createD1, createKV, createR2, } from './cloudflare.js';
import { runCommandAndEcho, runInherited, runInheritedNonInteractive, } from './commands.js';
import { createConfig } from './config.js';
import { deleteProject } from './delete.js';
import { ensureEnvFiles } from './env.js';
import { commitAndPush, createGithubRepo, cloneTemplate, initializeGit, } from './git.js';
import { preflight } from './preflight.js';
import { configureSetup } from './prompt.js';
import { markCompleted, readExistingState, readState, writeState, } from './state.js';
import { printCompletedStep, printFinalSummary, printStep, } from './output.js';
import { updatePackageName } from './template.js';
import { writeWranglerConfig } from './wrangler-config.js';
async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.command === 'delete') {
        const state = readExistingState(options.targetDir);
        await deleteProject(options, state.config);
        return;
    }
    const initialConfig = createConfig(options);
    let state = options.resume
        ? readState(options.targetDir, initialConfig)
        : {
            completedSteps: [],
            config: initialConfig,
            updatedAt: new Date().toISOString(),
        };
    const steps = [
        {
            id: 'preflight',
            title: 'Check local tools and credentials',
            run: () => preflight(state.config),
        },
        {
            id: 'clone-template',
            title: 'Clone TanStarter template',
            run: () => cloneTemplate(options),
        },
        {
            id: 'initialize-git',
            title: 'Initialize project Git repository',
            run: () => initializeGit(state.config.targetDir),
        },
        {
            id: 'install',
            title: 'Install project dependencies',
            run: () => runInherited('pnpm', ['install'], state.config),
        },
        {
            id: 'cloudflare-auth',
            title: 'Verify Cloudflare authentication',
            run: () => cloudflareAuth(state.config),
        },
        {
            id: 'create-d1',
            title: 'Create Cloudflare D1 database',
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
            title: 'Create Cloudflare R2 bucket',
            run: () => createR2(state.config),
        },
        {
            id: 'create-kv',
            title: 'Create Cloudflare KV namespace',
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
            title: 'Write Wrangler and environment files',
            run: () => {
                writeWranglerConfig(state.config);
                ensureEnvFiles(state.config);
                updatePackageName(state.config);
            },
        },
        {
            id: 'cf-typegen',
            title: 'Generate Cloudflare binding types',
            run: () => runInherited('pnpm', ['run', 'cf-typegen'], state.config),
        },
        {
            id: 'db-migrate-local',
            title: 'Apply local database migrations',
            run: () => runInheritedNonInteractive('pnpm', ['run', 'db:migrate:local'], state.config),
        },
        {
            id: 'db-migrate-remote',
            title: 'Apply remote database migrations',
            run: () => runInheritedNonInteractive('pnpm', ['run', 'db:migrate:remote'], state.config),
        },
        {
            id: 'build',
            title: 'Build the production app',
            run: () => runInherited('pnpm', ['run', 'build'], state.config),
        },
        {
            id: 'deploy',
            title: 'Deploy Cloudflare Worker',
            run: () => {
                const result = runCommandAndEcho('pnpm', ['run', 'deploy', '--', '--keep-vars'], state.config);
                const deploymentUrl = parseDeploymentUrl(`${result.stdout}\n${result.stderr}`);
                if (deploymentUrl) {
                    state = writeState(state.config.targetDir, {
                        ...state,
                        config: { ...state.config, deploymentUrl },
                    });
                    ensureEnvFiles(state.config);
                }
            },
        },
        {
            id: 'sync-worker-secrets',
            title: 'Sync Worker secrets',
            run: () => runInheritedNonInteractive('pnpm', ['run', 'sync-worker-secrets'], state.config),
        },
        {
            id: 'create-github-repo',
            title: 'Create or connect GitHub repository',
            run: () => {
                const nextConfig = createGithubRepo(state.config);
                state = writeState(state.config.targetDir, {
                    ...state,
                    config: nextConfig,
                });
            },
        },
        {
            id: 'sync-github-secrets',
            title: 'Sync GitHub Actions secrets',
            run: () => {
                const args = ['run', 'sync-github-secrets'];
                if (state.config.githubRepo.includes('/')) {
                    args.push('--', '--repo', state.config.githubRepo);
                }
                runInherited('pnpm', args, state.config);
            },
        },
        {
            id: 'commit-and-push',
            title: 'Commit and push initial project',
            run: () => commitAndPush(state.config),
        },
    ];
    state = {
        ...state,
        config: await configureSetup(options, state.config),
    };
    for (const [index, step] of steps.entries()) {
        if (state.completedSteps.includes(step.id)) {
            console.log(`✅ ${step.title} already completed`);
            continue;
        }
        printStep(index + 1, steps.length, step.title);
        await step.run();
        state = markCompleted(state.config.targetDir, state, step.id);
        printCompletedStep(step.title);
    }
    printFinalSummary(state.config);
}
if (isCliEntrypoint(process.argv[1], import.meta.url)) {
    main().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`\nTanStarter CLI failed:\n${message}`);
        if (process.argv
            .slice(2)
            .some((arg) => arg === 'delete' || arg === 'destroy')) {
            console.error('\nCheck the project name and local state file, then rerun delete.');
        }
        else {
            console.error('\nFix the issue and rerun with --resume when applicable.');
        }
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
function parseDeploymentUrl(output) {
    return output
        .match(/https:\/\/[^\s)]+/g)
        ?.find((url) => url.includes('.workers.dev') || url.includes('://'));
}
