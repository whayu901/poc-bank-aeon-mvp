import { ApiClient } from "@/api/ApiClient";
import { MockBackend } from "@/api/MockBackend";
import { isAppError } from "@/models/AppError";
import { Transaction } from "@/types/transaction";
import { TransactionRepository } from "./TransactionRepository";

/**
 * Production-ready transaction repository using the API client
 * Connects to the mock backend for development/testing
 */
export class ApiTransactionRepository implements TransactionRepository {
  private apiClient: ApiClient;
  private mockBackend: MockBackend;
  private useMockBackend: boolean;

  constructor(useMockBackend: boolean = true) {
    this.useMockBackend = useMockBackend;
    this.mockBackend = MockBackend.getInstance();

    // Get the already-initialized API client
    // ApiClient is initialized in AppInitializer with proper config
    this.apiClient = ApiClient.getInstance();

    // If using mock backend, intercept requests
    if (useMockBackend) {
      this.setupMockInterceptor();
    }
  }

  async getTransactions(): Promise<Transaction[]> {
    return this.getAllTransactions();
  }

  /**
   * Setup mock backend interceptor for development
   */
  private setupMockInterceptor(): void {
    // Override fetch to use mock backend
    const originalFetch = global.fetch;
    global.fetch = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString();
      const urlObj = new URL(url);
      const endpoint = urlObj.pathname;

      // Only intercept our API calls
      if (url.includes("localhost:3000") || url.includes("/api/")) {
        const headers = new Headers(init?.headers);
        const method = init?.method || "GET";
        let body: any;

        if (init?.body) {
          try {
            body = JSON.parse(init.body.toString());
          } catch {
            body = init.body;
          }
        }

        return this.mockBackend.handleRequest(method, endpoint, headers, body);
      }

      // Pass through other requests
      return originalFetch(input, init);
    };
  }

  /**
   * Fetch all transactions
   */
  async getAllTransactions(): Promise<Transaction[]> {
    try {
      const response = await this.apiClient.get<{ data: Transaction[] }>(
        "/api/transactions",
      );
      return response.data.data;
    } catch (error) {
      // Handle AppError consistently
      if (isAppError(error)) {
        console.error(
          `[ApiTransactionRepository] Error fetching transactions:`,
          {
            type: error.type,
            message: error.message,
            statusCode: error.statusCode,
            requestId: error.requestId,
          },
        );
        throw error;
      }

      // Unexpected error
      console.error("[ApiTransactionRepository] Unexpected error:", error);
      throw error;
    }
  }

  /**
   * Fetch a single transaction by ID
   */
  async getTransactionById(id: string): Promise<Transaction | null> {
    try {
      const response = await this.apiClient.get<{ data: Transaction }>(
        `/api/transactions/${id}`,
      );
      return response.data.data;
    } catch (error) {
      if (isAppError(error) && error.statusCode === 404) {
        return null;
      }

      console.error(
        `[ApiTransactionRepository] Error fetching transaction ${id}:`,
        {
          error: isAppError(error)
            ? {
                type: error.type,
                message: error.message,
                statusCode: error.statusCode,
              }
            : error,
        },
      );
      throw error;
    }
  }

  /**
   * Configure mock backend behavior for testing
   */
  configureMockBackend(options: {
    shouldFail401?: boolean;
    shouldFailNetwork?: boolean;
    shouldTimeout?: boolean;
    latency?: number;
    refreshOverloadEnabled?: boolean;
    refreshCapacity?: number;
    refreshProcessingMs?: number;
    refreshRetryAfterSeconds?: number;
  }): void {
    if (this.useMockBackend) {
      this.mockBackend.configure(options);
    }
  }

  /**
   * Reset mock backend to default state
   */
  resetMockBackend(): void {
    if (this.useMockBackend) {
      this.mockBackend.reset();
    }
  }

  /**
   * Set access token for authenticated requests
   */
  setAccessToken(token: string | null): void {
    this.apiClient.setAccessToken(token);
  }
}
