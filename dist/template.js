import fs from 'node:fs';
import path from 'node:path';
export function updatePackageName(config) {
    const packagePath = path.join(config.targetDir, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    packageJson.name = config.projectName;
    fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}
