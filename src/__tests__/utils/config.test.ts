import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { parseConfig } from '../../config.js';

describe('parseConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should parse minimal config from env vars', () => {
    process.env.BITBUCKET_URL = 'https://git.example.com';
    process.env.BITBUCKET_TOKEN = 'test-token';

    const config = parseConfig();

    expect(config.baseUrl).toBe('https://git.example.com');
    expect(config.token).toBe('test-token');
    expect(config.readOnly).toBe(false);
  });

  test('should parse basic auth from env vars', () => {
    process.env.BITBUCKET_URL = 'https://git.example.com';
    process.env.BITBUCKET_USERNAME = 'user';
    process.env.BITBUCKET_PASSWORD = 'pass';
    delete process.env.BITBUCKET_TOKEN;

    const config = parseConfig();

    expect(config.username).toBe('user');
    expect(config.password).toBe('pass');
    expect(config.token).toBeUndefined();
  });

  test('should parse all optional fields', () => {
    process.env.BITBUCKET_URL = 'https://git.example.com';
    process.env.BITBUCKET_TOKEN = 'tok';
    process.env.BITBUCKET_DEFAULT_PROJECT = 'PROJ';
    process.env.BITBUCKET_READ_ONLY = 'true';
    process.env.BITBUCKET_DIFF_MAX_LINES_PER_FILE = '500';
    process.env.BITBUCKET_CUSTOM_HEADERS = 'X-ZTA=abc,X-Foo=bar';
    process.env.BITBUCKET_ENABLED_TOOLS = 'list_projects,get_pull_request';

    const config = parseConfig();

    expect(config.defaultProject).toBe('PROJ');
    expect(config.readOnly).toBe(true);
    expect(config.maxLinesPerFile).toBe(500);
    expect(config.customHeaders).toEqual({ 'X-ZTA': 'abc', 'X-Foo': 'bar' });
    expect(config.enabledTools).toEqual(['list_projects', 'get_pull_request']);
  });

  test('should accept options override over env vars', () => {
    process.env.BITBUCKET_URL = 'https://from-env.com';
    process.env.BITBUCKET_TOKEN = 'env-token';

    const config = parseConfig({
      baseUrl: 'https://from-options.com',
      token: 'options-token',
    });

    expect(config.baseUrl).toBe('https://from-options.com');
    expect(config.token).toBe('options-token');
  });

  test('should throw if baseUrl is missing', () => {
    delete process.env.BITBUCKET_URL;

    expect(() => parseConfig()).toThrow();
  });

  test('should throw if no auth method is provided', () => {
    process.env.BITBUCKET_URL = 'https://git.example.com';
    delete process.env.BITBUCKET_TOKEN;
    delete process.env.BITBUCKET_USERNAME;
    delete process.env.BITBUCKET_PASSWORD;

    expect(() => parseConfig()).toThrow();
  });

  test('should strip trailing slash from baseUrl', () => {
    process.env.BITBUCKET_URL = 'https://git.example.com/';
    process.env.BITBUCKET_TOKEN = 'tok';

    const config = parseConfig();

    expect(config.baseUrl).toBe('https://git.example.com');
  });

  test('should default readOnly to false', () => {
    process.env.BITBUCKET_URL = 'https://git.example.com';
    process.env.BITBUCKET_TOKEN = 'tok';

    const config = parseConfig();

    expect(config.readOnly).toBe(false);
  });

  test('should parse BITBUCKET_READ_ONLY only when exactly "true"', () => {
    process.env.BITBUCKET_URL = 'https://git.example.com';
    process.env.BITBUCKET_TOKEN = 'tok';
    process.env.BITBUCKET_READ_ONLY = 'yes';

    const config = parseConfig();

    expect(config.readOnly).toBe(false);
  });

  test('should default cacheTtlMs to 5 minutes', () => {
    process.env.BITBUCKET_URL = 'https://git.example.com';
    process.env.BITBUCKET_TOKEN = 'tok';

    const config = parseConfig();

    expect(config.cacheTtlMs).toBe(5 * 60 * 1000);
  });

  test('should parse BITBUCKET_CACHE_TTL in seconds', () => {
    process.env.BITBUCKET_URL = 'https://git.example.com';
    process.env.BITBUCKET_TOKEN = 'tok';
    process.env.BITBUCKET_CACHE_TTL = '120';

    const config = parseConfig();

    expect(config.cacheTtlMs).toBe(120_000);
  });

  test('should disable cache when BITBUCKET_CACHE_TTL is 0', () => {
    process.env.BITBUCKET_URL = 'https://git.example.com';
    process.env.BITBUCKET_TOKEN = 'tok';
    process.env.BITBUCKET_CACHE_TTL = '0';

    const config = parseConfig();

    expect(config.cacheTtlMs).toBe(0);
  });

  test('should accept cacheTtlMs from options', () => {
    process.env.BITBUCKET_URL = 'https://git.example.com';
    process.env.BITBUCKET_TOKEN = 'tok';

    const config = parseConfig({ cacheTtlMs: 10_000 });

    expect(config.cacheTtlMs).toBe(10_000);
  });
});
