import { afterEach, it, expect, vi } from 'vitest';
import { resolveDatabaseUrl } from '../src/core/config.ts';

afterEach(() => vi.unstubAllEnvs());

function stubParts(overrides: Record<string, string> = {}) {
  const parts = {
    DATABASE_URL: '',
    POSTGRES_USER: 'user',
    POSTGRES_PASSWORD: 'pass',
    POSTGRES_HOST: 'db.internal',
    DB_PORT: '5433',
    POSTGRES_DB: 'taskly',
    ...overrides,
  };
  for (const [key, value] of Object.entries(parts)) vi.stubEnv(key, value);
}

it('prefers an explicit override over DATABASE_URL', () => {
  stubParts({ DATABASE_URL: 'postgresql://env/db' });
  expect(resolveDatabaseUrl('postgresql://override/db')).toBe('postgresql://override/db');
});

it('uses DATABASE_URL when no override is given', () => {
  stubParts({ DATABASE_URL: 'postgresql://env/db' });
  expect(resolveDatabaseUrl()).toBe('postgresql://env/db');
});

it('rewrites the legacy SQLAlchemy driver scheme', () => {
  stubParts();
  expect(resolveDatabaseUrl('postgresql+psycopg://u:p@h:5432/d')).toBe('postgresql://u:p@h:5432/d');
});

it('builds the URL from POSTGRES_* variables', () => {
  stubParts();
  expect(resolveDatabaseUrl()).toBe('postgresql://user:pass@db.internal:5433/taskly');
});

it('percent-encodes special characters in credentials and database name', () => {
  stubParts({ POSTGRES_PASSWORD: 'p@ss/word', POSTGRES_DB: 'my db' });
  const url = new URL(resolveDatabaseUrl());
  expect(url.hostname).toBe('db.internal');
  expect(decodeURIComponent(url.password)).toBe('p@ss/word');
  expect(url.pathname).toBe('/my%20db');
});

it.each(['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_HOST', 'DB_PORT', 'POSTGRES_DB'])(
  'throws naming the missing variable %s',
  (name) => {
    stubParts({ [name]: '' });
    expect(() => resolveDatabaseUrl()).toThrow(`Missing environment variable: ${name}`);
  },
);
