import { describe, expect, it } from '@jest/globals';

import type { Transaction } from '@/types/transaction';
import {
  filterTransactionsByDateRange,
  filterTransactionsByQuery,
  filterTransactionsByType,
  getTransactionType,
  sortTransactionsByLatest,
} from '@/utils/transaction';

const transactions: Transaction[] = [
  {
    refId: 'OLD',
    transferDate: '2024-08-30T11:47:22Z',
    recipientName: 'Emily Davis',
    transferName: 'Bonus Payment',
    amount: 1200,
  },
  {
    refId: 'NEW',
    transferDate: '2024-10-15T12:34:56Z',
    recipientName: 'John Doe',
    transferName: 'Salary Payment',
    amount: 1500,
  },
  {
    refId: 'MID',
    transferDate: '2024-10-05T16:18:30Z',
    recipientName: 'Robert Brown',
    transferName: 'Refund',
    amount: -500,
  },
];

describe('transaction utilities', () => {
  it('sorts transactions by newest transferDate first', () => {
    expect(sortTransactionsByLatest(transactions).map((transaction) => transaction.refId)).toEqual([
      'NEW',
      'MID',
      'OLD',
    ]);
  });

  it('returns a transaction type from amount direction', () => {
    expect(getTransactionType(1500)).toBe('incoming');
    expect(getTransactionType(-500)).toBe('outgoing');
  });

  it('filters transactions by transferName', () => {
    expect(filterTransactionsByQuery(transactions, 'salary').map((transaction) => transaction.refId)).toEqual([
      'NEW',
    ]);
  });

  it('filters transactions by recipientName', () => {
    expect(filterTransactionsByQuery(transactions, 'Robert Brown').map((transaction) => transaction.refId)).toEqual([
      'MID',
    ]);
  });

  it('filters transactions by refId', () => {
    expect(filterTransactionsByQuery(transactions, 'OLD').map((transaction) => transaction.refId)).toEqual([
      'OLD',
    ]);
  });

  it('filters transactions with case-insensitive search', () => {
    expect(filterTransactionsByQuery(transactions, 'bOnUs').map((transaction) => transaction.refId)).toEqual([
      'OLD',
    ]);
  });

  it('filters transactions by incoming and outgoing type', () => {
    expect(filterTransactionsByType(transactions, 'incoming').map((transaction) => transaction.refId)).toEqual([
      'OLD',
      'NEW',
    ]);
    expect(filterTransactionsByType(transactions, 'outgoing').map((transaction) => transaction.refId)).toEqual([
      'MID',
    ]);
  });

  it('filters transactions from the latest transaction through one week', () => {
    expect(filterTransactionsByDateRange(transactions, 'week').map((transaction) => transaction.refId)).toEqual([
      'NEW',
    ]);
  });

  it('filters transactions from the latest transaction through one month', () => {
    expect(filterTransactionsByDateRange(transactions, 'month').map((transaction) => transaction.refId)).toEqual([
      'NEW',
      'MID',
    ]);
  });
});
