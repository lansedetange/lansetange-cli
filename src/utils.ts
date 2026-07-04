export function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required in your environment.`);
  }
  return value;
}

export function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith('-')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

export function maskSecret(value: string): string {
  if (value.length <= 8) return '********';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function bufferToString(value: Buffer | null): string {
  return value ? value.toString('utf8') : '';
}
