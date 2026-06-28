import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  useTransactions,
  useTransaction,
  usePrefetchTransaction,
  useCreateTransaction,
  useRefreshTransactions,
  useCachedTransactionCount,
} from '../useTransactionQueries';
import { ApiTransactionRepository } from '@/repositories/ApiTransactionRepository';
import { TokenManager } from '@/services/TokenManager';
import type { Transaction } from '@/types/transaction';

// Mock dependencies
jest.mock('@/repositories/ApiTransactionRepository');
jest.mock('@/services/TokenManager');

const mockTransactions: Transaction[] = [
  {
    refId: 'TXN001',
    id: 'TXN001',
    amount: 100.0,
    transferDate: new Date('2024-01-15'),
    transferName: 'Salary',
    recipientName: 'John Doe',
    recipientAccount: '1234567890',
    transferType: 'Incoming',
  },
  {
    refId: 'TXN002',
    id: 'TXN002',
    amount: -50.0,
    transferDate: new Date('2024-01-16'),
    transferName: 'Groceries',
    recipientName: 'Supermarket',
    recipientAccount: '0987654321',
    transferType: 'Outgoing',
  },
];

describe('Transaction Query Hooks', () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;
  let mockRepository: jest.Mocked<ApiTransactionRepository>;
  let mockTokenManager: jest.Mocked<TokenManager>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });

    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Setup mocks
    mockRepository = new ApiTransactionRepository() as jest.Mocked<ApiTransactionRepository>;
    mockRepository.getAllTransactions = jest.fn().mockResolvedValue(mockTransactions);
    mockRepository.getTransactionById = jest.fn().mockImplementation((id) =>
      Promise.resolve(mockTransactions.find((t) => t.refId === id))
    );

    mockTokenManager = TokenManager.getInstance() as jest.Mocked<TokenManager>;
    mockTokenManager.makeAuthenticatedRequest = jest
      .fn()
      .mockImplementation((fn) => fn());

    // Mock the constructor to return our mock instance
    (ApiTransactionRepository as jest.Mock).mockImplementation(() => mockRepository);
    (TokenManager.getInstance as jest.Mock).mockReturnValue(mockTokenManager);
  });

  afterEach(() => {
    queryClient.clear();
    jest.clearAllMocks();
  });

  describe('useTransactions', () => {
    it('should fetch all transactions', async () => {
      const { result } = renderHook(() => useTransactions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockTransactions);
      expect(mockRepository.getAllTransactions).toHaveBeenCalled();
      expect(mockTokenManager.makeAuthenticatedRequest).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Failed to fetch');
      mockTokenManager.makeAuthenticatedRequest.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useTransactions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBe(error);
      expect(result.current.data).toBeUndefined();
    });

    it('should use stale-while-revalidate pattern', async () => {
      const { result, rerender } = renderHook(() => useTransactions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const firstData = result.current.data;

      // Simulate data becoming stale
      queryClient.invalidateQueries({ queryKey: ['api', 'transactions'] });

      rerender();

      // Should still have previous data while refetching
      expect(result.current.data).toBe(firstData);
    });
  });

  describe('useTransaction', () => {
    it('should fetch a single transaction', async () => {
      const { result } = renderHook(() => useTransaction('TXN001'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual(mockTransactions[0]);
      expect(mockRepository.getTransactionById).toHaveBeenCalledWith('TXN001');
    });

    it('should not fetch when ID is undefined', () => {
      const { result } = renderHook(() => useTransaction(undefined), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(mockRepository.getTransactionById).not.toHaveBeenCalled();
    });

    it('should use cached data from list query', async () => {
      // First, populate the cache with list data
      const { result: listResult } = renderHook(() => useTransactions(), { wrapper });

      await waitFor(() => {
        expect(listResult.current.isLoading).toBe(false);
      });

      // Now fetch a single transaction
      const { result: detailResult } = renderHook(
        () => useTransaction('TXN002'),
        { wrapper }
      );

      // Should immediately have data from cache
      expect(detailResult.current.data).toEqual(mockTransactions[1]);
    });

    it('should throw error for non-existent transaction', async () => {
      mockTokenManager.makeAuthenticatedRequest.mockImplementationOnce(async () => {
        const result = await mockRepository.getTransactionById('INVALID');
        if (!result) {
          throw new Error('Transaction not found');
        }
        return result;
      });

      const { result } = renderHook(() => useTransaction('INVALID'), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error('Transaction not found'));
    });
  });

  describe('usePrefetchTransaction', () => {
    it('should prefetch transaction data', async () => {
      const { result } = renderHook(() => usePrefetchTransaction(), { wrapper });

      // Call the prefetch function
      result.current('TXN001');

      await waitFor(() => {
        // Check that the data is in cache
        const cachedData = queryClient.getQueryData(['api', 'transactions', 'detail', 'TXN001']);
        expect(cachedData).toEqual(mockTransactions[0]);
      });

      expect(mockRepository.getTransactionById).toHaveBeenCalledWith('TXN001');
    });
  });

  describe('useCreateTransaction', () => {
    it('should create a new transaction optimistically', async () => {
      const newTransaction: Partial<Transaction> = {
        amount: 200,
        transferName: 'New Payment',
        recipientName: 'Jane Doe',
      };

      const { result } = renderHook(() => useCreateTransaction(), { wrapper });

      // Populate initial data
      queryClient.setQueryData(['api', 'transactions', 'list'], mockTransactions);

      await result.current.mutateAsync(newTransaction);

      // Check that the transaction was added to the cache
      const cachedData = queryClient.getQueryData<Transaction[]>(['api', 'transactions', 'list']);
      expect(cachedData?.length).toBe(3); // Original 2 + new 1
    });

    it('should rollback on error', async () => {
      const error = new Error('Creation failed');
      mockTokenManager.makeAuthenticatedRequest.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useCreateTransaction(), { wrapper });

      // Populate initial data
      queryClient.setQueryData(['api', 'transactions', 'list'], mockTransactions);

      try {
        await result.current.mutateAsync({ amount: 100 });
      } catch (e) {
        // Error expected
      }

      // Check that the data rolled back
      const cachedData = queryClient.getQueryData<Transaction[]>(['api', 'transactions', 'list']);
      expect(cachedData).toEqual(mockTransactions);
    });
  });

  describe('useRefreshTransactions', () => {
    it('should invalidate and refetch all transaction queries', async () => {
      const { result } = renderHook(() => useRefreshTransactions(), { wrapper });

      // Populate cache
      queryClient.setQueryData(['api', 'transactions', 'list'], mockTransactions);

      const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

      await result.current();

      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['api', 'transactions'],
        refetchType: 'all',
      });
    });
  });

  describe('useCachedTransactionCount', () => {
    it('should return cached transaction count', () => {
      // Populate cache
      queryClient.setQueryData(['api', 'transactions', 'list'], mockTransactions);

      const { result } = renderHook(() => useCachedTransactionCount(), { wrapper });

      expect(result.current).toBe(2);
    });

    it('should return 0 when no cached data', () => {
      const { result } = renderHook(() => useCachedTransactionCount(), { wrapper });

      expect(result.current).toBe(0);
    });
  });

  describe('Token Manager Integration', () => {
    it('should handle 401 errors through TokenManager', async () => {
      const unauthorizedError = { statusCode: 401 };
      mockTokenManager.makeAuthenticatedRequest
        .mockRejectedValueOnce(unauthorizedError)
        .mockResolvedValueOnce(mockTransactions);

      const { result } = renderHook(() => useTransactions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // TokenManager should have been called to handle 401
      expect(mockTokenManager.makeAuthenticatedRequest).toHaveBeenCalledTimes(2);
    });
  });
});