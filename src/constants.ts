export const STATE_DIR = '.tanstarter';
export const STATE_FILE = 'state.json';
export const CLOUDFLARE_DOCS_URL = 'https://docs.tanstarter.dev/docs/cloudflare';

export const TEMPLATE_URLS = {
  'mkfast-template': 'https://github.com/lansedetange/mkfast-template.git',
  'mkfast-app': 'https://github.com/lansedetange/mkfast-app.git',
} as const;

export type TemplateName = keyof typeof TEMPLATE_URLS;

export const DEFAULT_TEMPLATE: TemplateName = 'mkfast-template';
export const DEFAULT_TEMPLATE_URL = TEMPLATE_URLS[DEFAULT_TEMPLATE];

export function parseTemplateName(value: string): TemplateName {
  if (value in TEMPLATE_URLS) return value as TemplateName;
  throw new Error('--template must be mkfast-template or mkfast-app.');
}

export function getTemplateUrl(template: TemplateName): string {
  return TEMPLATE_URLS[template];
}
