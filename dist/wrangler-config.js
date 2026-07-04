import fs from 'node:fs';
import path from 'node:path';
export function writeWranglerConfig(config) {
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
function readWranglerConfig(wranglerPath) {
    return JSON.parse(stripJsonc(fs.readFileSync(wranglerPath, 'utf8')));
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
