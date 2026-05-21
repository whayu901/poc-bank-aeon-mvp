import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { MockTransactionRepository } from '@/repositories/MockTransactionRepository';
import type { TransactionRepository } from '@/repositories/TransactionRepository';
import type { Transaction } from '@/types/transaction';
import { sortTransactionsByLatest } from '@/utils/transaction';

interface TransactionState {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  fetchTransactions: () => Promise<void>;
  getTransactionByRefId: (refId: string) => Transaction | undefined;
}

let transactionRepository: TransactionRepository = new MockTransactionRepository();

export function setTransactionRepository(repository: TransactionRepository) {
  transactionRepository = repository;
}

export const useTransactionStore = create<TransactionState>()(
  persist(
    (set, get) => ({
      transactions: [],
      isLoading: false,
      error: null,
      async fetchTransactions() {
        set({ isLoading: true, error: null });

        try {
          const transactions = await transactionRepository.getTransactions();
          set({
            transactions: sortTransactionsByLatest(transactions),
            isLoading: false,
          });
        } catch {
          set({
            error: 'LOAD_TRANSACTIONS_FAILED',
            isLoading: false,
          });
        }
      },
      getTransactionByRefId(refId: string) {
        return get().transactions.find((transaction) => transaction.refId === refId);
      },
    }),
    {
      name: 'aeon-bank-transactions',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        transactions: state.transactions,
      }),
    },
  ),
);
