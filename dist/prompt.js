import { createInterface } from 'node:readline/promises';
import { validateDomain, validateGithubRepo } from './validators.js';
export async function configureSetup(options, config) {
    if (options.yes || !process.stdin.isTTY || options.resume)
        return config;
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        const nextConfig = await promptForMissingOptions(rl, options, config);
        await confirmSetup(rl, nextConfig);
        return nextConfig;
    }
    finally {
        rl.close();
    }
}
async function promptForMissingOptions(rl, options, config) {
    let domain = config.domain;
    let githubRepo = config.githubRepo;
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
    };
}
async function confirmSetup(rl, config) {
    console.log('\nTanStarter will create:');
    console.log(`  Project: ${config.projectName}`);
    console.log(`  Directory: ${config.targetDir}`);
    console.log(`  Worker: ${config.projectName}`);
    console.log(`  D1 database: ${config.d1DatabaseName}`);
    console.log(`  R2 bucket: ${config.r2BucketName}`);
    console.log(`  KV namespace: ${config.kvNamespaceName}`);
    console.log(`  Domain: ${config.domain || '(none)'}`);
    console.log(`  GitHub repo: ${config.githubRepo}`);
    const answer = await rl.question('\nContinue? [Y/n] ');
    if (answer.trim() && !/^y(es)?$/i.test(answer.trim())) {
        throw new Error('Setup cancelled.');
    }
}
async function askDomain(rl) {
    while (true) {
        const answer = await rl.question('\nCustom domain (leave blank to skip): ');
        const domain = answer.trim();
        if (!domain)
            return '';
        try {
            validateDomain(domain);
            return domain;
        }
        catch (error) {
            console.log(error instanceof Error ? error.message : String(error));
        }
    }
}
async function askGithubRepo(rl, defaultRepo) {
    while (true) {
        const answer = await rl.question(`GitHub repo [${defaultRepo}]: `);
        const repo = answer.trim() || defaultRepo;
        try {
            validateGithubRepo(repo);
            return repo;
        }
        catch (error) {
            console.log(error instanceof Error ? error.message : String(error));
        }
    }
}
