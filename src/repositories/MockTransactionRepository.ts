import { mockTransactionsResponse } from '@/data/mockTransactions';
import type { TransactionRepository } from '@/repositories/TransactionRepository';
import type { Transaction } from '@/types/transaction';

const MOCK_DELAY_MS = 350;

export class MockTransactionRepository implements TransactionRepository {
  async getTransactions(): Promise<Transaction[]> {
    await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
    return mockTransactionsResponse.data;
  }
}
