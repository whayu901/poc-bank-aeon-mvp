import { Transaction } from '../models/Transaction';

/**
 * Mock backend service for development and testing
 * Simulates API responses with configurable latency and error scenarios
 */
export class MockBackend {
  private static instance: MockBackend;
  private shouldFail401 = false;
  private shouldFailNetwork = false;
  private shouldTimeout = false;
  private latency = 350; // Default latency in ms
  private requestCount = 0;
  private validTokens = new Set<string>();
  private tokenExpiryMap = new Map<string, number>();

  // Mock data
  private transactions: Transaction[] = [
    {
      id: 'TXN001',
      amount: 2500.0,
      type: 'incoming',
      description: 'Salary Payment - Tech Corp Sdn Bhd',
      date: '2024-01-15T09:30:00.000Z',
      category: 'salary',
      status: 'completed',
      merchantName: 'Tech Corp Sdn Bhd',
      referenceNumber: 'REF2024011501',
    },
    {
      id: 'TXN002',
      amount: 150.0,
      type: 'outgoing',
      description: 'Grab - Airport to KLCC',
      date: '2024-01-14T20:15:00.000Z',
      category: 'transport',
      status: 'completed',
      merchantName: 'Grab',
      referenceNumber: 'GRB2024011402',
    },
    {
      id: 'TXN003',
      amount: 89.9,
      type: 'outgoing',
      description: 'Netflix Monthly Subscription',
      date: '2024-01-10T00:00:00.000Z',
      category: 'entertainment',
      status: 'completed',
      merchantName: 'Netflix',
      referenceNumber: 'NTF2024011001',
    },
    {
      id: 'TXN004',
      amount: 450.5,
      type: 'incoming',
      description: 'Freelance Project - Mobile App UI Design',
      date: '2024-01-08T14:20:00.000Z',
      category: 'freelance',
      status: 'completed',
      merchantName: 'Creative Studio',
      referenceNumber: 'FRL2024010801',
    },
  ];

  private constructor() {
    // Initialize with a mock valid token for testing
    this.validTokens.add('mock-valid-token');
    this.tokenExpiryMap.set('mock-valid-token', Date.now() + 3600000); // 1 hour
  }

  public static getInstance(): MockBackend {
    if (!MockBackend.instance) {
      MockBackend.instance = new MockBackend();
    }
    return MockBackend.instance;
  }

  /**
   * Configure mock backend behavior
   */
  public configure(options: {
    shouldFail401?: boolean;
    shouldFailNetwork?: boolean;
    shouldTimeout?: boolean;
    latency?: number;
  }): void {
    if (options.shouldFail401 !== undefined) this.shouldFail401 = options.shouldFail401;
    if (options.shouldFailNetwork !== undefined) this.shouldFailNetwork = options.shouldFailNetwork;
    if (options.shouldTimeout !== undefined) this.shouldTimeout = options.shouldTimeout;
    if (options.latency !== undefined) this.latency = options.latency;
  }

  /**
   * Reset mock backend to default state
   */
  public reset(): void {
    this.shouldFail401 = false;
    this.shouldFailNetwork = false;
    this.shouldTimeout = false;
    this.latency = 350;
    this.requestCount = 0;
    this.validTokens.clear();
    this.tokenExpiryMap.clear();
    // Re-add default mock token
    this.validTokens.add('mock-valid-token');
    this.tokenExpiryMap.set('mock-valid-token', Date.now() + 3600000);
  }

  /**
   * Simulate network latency
   */
  private async simulateLatency(): Promise<void> {
    if (this.shouldTimeout) {
      // Simulate timeout by waiting forever
      await new Promise(() => {});
    }
    await new Promise((resolve) => setTimeout(resolve, this.latency));
  }

  /**
   * Validate token
   */
  private validateToken(token: string | undefined): boolean {
    if (!token) return false;

    const bearerToken = token.replace('Bearer ', '');
    if (!this.validTokens.has(bearerToken)) return false;

    const expiry = this.tokenExpiryMap.get(bearerToken);
    if (!expiry || expiry < Date.now()) {
      this.validTokens.delete(bearerToken);
      this.tokenExpiryMap.delete(bearerToken);
      return false;
    }

    return true;
  }

