import { createInterface } from 'node:readline/promises';
export async function confirmSetup(options, config) {
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
