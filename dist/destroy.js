import { createInterface } from 'node:readline/promises';
import { deleteD1, deleteKV, deleteR2 } from './cloudflare.js';
import { deleteGithubRepo } from './git.js';
export async function destroyProject(options, config) {
    await confirmDestroy(options, config);
    console.log('\nDeleting TanStarter resources...');
    deleteKV(config);
    deleteR2(config);
    deleteD1(config);
    deleteGithubRepo(options, config);
    console.log('\nTanStarter resources were deleted.');
    console.log(`Local project directory was left in place: ${config.targetDir}`);
}
async function confirmDestroy(options, config) {
    console.log('\nTanStarter will delete:');
    console.log(`  GitHub repo: ${options.githubRepo || config.githubRepo || config.projectName}`);
    console.log(`  D1 database: ${config.d1DatabaseName}`);
    console.log(`  R2 bucket: ${config.r2BucketName}`);
    console.log(`  KV namespace: ${config.kvNamespaceName}`);
    if (options.yes || !process.stdin.isTTY)
        return;
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
        const answer = await rl.question('\nType "delete" to continue: ');
        if (answer.trim() !== 'delete') {
            throw new Error('Destroy cancelled.');
        }
    }
    finally {
        rl.close();
    }
}