  /**
   * Add a valid token (for testing)
   */
  public addValidToken(token: string, expiresIn: number = 3600): void {
    this.validTokens.add(token);
    this.tokenExpiryMap.set(token, Date.now() + expiresIn * 1000);
  }

  /**
   * Expire a token immediately (for testing)
   */
  public expireToken(token: string): void {
    this.tokenExpiryMap.set(token, Date.now() - 1000);
  }

  /**
   * Mock endpoint handler
   */
  public async handleRequest(
    method: string,
    endpoint: string,
    headers: Headers,
    body?: any
  ): Promise<Response> {
    await this.simulateLatency();

    this.requestCount++;

    // Check for network failure simulation
    if (this.shouldFailNetwork) {
      throw new TypeError('Failed to fetch');
    }

    // Check for 401 simulation
    if (this.shouldFail401) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Route to appropriate handler
    if (endpoint === '/api/transactions' && method === 'GET') {
      return this.handleGetTransactions(headers);
    }

    if (endpoint.startsWith('/api/transactions/') && method === 'GET') {
      const id = endpoint.split('/').pop();
      return this.handleGetTransaction(id!, headers);
    }

    // Auth endpoints (for Phase 2)
    if (endpoint === '/auth/login' && method === 'POST') {
      return this.handleLogin(body);
    }

    if (endpoint === '/auth/refresh' && method === 'POST') {
      return this.handleRefresh(body);
    }

    // Default 404
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Handle GET /api/transactions
   */
  private handleGetTransactions(headers: Headers): Response {
    const authHeader = headers.get('Authorization');

    // Check authentication (optional for now, will be required in Phase 2)
    if (authHeader && !this.validateToken(authHeader)) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': `req-${Date.now()}`,
        },
      });
    }

    return new Response(JSON.stringify({ data: this.transactions }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': `req-${Date.now()}`,
      },
    });
  }

  /**
   * Handle GET /api/transactions/:id
   */
  private handleGetTransaction(id: string, headers: Headers): Response {
    const authHeader = headers.get('Authorization');

    // Check authentication
    if (authHeader && !this.validateToken(authHeader)) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': `req-${Date.now()}`,
        },
      });
    }

    const transaction = this.transactions.find((t) => t.id === id);

    if (!transaction) {
      return new Response(JSON.stringify({ error: 'Transaction not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': `req-${Date.now()}`,
        },
      });
    }

    return new Response(JSON.stringify({ data: transaction }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': `req-${Date.now()}`,
      },
    });
  }

  /**
   * Handle POST /auth/login (for Phase 2)
   */
  private handleLogin(body: any): Response {
    // Mock login - accept any username/password for now
    const { username, password } = body || {};

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Username and password required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate mock tokens
    const accessToken = `access-${Date.now()}-${Math.random().toString(36)}`;
    const refreshToken = `refresh-${Date.now()}-${Math.random().toString(36)}`;

    // Store tokens as valid (30 seconds for demo, to force refresh)
    this.addValidToken(accessToken, 30);
    this.addValidToken(refreshToken, 86400); // 24 hours

    return new Response(
      JSON.stringify({
        data: {
          accessToken,
          refreshToken,
          expiresIn: 30, // 30 seconds for demo
          tokenType: 'Bearer',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Handle POST /auth/refresh (for Phase 2)
   */
  private handleRefresh(body: any): Response {
    const { refreshToken } = body || {};

    if (!refreshToken) {
      return new Response(JSON.stringify({ error: 'Refresh token required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Validate refresh token
    if (!this.validateToken(`Bearer ${refreshToken}`)) {
      return new Response(JSON.stringify({ error: 'Invalid or expired refresh token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Invalidate old refresh token (single-use)
    this.validTokens.delete(refreshToken);
    this.tokenExpiryMap.delete(refreshToken);

    // Generate new tokens
    const newAccessToken = `access-${Date.now()}-${Math.random().toString(36)}`;
    const newRefreshToken = `refresh-${Date.now()}-${Math.random().toString(36)}`;

    // Store new tokens
    this.addValidToken(newAccessToken, 30); // 30 seconds for demo
    this.addValidToken(newRefreshToken, 86400); // 24 hours

    return new Response(
      JSON.stringify({
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: 30,
          tokenType: 'Bearer',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Get request count for testing
   */
  public getRequestCount(): number {
    return this.requestCount;
  }
}