import { describe, expect, it } from 'vitest';
import { assertSafeTestDatabaseUrl } from '../../../test/helpers/postgres-test-container.js';

describe('Test Database Safety Guard (assertSafeTestDatabaseUrl)', () => {
  const validLocalTestUrl =
    'postgresql://postgres:postgres@127.0.0.1:5432/webedu_test?schema=public';

  it('allows valid local test database URL when NODE_ENV=test', () => {
    expect(() =>
      assertSafeTestDatabaseUrl(validLocalTestUrl, {
        NODE_ENV: 'test',
        DATABASE_URL: validLocalTestUrl,
      }),
    ).not.toThrow();

    expect(() =>
      assertSafeTestDatabaseUrl(
        'postgresql://postgres:postgres@localhost:55432/webedu_qa',
        {
          NODE_ENV: 'test',
        },
      ),
    ).not.toThrow();
  });

  it('rejects execution when NODE_ENV is production, staging, development, or unset without explicit test flag', () => {
    expect(() =>
      assertSafeTestDatabaseUrl(validLocalTestUrl, {
        NODE_ENV: 'production',
      }),
    ).toThrow(/NODE_ENV="production"/);

    expect(() =>
      assertSafeTestDatabaseUrl(validLocalTestUrl, {
        NODE_ENV: 'staging',
      }),
    ).toThrow(/NODE_ENV="staging"/);

    expect(() =>
      assertSafeTestDatabaseUrl(validLocalTestUrl, {
        NODE_ENV: 'development',
      }),
    ).toThrow(/NODE_ENV must be "test"/);

    expect(() =>
      assertSafeTestDatabaseUrl(validLocalTestUrl, {
        NODE_ENV: '',
      }),
    ).toThrow(/NODE_ENV must be "test"/);
  });

  it('rejects URLs or environment variables containing prod, production, or staging keywords', () => {
    expect(() =>
      assertSafeTestDatabaseUrl(
        'postgresql://postgres@127.0.0.1:5432/webedu_prod_test',
        { NODE_ENV: 'test' },
      ),
    ).toThrow(/forbidden production\/staging keyword/);

    expect(() =>
      assertSafeTestDatabaseUrl(
        'postgresql://postgres@127.0.0.1:5432/webedu_staging_test',
        { NODE_ENV: 'test' },
      ),
    ).toThrow(/forbidden production\/staging keyword/);

    expect(() =>
      assertSafeTestDatabaseUrl(validLocalTestUrl, {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://postgres@db.internal:5432/webedu_production',
      }),
    ).toThrow(/DATABASE_URL contains forbidden production\/staging keyword/);

    expect(() =>
      assertSafeTestDatabaseUrl(validLocalTestUrl, {
        NODE_ENV: 'test',
        TEST_DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/webedu_staging',
      }),
    ).toThrow(/TEST_DATABASE_URL contains forbidden production\/staging keyword/);
  });

  it('rejects non-local database hosts and database names without explicit test/qa marker', () => {
    expect(() =>
      assertSafeTestDatabaseUrl(
        'postgresql://postgres@rds.amazonaws.com:5432/webedu_test',
        { NODE_ENV: 'test' },
      ),
    ).toThrow(/non-local host/);

    expect(() =>
      assertSafeTestDatabaseUrl(
        'postgresql://postgres@127.0.0.1:5432/webedu',
        { NODE_ENV: 'test' },
      ),
    ).toThrow(/must explicitly include "test" or "qa"/);

    expect(() =>
      assertSafeTestDatabaseUrl('', { NODE_ENV: 'test' }),
    ).toThrow(/databaseUrl is empty/);
  });
});
