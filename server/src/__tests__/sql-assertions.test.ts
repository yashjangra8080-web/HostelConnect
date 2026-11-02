import { describe, it, expect } from 'vitest';
import path from 'path';
import { runSqlAssertions } from '../../../scripts/sql-assertion-runner.js';

describe('Database Business Rule Invariant Tests', () => {
  it('should pass all assertions in assertions.sql (no violating rows)', async () => {
    const assertionsPath = path.resolve(__dirname, '../../../tests/assertions.sql');
    const result = await runSqlAssertions(assertionsPath);

    if (!result.passed) {
      console.error('SQL Assertions Violations:', result.violations);
    }

    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });
});
