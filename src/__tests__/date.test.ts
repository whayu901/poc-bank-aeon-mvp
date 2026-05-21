import { describe, expect, it } from '@jest/globals';

import { formatDate } from '@/utils/date';

describe('formatDate', () => {
  it('formats a valid ISO date', () => {
    expect(formatDate('2024-10-15T12:34:56Z')).toContain('15 Oct 2024');
  });

  it('returns a fallback for invalid dates', () => {
    expect(formatDate('invalid-date')).toBe('-');
  });
});
