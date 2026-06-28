import { QueryClient } from '@tanstack/react-query';
import { createQueryClient, queryKeys, invalidateQueries } from '../queryClient';
import { AppError } from '@/models/AppError';

describe('Query Client Configuration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe('Retry Logic', () => {
    it('should retry on network errors', () => {
      const error = new Error('Network error');
      const defaultOptions = queryClient.getDefaultOptions();
      const retry = defaultOptions.queries?.retry as Function;

      expect(retry(0, error)).toBe(true);
      expect(retry(1, error)).toBe(true);
      expect(retry(2, error)).toBe(true);
      expect(retry(3, error)).toBe(false); // Max 3 retries
    });

    it('should not retry on 4xx errors except 401', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      const retry = defaultOptions.queries?.retry as Function;

      // 400 Bad Request - should not retry
      const error400 = new AppError('Bad Request', 400);
      expect(retry(0, error400)).toBe(false);

      // 404 Not Found - should not retry
      const error404 = new AppError('Not Found', 404);
      expect(retry(0, error404)).toBe(false);

      // 401 Unauthorized - should retry (handled by TokenManager)
      const error401 = new AppError('Unauthorized', 401);
      expect(retry(0, error401)).toBe(true);
    });

    it('should retry on 5xx errors', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      const retry = defaultOptions.queries?.retry as Function;

      const error500 = new AppError('Server Error', 500);
      expect(retry(0, error500)).toBe(true);
      expect(retry(1, error500)).toBe(true);
    });
  });

  describe('Stale Time Configuration', () => {
    it('should have correct stale time', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.queries?.staleTime).toBe(30 * 1000); // 30 seconds
    });

    it('should have correct gc time', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.queries?.gcTime).toBe(5 * 60 * 1000); // 5 minutes
    });
  });

  describe('Refetch Configuration', () => {
    it('should enable refetch on window focus', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(true);
    });

    it('should enable refetch on reconnect', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.queries?.refetchOnReconnect).toBe(true);
    });

    it('should enable refetch on mount', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.queries?.refetchOnMount).toBe(true);
    });
  });

  describe('Query Keys Factory', () => {
    it('should generate correct transaction keys', () => {
      expect(queryKeys.transactions.all).toEqual(['api', 'transactions']);
      expect(queryKeys.transactions.lists()).toEqual(['api', 'transactions', 'list']);
      expect(queryKeys.transactions.list({ type: 'incoming' })).toEqual([
        'api',
        'transactions',
        'list',
        { type: 'incoming' },
      ]);
      expect(queryKeys.transactions.detail('TXN123')).toEqual([
        'api',
        'transactions',
        'detail',
        'TXN123',
      ]);
    });

    it('should generate correct user keys', () => {
      expect(queryKeys.user.all).toEqual(['api', 'user']);
      expect(queryKeys.user.profile()).toEqual(['api', 'user', 'profile']);
      expect(queryKeys.user.settings()).toEqual(['api', 'user', 'settings']);
    });

    it('should generate correct account keys', () => {
      expect(queryKeys.account.all).toEqual(['api', 'account']);
      expect(queryKeys.account.balance()).toEqual(['api', 'account', 'balance']);
      expect(queryKeys.account.details()).toEqual(['api', 'account', 'details']);
    });
  });

  describe('Exponential Backoff', () => {
    it('should calculate correct retry delays', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      const retryDelay = defaultOptions.queries?.retryDelay as Function;

      expect(retryDelay(0)).toBe(1000); // 1 second
      expect(retryDelay(1)).toBe(2000); // 2 seconds
      expect(retryDelay(2)).toBe(4000); // 4 seconds
      expect(retryDelay(3)).toBe(8000); // 8 seconds
      expect(retryDelay(4)).toBe(16000); // 16 seconds
      expect(retryDelay(5)).toBe(30000); // Max 30 seconds
      expect(retryDelay(10)).toBe(30000); // Still max 30 seconds
    });
  });

  describe('Mutation Configuration', () => {
    it('should have conservative retry for mutations', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.mutations?.retry).toBe(1);
      expect(defaultOptions.mutations?.retryDelay).toBe(1000);
    });

    it('should use online network mode for mutations', () => {
      const defaultOptions = queryClient.getDefaultOptions();
      expect(defaultOptions.mutations?.networkMode).toBe('online');
    });
  });
});