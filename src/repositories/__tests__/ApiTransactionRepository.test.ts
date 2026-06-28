import { ApiTransactionRepository } from '../ApiTransactionRepository';
import { ApiClient } from '@/api/ApiClient';
import { MockBackend } from '@/api/MockBackend';
import { ErrorType } from '@/models/AppError';

describe('ApiTransactionRepository', () => {
  let repository: ApiTransactionRepository;
  let mockBackend: MockBackend;

  beforeEach(() => {
    // Reset singletons
    (ApiClient as any).instance = undefined;
    (MockBackend as any).instance = undefined;

    mockBackend = MockBackend.getInstance();
    mockBackend.reset();

    repository = new ApiTransactionRepository('http://localhost:3000', true);
  });

  afterEach(() => {
    mockBackend.reset();
  });

  describe('getAllTransactions', () => {
    it('should fetch all transactions', async () => {
      const transactions = await repository.getAllTransactions();

      expect(transactions).toBeDefined();
      expect(Array.isArray(transactions)).toBe(true);
      expect(transactions.length).toBeGreaterThan(0);
      expect(transactions[0]).toHaveProperty('id');
      expect(transactions[0]).toHaveProperty('amount');
      expect(transactions[0]).toHaveProperty('type');
    });

    it('should handle 401 error', async () => {
      repository.configureMockBackend({ shouldFail401: true });

      await expect(repository.getAllTransactions()).rejects.toMatchObject({
        type: ErrorType.UNAUTHORIZED,
        statusCode: 401,
      });
    });

    it('should handle network error', async () => {
      repository.configureMockBackend({ shouldFailNetwork: true });

      await expect(repository.getAllTransactions()).rejects.toMatchObject({
        type: ErrorType.NETWORK,
      });
    });

    it('should use access token when set', async () => {
      const token = 'test-access-token';
      mockBackend.addValidToken(token, 3600);
      repository.setAccessToken(token);

      const transactions = await repository.getAllTransactions();
      expect(transactions).toBeDefined();
      expect(Array.isArray(transactions)).toBe(true);
    });

    it('should fail with invalid token', async () => {
      repository.setAccessToken('invalid-token');

      await expect(repository.getAllTransactions()).rejects.toMatchObject({
        type: ErrorType.UNAUTHORIZED,
        statusCode: 401,
      });
    });
  });

  describe('getTransactionById', () => {
    it('should fetch transaction by id', async () => {
      const transaction = await repository.getTransactionById('TXN001');

      expect(transaction).toBeDefined();
      expect(transaction?.refId).toBe('TXN001');
      expect(transaction?.transferName).toBe('Salary Payment');
    });

    it('should return null for non-existent transaction', async () => {
      const transaction = await repository.getTransactionById('NONEXISTENT');

      expect(transaction).toBeNull();
    });

    it('should handle 401 error', async () => {
      repository.configureMockBackend({ shouldFail401: true });

      await expect(repository.getTransactionById('TXN001')).rejects.toMatchObject({
        type: ErrorType.UNAUTHORIZED,
        statusCode: 401,
      });
    });

    it('should handle network error', async () => {
      repository.configureMockBackend({ shouldFailNetwork: true });

      await expect(repository.getTransactionById('TXN001')).rejects.toMatchObject({
        type: ErrorType.NETWORK,
      });
    });
  });

  describe('mock backend configuration', () => {
    it('should configure mock backend latency', async () => {
      repository.configureMockBackend({ latency: 100 });

      const startTime = Date.now();
      await repository.getAllTransactions();
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should reset mock backend', async () => {
      repository.configureMockBackend({ shouldFail401: true });
      repository.resetMockBackend();

      // Should not fail after reset
      const transactions = await repository.getAllTransactions();
      expect(transactions).toBeDefined();
    });

    it('should not affect non-mock repository', () => {
      const nonMockRepo = new ApiTransactionRepository('http://localhost:3000', false);

      // These should not throw
      expect(() => nonMockRepo.configureMockBackend({ shouldFail401: true })).not.toThrow();
      expect(() => nonMockRepo.resetMockBackend()).not.toThrow();
    });
  });

  describe('error logging', () => {
    it('should log AppError details without sensitive data', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      repository.configureMockBackend({ shouldFail401: true });

      try {
        await repository.getAllTransactions();
      } catch {
        // Expected to throw
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ApiTransactionRepository] Error fetching transactions:',
        expect.objectContaining({
          type: ErrorType.UNAUTHORIZED,
          message: expect.any(String),
          statusCode: 401,
        })
      );

      consoleSpy.mockRestore();
    });

    it('should log unexpected errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      // Force an unexpected error by manipulating the API client
      const apiClient = ApiClient.getInstance();
      jest.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('Unexpected error'));

      try {
        await repository.getAllTransactions();
      } catch {
        // Expected to throw
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ApiTransactionRepository] Unexpected error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});