import path from 'node:path';
import process from 'node:process';
import { printHelp, printVersion } from './help.js';
import { requireValue } from './utils.js';
import { normalizeSlug, validateSlug } from './validators.js';
export function parseArgs(args) {
    let command = 'create';
    let projectName = '';
    let domain = '';
    let githubRepo;
    let resume = false;
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
        if (arg === '--resume') {
            resume = true;
            continue;
        }
        if (arg === 'delete' || arg === 'destroy') {
            if (projectName) {
                throw new Error('delete must be the first positional argument.');
            }
            command = 'delete';
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
        if (arg === '--repo') {
            githubRepo = requireValue(args, ++index, '--repo');
            continue;
        }
        if (arg.startsWith('--repo=')) {
            githubRepo = arg.slice('--repo='.length);
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
        command,
        projectName: normalizedProjectName,
        targetDir: path.resolve(process.cwd(), normalizedProjectName),
        domain,
        ...(githubRepo ? { githubRepo } : {}),
        resume,
    };
}
