import { describe, expect, it } from '@jest/globals';

import { formatCurrency } from '@/utils/currency';

describe('formatCurrency', () => {
  it('formats positive amounts with RM and plus sign', () => {
    expect(formatCurrency(1500)).toBe('+ RM 1,500.00');
    expect(formatCurrency(2300.75)).toBe('+ RM 2,300.75');
  });

  it('formats negative amounts with RM and minus sign', () => {
    expect(formatCurrency(-500)).toBe('- RM 500.00');
  });

  it('formats zero as a positive amount', () => {
    expect(formatCurrency(0)).toBe('+ RM 0.00');
  });
});
