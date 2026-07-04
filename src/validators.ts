export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export function validateSlug(value: string, label: string): void {
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(value)) {
    throw new Error(
      `${label} must be 3-63 chars: lowercase letters, numbers, hyphens, no leading/trailing hyphen.`
    );
  }
}

export function validateDomain(value: string): void {
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i.test(value)) {
    throw new Error('--domain must be a valid domain name.');
  }
}
