import type { Transaction } from '@/types/transaction';

export interface TransactionRepository {
  getTransactions(): Promise<Transaction[]>;
}
