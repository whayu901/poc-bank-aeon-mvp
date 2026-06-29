import { MockBackend } from '../MockBackend';

describe('MockBackend', () => {
  let mockBackend: MockBackend;

  beforeEach(() => {
    // Reset singleton
    (MockBackend as any).instance = undefined;
    mockBackend = MockBackend.getInstance();
    mockBackend.reset();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MockBackend.getInstance();
      const instance2 = MockBackend.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('configuration', () => {
    it('should configure mock behavior', () => {
      mockBackend.configure({
        shouldFail401: true,
        shouldFailNetwork: false,
        shouldTimeout: false,
        latency: 100,
      });

      // Configuration is internal, test through behavior
      expect(mockBackend).toBeDefined();
    });

    it('should reset to default state', () => {
      mockBackend.configure({
        shouldFail401: true,
        latency: 1000,
      });

      mockBackend.reset();

      // After reset, should not fail with 401
      // This is tested through actual requests below
      expect(mockBackend.getRequestCount()).toBe(0);
    });
  });

  describe('token management', () => {
    it('should add valid token', () => {
      mockBackend.addValidToken('test-token', 3600);
      // Token validity is tested through requests
      expect(mockBackend).toBeDefined();
    });

    it('should expire token immediately', () => {
      mockBackend.addValidToken('test-token', 3600);
      mockBackend.expireToken('test-token');
      // Token expiry is tested through requests
      expect(mockBackend).toBeDefined();
    });
  });

  describe('request handling', () => {
    it('should handle GET /api/transactions', async () => {
      const headers = new Headers();
      const response = await mockBackend.handleRequest('GET', '/api/transactions', headers);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);
    });

    it('should handle GET /api/transactions/:id', async () => {
      const headers = new Headers();
      const response = await mockBackend.handleRequest('GET', '/api/transactions/TXN001', headers);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(data.data.refId).toBe('TXN001');
    });

    it('should return 404 for unknown transaction', async () => {
      const headers = new Headers();
      const response = await mockBackend.handleRequest('GET', '/api/transactions/UNKNOWN', headers);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Transaction not found');
    });

    it('should return 401 when configured', async () => {
      mockBackend.configure({ shouldFail401: true });

      const headers = new Headers();
      const response = await mockBackend.handleRequest('GET', '/api/transactions', headers);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should validate authorization header', async () => {
      mockBackend.addValidToken('valid-token', 3600);

      const headersWithValid = new Headers({ Authorization: 'Bearer valid-token' });
      const response1 = await mockBackend.handleRequest('GET', '/api/transactions', headersWithValid);
      expect(response1.status).toBe(200);

      const headersWithInvalid = new Headers({ Authorization: 'Bearer invalid-token' });
      const response2 = await mockBackend.handleRequest('GET', '/api/transactions', headersWithInvalid);
      expect(response2.status).toBe(401);
    });

    it('should handle expired tokens', async () => {
      mockBackend.addValidToken('expired-token', 1); // 1 second expiry

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const headers = new Headers({ Authorization: 'Bearer expired-token' });
      const response = await mockBackend.handleRequest('GET', '/api/transactions', headers);

      expect(response.status).toBe(401);
    });

    it('should throw network error when configured', async () => {
      mockBackend.configure({ shouldFailNetwork: true });

      const headers = new Headers();
      await expect(mockBackend.handleRequest('GET', '/api/transactions', headers)).rejects.toThrow(
        'Failed to fetch'
      );
    });

    it('should track request count', async () => {
      expect(mockBackend.getRequestCount()).toBe(0);

      const headers = new Headers();
      await mockBackend.handleRequest('GET', '/api/transactions', headers);
      expect(mockBackend.getRequestCount()).toBe(1);

      await mockBackend.handleRequest('GET', '/api/transactions', headers);
      expect(mockBackend.getRequestCount()).toBe(2);

      mockBackend.reset();
      expect(mockBackend.getRequestCount()).toBe(0);
    });

    it('should return 404 for unknown endpoints', async () => {
      const headers = new Headers();
      const response = await mockBackend.handleRequest('GET', '/api/unknown', headers);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Not Found');
    });
  });

  describe('auth endpoints (Phase 2 prep)', () => {
    it('should handle POST /auth/login', async () => {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      const body = { username: 'testuser', password: 'testpass' };
      const response = await mockBackend.handleRequest('POST', '/auth/login', headers, body);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data).toBeDefined();
      expect(data.data.accessToken).toBeDefined();
      expect(data.data.refreshToken).toBeDefined();
      expect(data.data.expiresIn).toBe(30); // Short for demo
      expect(data.data.tokenType).toBe('Bearer');
    });

    it('should require username and password for login', async () => {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      const response = await mockBackend.handleRequest('POST', '/auth/login', headers, {});
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Username and password required');
    });

    it('should handle POST /auth/refresh', async () => {
      // First login to get tokens
      const headers = new Headers({ 'Content-Type': 'application/json' });
      const loginResponse = await mockBackend.handleRequest('POST', '/auth/login', headers, {
        username: 'test',
        password: 'test',
      });
      const loginData = await loginResponse.json();
      const refreshToken = loginData.data.refreshToken;

      // Now refresh
      const refreshResponse = await mockBackend.handleRequest('POST', '/auth/refresh', headers, {
        refreshToken,
      });
      const refreshData = await refreshResponse.json();

      expect(refreshResponse.status).toBe(200);
      expect(refreshData.data.accessToken).toBeDefined();
      expect(refreshData.data.refreshToken).toBeDefined();
      expect(refreshData.data.accessToken).not.toBe(loginData.data.accessToken); // New token
      expect(refreshData.data.refreshToken).not.toBe(refreshToken); // Rotated token
    });

    it('should invalidate old refresh token after use', async () => {
      const headers = new Headers({ 'Content-Type': 'application/json' });

      // Login
      const loginResponse = await mockBackend.handleRequest('POST', '/auth/login', headers, {
        username: 'test',
        password: 'test',
      });
      const loginData = await loginResponse.json();
      const oldRefreshToken = loginData.data.refreshToken;

      // First refresh - should succeed
      const refresh1 = await mockBackend.handleRequest('POST', '/auth/refresh', headers, {
        refreshToken: oldRefreshToken,
      });
      expect(refresh1.status).toBe(200);

      // Try to use old refresh token again - should fail
      const refresh2 = await mockBackend.handleRequest('POST', '/auth/refresh', headers, {
        refreshToken: oldRefreshToken,
      });
      expect(refresh2.status).toBe(401);
    });

    it('should require refresh token for refresh endpoint', async () => {
      const headers = new Headers({ 'Content-Type': 'application/json' });
      const response = await mockBackend.handleRequest('POST', '/auth/refresh', headers, {});
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Refresh token required');
    });
  });

  describe('latency simulation', () => {
    it('should simulate network latency', async () => {
      mockBackend.configure({ latency: 100 });

      const headers = new Headers();
      const startTime = Date.now();
      await mockBackend.handleRequest('GET', '/api/transactions', headers);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('thundering-herd overload (POST /auth/refresh)', () => {
    const jsonHeaders = new Headers({ 'Content-Type': 'application/json' });

    /** Logs in `count` simulated devices and returns their refresh tokens. */
    async function loginDevices(count: number): Promise<string[]> {
      const tokens: string[] = [];
      for (let i = 0; i < count; i++) {
        const res = await mockBackend.handleRequest('POST', '/auth/login', jsonHeaders, {
          username: `user${i}`,
          password: 'pw',
        });
        const data = await res.json();
        tokens.push(data.data.refreshToken);
      }
      return tokens;
    }

    it('sheds excess concurrent refreshes with 429 + Retry-After when capacity is exceeded', async () => {
      // Server can process only 3 refreshes at once; each holds its slot 60ms.
      mockBackend.configure({
        latency: 0,
        refreshOverloadEnabled: true,
        refreshCapacity: 3,
        refreshProcessingMs: 60,
        refreshRetryAfterSeconds: 2,
      });

      const tokens = await loginDevices(10);

      // The "9 AM" herd: all 10 devices refresh in the same instant.
      const responses = await Promise.all(
        tokens.map((refreshToken) =>
          mockBackend.handleRequest('POST', '/auth/refresh', jsonHeaders, { refreshToken })
        )
      );

      const accepted = responses.filter((r) => r.status === 200);
      const shed = responses.filter((r) => r.status === 429);

      // Some succeeded, the overflow was shed — not everyone got through at once.
      expect(accepted.length).toBeGreaterThan(0);
      expect(shed.length).toBeGreaterThan(0);
      expect(accepted.length + shed.length).toBe(10);

      // The server never processed more than its capacity simultaneously.
      const stats = mockBackend.getRefreshOverloadStats();
      expect(stats.peakInflight).toBeLessThanOrEqual(3);
      expect(stats.rejectionCount).toBe(shed.length);

      // Shed responses tell the client when to come back.
      expect(shed[0].headers.get('Retry-After')).toBe('2');
    });

    it('keeps a shed refresh token valid so a backed-off retry can succeed', async () => {
      mockBackend.configure({
        latency: 0,
        refreshOverloadEnabled: true,
        refreshCapacity: 1,
        refreshProcessingMs: 40,
        refreshRetryAfterSeconds: 1,
      });

      const [tokenA, tokenB] = await loginDevices(2);

      // Two devices hit at once with capacity 1 → exactly one is shed.
      const [resA, resB] = await Promise.all([
        mockBackend.handleRequest('POST', '/auth/refresh', jsonHeaders, { refreshToken: tokenA }),
        mockBackend.handleRequest('POST', '/auth/refresh', jsonHeaders, { refreshToken: tokenB }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      expect(statuses).toEqual([200, 429]);

      // Identify the device that was shed and retry it after the slot frees.
      const shedToken = resA.status === 429 ? tokenA : tokenB;
      await new Promise((resolve) => setTimeout(resolve, 60));

      const retry = await mockBackend.handleRequest('POST', '/auth/refresh', jsonHeaders, {
        refreshToken: shedToken,
      });
      // The shed token was never consumed, so the retry now succeeds.
      expect(retry.status).toBe(200);
    });

    it('does not shed load when overload simulation is disabled (default)', async () => {
      mockBackend.configure({ latency: 0 }); // overload off by default

      const tokens = await loginDevices(8);
      const responses = await Promise.all(
        tokens.map((refreshToken) =>
          mockBackend.handleRequest('POST', '/auth/refresh', jsonHeaders, { refreshToken })
        )
      );

      expect(responses.every((r) => r.status === 200)).toBe(true);
      expect(mockBackend.getRefreshOverloadStats().rejectionCount).toBe(0);
    });
  });
});