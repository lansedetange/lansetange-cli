import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
export function ensureEnvFiles(config) {
    const baseUrl = config.domain
        ? `https://${config.domain}`
        : 'http://localhost:3000';
    const processEnvValues = getProcessEnvValuesFromExample(config.targetDir);
    const values = {
        VITE_BASE_URL: baseUrl,
        CLOUDFLARE_ACCOUNT_ID: config.cloudflareAccountId,
        CLOUDFLARE_API_TOKEN: config.cloudflareApiToken,
        CLOUDFLARE_DATABASE_ID: config.d1DatabaseId,
    };
    for (const envFile of ['.env', '.env.production']) {
        const envPath = path.join(config.targetDir, envFile);
        ensureEnvFile(envPath, config.targetDir);
        const existing = parseEnvFile(envPath);
        const betterAuthSecret = existing.BETTER_AUTH_SECRET ||
            process.env.BETTER_AUTH_SECRET ||
            crypto.randomBytes(32).toString('base64url');
        updateEnvFile(envPath, {
            ...processEnvValues,
            ...values,
            BETTER_AUTH_SECRET: betterAuthSecret,
        });
    }
}
function ensureEnvFile(filePath, targetDir) {
    if (fs.existsSync(filePath))
        return;
    const examplePath = path.join(targetDir, '.env.example');
    const content = fs.existsSync(examplePath)
        ? fs.readFileSync(examplePath, 'utf8')
        : '';
    fs.writeFileSync(filePath, content, 'utf8');
}
function parseEnvFile(filePath) {
    if (!fs.existsSync(filePath))
        return {};
    const env = {};
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
        const match = line.trim().match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (!match)
            continue;
        const key = match[1];
        const rawValue = match[2];
        if (!key || rawValue === undefined)
            continue;
        env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
    return env;
}
function getProcessEnvValuesFromExample(targetDir) {
    const examplePath = path.join(targetDir, '.env.example');
    if (!fs.existsSync(examplePath))
        return {};
    const values = {};
    const example = parseEnvFile(examplePath);
    for (const key of Object.keys(example)) {
        const value = process.env[key];
        if (value !== undefined && value !== '') {
            values[key] = value;
        }
    }
    return values;
}
function updateEnvFile(filePath, values) {
    const seen = new Set();
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).map((line) => {
        const match = line.match(/^([A-Z_][A-Z0-9_]*)=/);
        if (!match)
            return line;
        const key = match[1];
        if (!key || !(key in values))
            return line;
        seen.add(key);
        return `${key}=${formatEnvValue(values[key] ?? '')}`;
    });
    for (const [key, value] of Object.entries(values)) {
        if (!seen.has(key)) {
            lines.push(`${key}=${formatEnvValue(value)}`);
        }
    }
    fs.writeFileSync(filePath, `${lines.join('\n').replace(/\n+$/, '')}\n`, 'utf8');
}
export function formatEnvValue(value) {
    return `'${value.replace(/'/g, "\\'")}'`;
}
