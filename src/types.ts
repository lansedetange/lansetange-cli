export interface CliOptions {
  command: 'create' | 'destroy';
  projectName: string;
  targetDir: string;
  domain: string;
  githubRepo?: string;
  yes: boolean;
  resume: boolean;
}

export interface RuntimeConfig {
  projectName: string;
  targetDir: string;
  domain: string;
  githubRepo: string;
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  d1DatabaseName: string;
  d1DatabaseId: string;
  r2BucketName: string;
  kvNamespaceName: string;
  kvNamespaceId: string;
}

export interface SetupState {
  completedSteps: string[];
  config: RuntimeConfig;
  updatedAt: string;
}

export interface WranglerConfig {
  [key: string]: unknown;
  name?: string;
  routes?: Array<{
    pattern: string;
    custom_domain: boolean;
  }>;
  d1_databases?: Array<{
    binding: string;
    database_name: string;
    database_id: string;
    migrations_dir?: string;
  }>;
  r2_buckets?: Array<{
    binding: string;
    bucket_name: string;
  }>;
  kv_namespaces?: Array<{
    binding: string;
    id: string;
  }>;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
}
