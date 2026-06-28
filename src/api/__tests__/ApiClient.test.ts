import { ApiClient } from '../ApiClient';
import { ErrorType } from '../../models/AppError';

describe('ApiClient', () => {
  let apiClient: ApiClient;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    // Reset singleton
    (ApiClient as any).instance = undefined;

    // Mock fetch
    fetchMock = jest.fn();
    global.fetch = fetchMock;

    // Mock timers for timeout testing
    jest.useFakeTimers();

    // Initialize client
    apiClient = ApiClient.getInstance({
      baseURL: 'https://api.example.com',
      timeout: 5000,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ApiClient.getInstance();
      const instance2 = ApiClient.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should throw error if not initialized with config', () => {
      (ApiClient as any).instance = undefined;
      expect(() => ApiClient.getInstance()).toThrow(
        'ApiClient must be initialized with config on first use'
      );
    });
  });

  describe('request methods', () => {
    it('should make GET request', async () => {
      const mockResponse = { data: 'test' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const response = await apiClient.get('/test');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Headers),
          signal: expect.any(AbortSignal),
        })
      );
      expect(response.data).toEqual(mockResponse);
      expect(response.status).toBe(200);
    });

    it('should make POST request with body', async () => {
      const requestBody = { name: 'test' };
      const mockResponse = { id: 1, name: 'test' };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockResponse,
      });

      const response = await apiClient.post('/test', requestBody);

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: expect.any(Headers),
          signal: expect.any(AbortSignal),
        })
      );
      expect(response.data).toEqual(mockResponse);
      expect(response.status).toBe(201);
    });

    it('should build URL with query parameters', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      await apiClient.get('/test', {
        params: { page: 1, limit: 10, active: true },
      });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/test?page=1&limit=10&active=true',
        expect.anything()
      );
    });
  });

  describe('authentication', () => {
    it('should add Authorization header when token is set', async () => {
      apiClient.setAccessToken('test-token');
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      await apiClient.get('/test');

      const callArgs = fetchMock.mock.calls[0];
      const headers = callArgs[1].headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer test-token');
    });

    it('should skip auth header when skipAuth is true', async () => {
      apiClient.setAccessToken('test-token');
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      await apiClient.get('/test', { skipAuth: true });

      const callArgs = fetchMock.mock.calls[0];
      const headers = callArgs[1].headers as Headers;
      expect(headers.get('Authorization')).toBeNull();
    });

    it('should clear token when set to null', async () => {
      apiClient.setAccessToken('test-token');
      apiClient.setAccessToken(null);

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      await apiClient.get('/test');

      const callArgs = fetchMock.mock.calls[0];
      const headers = callArgs[1].headers as Headers;
      expect(headers.get('Authorization')).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle 401 unauthorized error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Invalid token' }),
      });

      await expect(apiClient.get('/test')).rejects.toMatchObject({
        type: ErrorType.UNAUTHORIZED,
        statusCode: 401,
      });
    });

    it('should handle 403 forbidden error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Access denied' }),
      });

      await expect(apiClient.get('/test')).rejects.toMatchObject({
        type: ErrorType.FORBIDDEN,
        statusCode: 403,
      });
    });

    it('should handle 404 not found error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Resource not found' }),
      });

      await expect(apiClient.get('/test')).rejects.toMatchObject({
        type: ErrorType.NOT_FOUND,
        statusCode: 404,
      });
    });

    it('should handle 500 server error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ error: 'Server error' }),
      });

      await expect(apiClient.get('/test')).rejects.toMatchObject({
        type: ErrorType.SERVER_ERROR,
        statusCode: 500,
      });
    });

    it('should handle network error', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(apiClient.get('/test')).rejects.toMatchObject({
        type: ErrorType.NETWORK,
        message: expect.stringContaining('Network request failed'),
      });
    });

    it('should handle timeout error', async () => {
      // Mock an abort error which is what happens on timeout
      const abortError = new Error('The operation was aborted.');
      (abortError as any).name = 'AbortError';
      fetchMock.mockRejectedValueOnce(abortError);

      await expect(apiClient.get('/test', { timeout: 1000 })).rejects.toMatchObject({
        type: ErrorType.TIMEOUT,
        message: expect.stringContaining('Request timeout after 1000ms'),
      });
    });
  });

  describe('interceptors', () => {
    it('should apply request interceptor', async () => {
      const interceptor = jest.fn((config) => ({
        ...config,
        headers: { ...config.headers, 'X-Custom-Header': 'test' },
      }));

      apiClient.addRequestInterceptor(interceptor);

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({}),
      });

      await apiClient.get('/test');

      expect(interceptor).toHaveBeenCalled();
      const callArgs = fetchMock.mock.calls[0];
      const headers = callArgs[1].headers as Headers;
      expect(headers.get('X-Custom-Header')).toBe('test');
    });

    it('should apply response interceptor', async () => {
      const interceptor = jest.fn((response) => ({
        ...response,
        data: { ...response.data, modified: true },
      }));

      apiClient.addResponseInterceptor(interceptor);

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ original: true }),
      });

      const response = await apiClient.get('/test');

      expect(interceptor).toHaveBeenCalled();
      expect(response.data).toEqual({ original: true, modified: true });
    });

    it('should apply error interceptor', async () => {
      const interceptor = jest.fn((error) => ({
        ...error,
        message: 'Intercepted: ' + error.message,
      }));

      apiClient.addErrorInterceptor(interceptor);

      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(apiClient.get('/test')).rejects.toMatchObject({
        message: expect.stringContaining('Intercepted:'),
      });

      expect(interceptor).toHaveBeenCalled();
    });

    it('should clear all interceptors', () => {
      apiClient.addRequestInterceptor(() => ({}));
      apiClient.addResponseInterceptor((r) => r);
      apiClient.addErrorInterceptor((e) => e);

      apiClient.clearInterceptors();

      expect((apiClient as any).requestInterceptors).toHaveLength(0);
      expect((apiClient as any).responseInterceptors).toHaveLength(0);
      expect((apiClient as any).errorInterceptors).toHaveLength(0);
    });
  });

  describe('certificate pinning', () => {
    it('should initialize with certificate pinning config', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      (ApiClient as any).instance = undefined;
      const client = ApiClient.getInstance({
        baseURL: 'https://api.example.com',
        certificatePinning: {
          enabled: true,
          pins: [
            { hostname: 'api.example.com', pin: 'sha256/ABC123' },
            { hostname: 'auth.example.com', pin: 'sha256/XYZ789' },
          ],
        },
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ApiClient] Certificate pinning configured (requires dev build)'
      );
      expect(consoleSpy).toHaveBeenCalledWith('[ApiClient] Pin configured for api.example.com');
      expect(consoleSpy).toHaveBeenCalledWith('[ApiClient] Pin configured for auth.example.com');

      consoleSpy.mockRestore();
    });
  });
});