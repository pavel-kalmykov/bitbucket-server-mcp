export interface BitbucketConfig {
  baseUrl: string;
  token?: string;
  username?: string;
  password?: string;
  defaultProject?: string;
  maxLinesPerFile?: number;
  readOnly: boolean;
  customHeaders: Record<string, string>;
  enabledTools?: string[];
  cacheTtlMs: number;
  startupHealthcheck: boolean;
}

export interface BitbucketServerOptions {
  baseUrl?: string;
  token?: string;
  username?: string;
  password?: string;
  defaultProject?: string;
  maxLinesPerFile?: number;
  readOnly?: boolean;
  customHeaders?: Record<string, string>;
  enabledTools?: string[];
  cacheTtlMs?: number;
  startupHealthcheck?: boolean;
}
