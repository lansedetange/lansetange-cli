import fs from 'node:fs';
import path from 'node:path';

import type { RuntimeConfig } from './types.js';

export function updatePackageName(config: RuntimeConfig): void {
  const packagePath = path.join(config.targetDir, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as {
    name?: string;
  };
  packageJson.name = config.projectName;
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

export function disablePushDeployWorkflow(config: RuntimeConfig): void {
  const workflowPath = path.join(
    config.targetDir,
    '.github',
    'workflows',
    'deploy.yml'
  );
  if (!fs.existsSync(workflowPath)) return;

  const workflow = fs.readFileSync(workflowPath, 'utf8');
  const next = workflow.replace(
    /on:\n  workflow_dispatch:\n  push:\n    branches:\n      - main/,
    [
      'on:',
      '  # TanStarter CLI performs the initial deploy locally.',
      '  # Run this workflow manually when you want GitHub Actions to deploy.',
      '  workflow_dispatch:',
    ].join('\n')
  );
  fs.writeFileSync(workflowPath, next, 'utf8');
}
