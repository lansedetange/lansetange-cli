export function requireEnv(key) {
    const value = process.env[key]?.trim();
    if (!value) {
        throw new Error(`${key} is required in your environment.`);
    }
    return value;
}
export function requireValue(args, index, flag) {
    const value = args[index];
    if (!value || value.startsWith('-')) {
        throw new Error(`${flag} requires a value.`);
    }
    return value;
}
export function maskSecret(value) {
    if (value.length <= 8)
        return '********';
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
export function bufferToString(value) {
    return value ? value.toString('utf8') : '';
}
