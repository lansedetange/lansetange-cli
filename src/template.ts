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
